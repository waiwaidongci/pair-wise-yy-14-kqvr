// 领域规则：录入校验、节点复核、任务与统计派生
//
// 硬性规则：
// 1. 同一建筑下「轴线 + 构件编号」重复 → 待复核
// 2. 截面尺寸非正 → 待复核
// 3. 含水率 > 18% → 待复核
// 4. 损伤贯穿截面 → 待复核
// 处于待复核的构件不生成关系边（节点）、不生成修缮任务
// 5. 复核必须由第二人填写实测值；通过后转为合格
// 6. 节点两端榫型 / 截面 / 朝向不符 → 冻结节点及下游修缮任务，旧版留档
// 7. 上游构件改动后，关联节点、任务、统计全部按新值重算

import type {
  DerivedState,
  Joint,
  JointEndSnapshot,
  JointEval,
  Member,
  MemberSnapshot,
  MemberStatus,
  RepairTask,
  ReviewData,
} from "./types";

export const MOISTURE_LIMIT = 18;

export const TENON_TYPES = [
  "直榫",
  "燕尾榫",
  "透榫",
  "半榫",
  "箍头榫",
  "管脚榫",
] as const;

export const ORIENTATIONS = [
  "东",
  "西",
  "南",
  "北",
  "上",
  "下",
  "东南",
  "东北",
  "西南",
  "西北",
] as const;

export const DAMAGE_ZONES = [
  "柱顶",
  "柱中",
  "柱脚",
  "梁端",
  "梁中",
  "节点区",
] as const;

export interface MemberInput extends MemberSnapshot {
  building: string;
  axis: string;
  code: string;
  recorder: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** 录入/编辑表单级校验（阻止明显的空值），硬性规则结果在派生层判定 */
export function validateInput(
  input: Partial<MemberInput>,
  all: Member[],
  selfId?: string,
): ValidationResult {
  const errors: string[] = [];
  if (!input.building?.trim()) errors.push("建筑名称不能为空");
  if (!input.axis?.trim()) errors.push("轴线编号不能为空");
  if (!input.code?.trim()) errors.push("构件编号不能为空");
  if (!input.name?.trim()) errors.push("构件名称不能为空");
  if (!input.wood?.trim()) errors.push("木材种类不能为空");
  if (!input.tenon) errors.push("榫型不能为空");
  if (!input.orientation) errors.push("朝向不能为空");
  if (!input.recorder?.trim()) errors.push("录入人不能为空");
  if (
    input.sectionW !== undefined &&
    (!Number.isFinite(input.sectionW) || input.sectionW <= 0)
  ) {
    errors.push("截面宽必须为正数");
  }
  if (
    input.sectionH !== undefined &&
    (!Number.isFinite(input.sectionH) || input.sectionH <= 0)
  ) {
    errors.push("截面高必须为正数");
  }
  if (
    input.moisture !== undefined &&
    (!Number.isFinite(input.moisture) || input.moisture < 0)
  ) {
    errors.push("含水率不合法");
  }
  if (input.building && input.axis && input.code) {
    const dup = all.find(
      (m) =>
        m.id !== selfId &&
        m.building === input.building!.trim() &&
        m.axis === input.axis!.trim() &&
        m.code === input.code!.trim(),
    );
    if (dup) errors.push("编号重复：该建筑、轴线下已存在同编号构件");
  }
  return { ok: errors.length === 0, errors };
}

/** 硬性规则：给出构件进入待复核的全部原因 */
export function hardBlockers(
  m: Pick<
    Member,
    "sectionW" | "sectionH" | "moisture" | "damaged" | "damage" | "review"
  >,
): string[] {
  const out: string[] = [];
  if (!(m.sectionW > 0) || !(m.sectionH > 0)) {
    out.push("截面尺寸非正");
  }
  if (m.moisture > MOISTURE_LIMIT) {
    out.push(`含水率 ${m.moisture}% 超过 ${MOISTURE_LIMIT}%`);
  }
  if (m.damaged && m.damage?.throughSection) {
    out.push("损伤贯穿截面");
  }
  return out;
}

/** 编号重复规则在派生层对全量数据计算 */
export function duplicateCodes(members: Member[]): Set<string> {
  const seen = new Map<string, string[]>();
  for (const m of members) {
    const key = `${m.building}::${m.axis}::${m.code}`;
    const arr = seen.get(key) ?? [];
    arr.push(m.id);
    seen.set(key, arr);
  }
  const dup = new Set<string>();
  for (const ids of seen.values()) {
    if (ids.length > 1) ids.forEach((id) => dup.add(id));
  }
  return dup;
}

/** 复核规则：必须换人，且实测值本身全部满足硬性指标 */
export function reviewCheck(
  m: Member,
  reviewer: string,
  measured: {
    w: number;
    h: number;
    moisture: number;
    through: boolean;
  },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!reviewer.trim()) errors.push("复核人未填写");
  if (reviewer.trim() === m.recorder.trim())
    errors.push("复核必须换人：复核人与录入人不得为同一人");
  if (!(measured.w > 0) || !(measured.h > 0))
    errors.push("实测截面必须为正数");
  if (!(measured.moisture >= 0)) errors.push("实测含水率不合法");
  if (measured.moisture > MOISTURE_LIMIT)
    errors.push(`实测含水率 ${measured.moisture}% 仍超过 ${MOISTURE_LIMIT}%`);
  if (measured.through) errors.push("实测仍判定损伤贯穿截面");
  return { ok: errors.length === 0, errors };
}

export function endSnapshot(m: Member): JointEndSnapshot {
  return {
    memberId: m.id,
    code: m.code,
    tenon: m.tenon,
    sectionW: m.sectionW,
    sectionH: m.sectionH,
    orientation: m.orientation,
  };
}

/**
 * 节点复核：
 * - 任一端构件不存在（被删除）→ missing
 * - 任一端构件待复核 → suspended（挂起，不冻结）
 * - 两端榫型 / 截面 / 朝向任一不符 → frozen
 */
export function evalJoint(
  j: Joint,
  memberById: Map<string, Member>,
  statusById: Map<string, MemberStatus>,
): JointEval {
  const a = memberById.get(j.aId);
  const b = memberById.get(j.bId);
  const reasons: string[] = [];
  if (!a || !b) {
    return {
      status: "missing",
      reasons: ["节点引用的构件已不存在"],
      a: a ? endSnapshot(a) : null,
      b: b ? endSnapshot(b) : null,
    };
  }
  if (statusById.get(a.id) === "pending")
    reasons.push(`构件 ${a.code} 处于待复核`);
  if (statusById.get(b.id) === "pending")
    reasons.push(`构件 ${b.code} 处于待复核`);
  if (reasons.length) {
    return { status: "suspended", reasons, a: endSnapshot(a), b: endSnapshot(b) };
  }
  const mismatch: string[] = [];
  if (a.tenon !== b.tenon)
    mismatch.push(`榫型不符（${a.code} ${a.tenon} ↔ ${b.code} ${b.tenon}）`);
  if (a.sectionW !== b.sectionW || a.sectionH !== b.sectionH)
    mismatch.push(
      `截面不符（${a.code} ${a.sectionW}×${a.sectionH} ↔ ${b.code} ${b.sectionW}×${b.sectionH}）`,
    );
  if (a.orientation !== b.orientation)
    mismatch.push(`朝向不符（${a.code} 朝${a.orientation} ↔ ${b.code} 朝${b.orientation}）`);
  if (mismatch.length) {
    return { status: "frozen", reasons: mismatch, a: endSnapshot(a), b: endSnapshot(b) };
  }
  return { status: "ok", reasons: [], a: endSnapshot(a), b: endSnapshot(b) };
}

/** 全量派生：状态、节点、任务、统计一次性按当前构件值重算 */
export function derive(members: Member[], joints: Joint[]): DerivedState {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const dups = duplicateCodes(members);

  const statusById = new Map<string, MemberStatus>();
  const blockersById = new Map<string, string[]>();
  for (const m of members) {
    const blockers = hardBlockers(m);
    if (dups.has(m.id)) blockers.push("编号重复");
    // 复核通过时实测值已写回构件，按当前值判定即可；
    // 构件一旦再被编辑，store 会使其复核失效，重新进入待复核。
    statusById.set(m.id, blockers.length === 0 ? "qualified" : "pending");
    blockersById.set(m.id, blockers);
  }

  const jointById = new Map<string, JointEval>();
  const blockedMembers = new Set<string>();
  let jointsOk = 0;
  let jointsFrozen = 0;
  let jointsSuspended = 0;
  let jointsMissing = 0;
  for (const j of joints) {
    const ev = evalJoint(j, memberById, statusById);
    jointById.set(j.id, ev);
    if (ev.status === "frozen") {
      jointsFrozen++;
      blockedMembers.add(j.aId);
      blockedMembers.add(j.bId);
    } else if (ev.status === "suspended") {
      jointsSuspended++;
    } else if (ev.status === "missing") {
      jointsMissing++;
    } else {
      jointsOk++;
    }
  }

  // 修缮任务完全派生：待复核构件不产出任务；
  // 冻结节点涉及构件的下游任务即时冻结。上游一改，这里立即重算。
  const derivedTasks: RepairTask[] = members
    .filter(
      (m) =>
        statusById.get(m.id) === "qualified" &&
        (m.damaged || m.repairSuggestion.trim() !== ""),
    )
    .map((m) => {
      const frozen = blockedMembers.has(m.id);
      return {
        id: `task-${m.id}`,
        memberId: m.id,
        building: m.building,
        code: m.code,
        name: m.name,
        suggestion: m.repairSuggestion || "按病害范围编制专项修缮方案",
        state: frozen ? ("frozen" as const) : ("active" as const),
        frozenReason: frozen
          ? "关联榫卯节点已冻结（两端榫型/截面/朝向不符）"
          : "",
      };
    });

  const qualified = members.filter(
    (m) => statusById.get(m.id) === "qualified",
  ).length;
  const pending = members.length - qualified;
  const damaged = members.filter((m) => m.damaged).length;
  const moistureVals = members
    .map((m) => m.moisture)
    .filter((v) => Number.isFinite(v) && v >= 0);
  const avgMoisture = moistureVals.length
    ? moistureVals.reduce((s, v) => s + v, 0) / moistureVals.length
    : 0;

  return {
    statusById,
    blockersById,
    jointById,
    tasks: derivedTasks,
    blockedMembers,
    stats: {
      buildings: new Set(members.map((m) => m.building)).size,
      members: members.length,
      qualified,
      pending,
      damaged,
      joints: joints.length,
      jointsOk,
      jointsFrozen,
      jointsSuspended,
      jointsMissing,
      tasksActive: derivedTasks.filter((t) => t.state === "active").length,
      tasksFrozen: derivedTasks.filter((t) => t.state === "frozen").length,
      avgMoisture,
    },
  };
}

/** 复核通过后把实测值写回构件，使派生层按新值重算 */
export function applyReview(m: Member, review: ReviewData): Member {
  return {
    ...m,
    sectionW: review.measuredW,
    sectionH: review.measuredH,
    moisture: review.measuredMoisture,
    damage:
      m.damage && !review.measuredThrough
        ? { ...m.damage, throughSection: false }
        : m.damage,
    review,
  };
}

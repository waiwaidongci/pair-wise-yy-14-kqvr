import { MOISTURE_LIMIT, OPPOSITE, TENON_LABEL } from "./constants";
import type {
  AppState,
  Derived,
  DerivedMember,
  DerivedNode,
  Member,
  RepairTask,
  Stats,
  ValidationIssue,
} from "../types";

/**
 * 硬性校验。任一问题命中 → 构件只能进入待复核：
 * 1. 编号重复（同建筑 + 同轴线 + 同构件编号）
 * 2. 截面尺寸非正
 * 3. 含水率 > 18%
 * 4. 损伤贯穿截面
 */
export function validateMember(
  m: Member,
  all: Member[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const dup = all.some(
    (o) =>
      o.id !== m.id &&
      o.buildingId === m.buildingId &&
      o.axis.trim() === m.axis.trim() &&
      o.code.trim() === m.code.trim(),
  );
  if (dup) {
    issues.push({ code: "duplicate", message: "编号重复：同一建筑/轴线下构件编号已存在" });
  }

  if (!(m.widthMm > 0) || !(m.heightMm > 0)) {
    issues.push({ code: "dim_nonpositive", message: "截面尺寸非正：宽、高必须为正数" });
  }

  if (!(m.moisturePct >= 0) || Number.isNaN(m.moisturePct) || m.moisturePct > MOISTURE_LIMIT) {
    issues.push({
      code: "moisture_high",
      message: `含水率 ${isNaN(m.moisturePct) ? "无效" : m.moisturePct + "%"}：不得超过 ${MOISTURE_LIMIT}%`,
    });
  }

  if (m.damageType !== "none" && m.damageExtent === "through") {
    issues.push({ code: "damage_through", message: "损伤已贯穿截面" });
  }

  return issues;
}

function deriveMembers(state: AppState): {
  list: DerivedMember[];
  byId: Map<string, DerivedMember>;
} {
  const list = state.members.map((m) => {
    const issues = validateMember(m, state.members);
    return { m, state: issues.length ? ("pending" as const) : ("active" as const), issues };
  });
  const byId = new Map(list.map((d) => [d.m.id, d]));
  return { list, byId };
}

/**
 * 节点判定：
 * - 任一端构件缺失或处于待复核 → blocked（不成立为有效节点）
 * - 两端榫型 / 截面 / 朝向不符 → frozen（冻结该节点及下游修缮任务，旧版留档）
 * - 全部相符 → normal
 */
function deriveNodes(
  state: AppState,
  memberById: Map<string, DerivedMember>,
): { list: DerivedNode[]; byId: Map<string, DerivedNode> } {
  const list: DerivedNode[] = state.nodes.map((def) => {
    const a = memberById.get(def.aId);
    const b = memberById.get(def.bId);
    const reasons: string[] = [];

    if (!a || !b || a.state === "pending" || b.state === "pending") {
      const why: string[] = [];
      if (!a) why.push("甲端构件已删除");
      if (!b) why.push("乙端构件已删除");
      if (a?.state === "pending") why.push("甲端构件待复核");
      if (b?.state === "pending") why.push("乙端构件待复核");
      const d: DerivedNode = { def, state: "blocked", reasons: why, a, b };
      return d;
    }

    if (a.m.tenon !== b.m.tenon) {
      reasons.push(`榫型不符：${TENON_LABEL[a.m.tenon]} ↔ ${TENON_LABEL[b.m.tenon]}`);
    }
    if (a.m.widthMm !== b.m.widthMm || a.m.heightMm !== b.m.heightMm) {
      reasons.push(
        `截面不符：${a.m.widthMm}×${a.m.heightMm}mm ↔ ${b.m.widthMm}×${b.m.heightMm}mm`,
      );
    }
    if (b.m.facing !== OPPOSITE[a.m.facing]) {
      reasons.push("朝向不符：两端榫头未对向（应 东—西 / 南—北）");
    }

    return {
      def,
      a,
      b,
      reasons,
      state: reasons.length ? ("frozen" as const) : ("normal" as const),
    };
  });
  return { list, byId: new Map(list.map((d) => [d.def.id, d])) };
}

/**
 * 修缮任务与冻结传播：
 * - 仅生效（active）且存在病害的构件生成修缮任务；待复核构件不得生成任务
 * - 节点冻结 → 该节点下游沿有效节点链传播，命中的修缮任务一并冻结
 * - blocked 节点为阻断节点，传播到此停止（不生成关系边）
 */
function deriveTasks(
  state: AppState,
  members: DerivedMember[],
  nodes: DerivedNode[],
): RepairTask[] {
  const effective = nodes.filter((n) => n.state !== "blocked");

  // 并查集：有效节点经共用构件连成下游网络（blocked 节点不参与，传播到此停止）
  const parent = effective.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (x: number, y: number) => {
    parent[find(x)] = find(y);
  };

  const nodesOfMember = new Map<string, number[]>();
  effective.forEach((n, i) => {
    for (const mid of [n.def.aId, n.def.bId]) {
      const arr = nodesOfMember.get(mid) ?? [];
      arr.push(i);
      nodesOfMember.set(mid, arr);
    }
  });
  for (const list of nodesOfMember.values()) {
    for (let k = 1; k < list.length; k++) union(list[0], list[k]);
  }

  // 每个连通分量的冻结源头节点（含冻结原因）
  const rootSource = new Map<number, DerivedNode>();
  effective.forEach((n, i) => {
    if (n.state !== "frozen") return;
    const r = find(i);
    if (!rootSource.has(r)) rootSource.set(r, n);
  });

  const tasks: RepairTask[] = [];
  for (const dm of members) {
    if (dm.state !== "active" || dm.m.damageType === "none") continue; // 待复核不生成任务
    const isDone = !!state.taskDone[dm.m.id];

    let frozen: { reason: string; viaNodeId?: string } | undefined;
    for (const ni of nodesOfMember.get(dm.m.id) ?? []) {
      const source = rootSource.get(find(ni));
      if (!source) continue;
      const thisNode = effective[ni];
      frozen =
        thisNode.def.id === source.def.id
          ? {
              reason: `所属节点 ${source.def.code} 冻结：${source.reasons[0] ?? ""}`,
              viaNodeId: source.def.id,
            }
          : {
              reason: `下游冻结：上游节点 ${source.def.code}（${source.reasons[0] ?? "节点冻结"}）`,
              viaNodeId: source.def.id,
            };
      break;
    }

    tasks.push({
      id: `T:${dm.m.id}`,
      memberId: dm.m.id,
      buildingId: dm.m.buildingId,
      title: taskTitle(dm.m),
      state: frozen ? "frozen" : isDone ? "done" : "open",
      frozenReason: frozen?.reason,
      viaNodeId: frozen?.viaNodeId,
    });
  }
  return tasks;
}

function taskTitle(m: Member): string {
  return `修缮任务 · ${m.axis}-${m.code}`;
}

function deriveStats(state: AppState, dMembers: DerivedMember[], dNodes: DerivedNode[], tasks: RepairTask[]): Stats {
  const activeMoist = dMembers.filter((d) => d.state === "active").map((d) => d.m.moisturePct);
  return {
    buildingCount: state.buildings.length,
    memberCount: state.members.length,
    activeCount: dMembers.filter((d) => d.state === "active").length,
    pendingCount: dMembers.filter((d) => d.state === "pending").length,
    nodeCount: dNodes.length,
    normalCount: dNodes.filter((n) => n.state === "normal").length,
    frozenCount: dNodes.filter((n) => n.state === "frozen").length,
    blockedCount: dNodes.filter((n) => n.state === "blocked").length,
    taskTotal: tasks.length,
    taskOpen: tasks.filter((t) => t.state === "open").length,
    taskFrozen: tasks.filter((t) => t.state === "frozen").length,
    taskDone: tasks.filter((t) => t.state === "done").length,
    avgMoisture: activeMoist.length
      ? Math.round((activeMoist.reduce((s, v) => s + v, 0) / activeMoist.length) * 10) / 10
      : null,
  };
}

/** 全量派生：任何上游改动后节点、任务、统计立即重算 */
export function derive(state: AppState): Derived {
  const { list: members, byId: memberById } = deriveMembers(state);
  const { list: nodes, byId: nodeById } = deriveNodes(state, memberById);
  const tasks = deriveTasks(state, members, nodes);
  const stats = deriveStats(state, members, nodes, tasks);
  return { members, memberById, nodes, nodeById, tasks, stats };
}

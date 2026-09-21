// 全局状态：构件建档、复核、关系边（节点）、冻结留档、持久化

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyReview,
  derive,
  reviewCheck,
  validateInput,
  type MemberInput,
} from "./domain";
import type {
  Joint,
  JointHistoryEntry,
  Member,
  MemberVersion,
  ReviewData,
} from "./types";

const STORAGE_KEY = "mortise-review-bench-v1";

let seq = 1;
const uid = (p: string) =>
  `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const now = () => new Date().toISOString();

/* ---------------- 示例数据 ---------------- */

function seed(): { members: Member[]; joints: Joint[] } {
  const t = now();
  const mk = (
    building: string,
    axis: string,
    code: string,
    name: string,
    wood: string,
    tenon: Member["tenon"],
    w: number,
    h: number,
    orientation: Member["orientation"],
    moisture: number,
    extra: Partial<Member> = {},
  ): Member => ({
    id: uid("m"),
    building,
    axis,
    code,
    name,
    wood,
    tenon,
    sectionW: w,
    sectionH: h,
    orientation,
    moisture,
    damaged: false,
    damage: null,
    repairSuggestion: "",
    recorder: "王测绘",
    createdAt: t,
    updatedAt: t,
    review: null,
    versions: [],
    ...extra,
  });

  const m1 = mk("大成殿", "A轴", "L-01", "五架梁", "楠木", "燕尾榫", 240, 320, "东", 12.5, {
    repairSuggestion: "梁端开裂处嵌补环氧树脂，铁箍加固",
  });
  const m2 = mk("大成殿", "A轴", "Z-01", "金柱", "楠木", "燕尾榫", 240, 320, "东", 13.1);
  const m3 = mk("大成殿", "B轴", "L-02", "三架梁", "松木", "透榫", 180, 240, "西", 11.8);
  const m4 = mk("大成殿", "B轴", "Z-02", "檐柱", "松木", "透榫", 180, 240, "西", 20.4, {
    damaged: true,
    damage: { zone: "柱脚", throughSection: false, scope: "柱脚向上0.4m表层糟朽" },
    repairSuggestion: "柱脚糟朽剔除后局部墩接",
    recorder: "李测绘",
  });
  const m5 = mk("大成殿", "C轴", "G-03", "瓜柱", "柏木", "半榫", 150, 150, "南", 14.2);
  const m6 = mk("大成殿", "C轴", "L-03", "抱头梁", "柏木", "半榫", 150, 180, "南", 13.6, {
    damaged: true,
    damage: { zone: "梁端", throughSection: true, scope: "梁端劈裂贯穿整个截面，长约0.6m" },
    repairSuggestion: "评估更换或墩接，先做支护",
  });
  const m7 = mk("山门", "甲轴", "Z-11", "角柱", "榆木", "箍头榫", 200, 200, "北", 12.9);
  const m8 = mk("山门", "甲轴", "F-11", "额枋", "榆木", "管脚榫", 200, 200, "上", 13.4);
  // 编号重复：与 m1 同建筑/轴线/编号
  const m9 = mk("大成殿", "A轴", "L-01", "五架梁(复测)", "楠木", "燕尾榫", 240, 320, "东", 13.0, {
    recorder: "赵测绘",
  });

  const j1: Joint = {
    id: uid("j"),
    building: "大成殿",
    label: "五架梁—金柱 燕尾节点",
    aId: m1.id,
    bId: m2.id,
    createdAt: t,
    createdBy: "王测绘",
    history: [],
  };
  const j2: Joint = {
    id: uid("j"),
    building: "大成殿",
    label: "三架梁—檐柱 透榫节点",
    aId: m3.id,
    bId: m4.id,
    createdAt: t,
    createdBy: "李测绘",
    history: [],
  };
  const j3: Joint = {
    id: uid("j"),
    building: "山门",
    label: "角柱—额枋 节点",
    aId: m7.id,
    bId: m8.id,
    createdAt: t,
    createdBy: "王测绘",
    history: [],
  };
  return { members: [m1, m2, m3, m4, m5, m6, m7, m8, m9], joints: [j1, j2, j3] };
}

/* ---------------- Store ---------------- */

interface StoreState {
  members: Member[];
  joints: Joint[];
}

interface StoreContextValue extends StoreState {
  derived: ReturnType<typeof derive>;
  addMember: (input: MemberInput) => { ok: boolean; errors: string[]; id?: string };
  updateMember: (
    id: string,
    input: MemberInput,
    editor: string,
    reason: string,
  ) => { ok: boolean; errors: string[] };
  deleteMember: (id: string) => void;
  submitReview: (
    id: string,
    reviewer: string,
    measured: { w: number; h: number; moisture: number; through: boolean },
    opinion: string,
  ) => { ok: boolean; errors: string[] };
  invalidateReview: (id: string, editor: string) => void;
  addJoint: (
    building: string,
    label: string,
    aId: string,
    bId: string,
    createdBy: string,
  ) => { ok: boolean; errors: string[] };
  deleteJoint: (id: string) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreState;
      if (Array.isArray(parsed.members) && Array.isArray(parsed.joints)) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return seed();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(load);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 持久化：刷新后状态一致
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // 冻结留档：当节点从非冻结转为冻结时，将冻结时刻的两端旧版数据写入历史
  const prevFrozenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const d = derive(state.members, state.joints);
    const prev = prevFrozenRef.current;
    const nowSet = new Set<string>();
    const entries: { jointId: string; entry: JointHistoryEntry }[] = [];
    for (const j of state.joints) {
      const ev = d.jointById.get(j.id);
      if (ev?.status === "frozen") {
        nowSet.add(j.id);
        const already = j.history.some((h) => h.status === "frozen" &&
          h.a?.memberId === ev.a?.memberId &&
          h.b?.memberId === ev.b?.memberId &&
          h.note === ev.reasons.join("；"));
        if (!prev.has(j.id) && !already) {
          entries.push({
            jointId: j.id,
            entry: {
              at: now(),
              editor: "系统（按构件新值自动重算）",
              status: "frozen",
              a: ev.a!,
              b: ev.b!,
              note: ev.reasons.join("；"),
            },
          });
        }
      }
    }
    prevFrozenRef.current = nowSet;
    if (entries.length) {
      setState((s) => ({
        ...s,
        joints: s.joints.map((j) => {
          const e = entries.find((x) => x.jointId === j.id);
          return e ? { ...j, history: [...j.history, e.entry] } : j;
        }),
      }));
    }
  }, [state.members, state.joints]);

  const api = useMemo<StoreContextValue>(() => {
    const snapshotOf = (m: Member) => ({
      name: m.name,
      wood: m.wood,
      tenon: m.tenon,
      sectionW: m.sectionW,
      sectionH: m.sectionH,
      orientation: m.orientation,
      moisture: m.moisture,
      damaged: m.damaged,
      damage: m.damage,
      repairSuggestion: m.repairSuggestion,
    });

    return {
      ...state,
      derived: derive(state.members, state.joints),

      addMember(input) {
        const { members } = stateRef.current;
        const v = validateInput(input, members);
        if (!v.ok) return { ok: false, errors: v.errors };
        const m: Member = {
          ...input,
          building: input.building.trim(),
          axis: input.axis.trim(),
          code: input.code.trim(),
          recorder: input.recorder.trim(),
          id: uid("m"),
          createdAt: now(),
          updatedAt: now(),
          review: null,
          versions: [],
        };
        setState((s) => ({ ...s, members: [...s.members, m] }));
        return { ok: true, errors: [], id: m.id };
      },

      updateMember(id, input, editor, reason) {
        const target = stateRef.current.members.find((m) => m.id === id);
        if (!target) return { ok: false, errors: ["构件不存在"] };
        const v = validateInput(input, stateRef.current.members, id);
        if (!v.ok) return { ok: false, errors: v.errors };
        setState((s) => ({
          ...s,
          members: s.members.map((m) => {
            if (m.id !== id) return m;
            const version: MemberVersion = {
              savedAt: now(),
              editor: editor.trim() || "未署名",
              reason: reason.trim() || "构件信息修改",
              data: snapshotOf(m),
            };
            // 上游构件被改动 → 既有复核失效，须换人重新复核
            const reviewInvalidated = m.review !== null;
            return {
              ...m,
              ...input,
              building: input.building.trim(),
              axis: input.axis.trim(),
              code: input.code.trim(),
              recorder: m.recorder,
              updatedAt: now(),
              review: reviewInvalidated ? null : m.review,
              versions: [version, ...m.versions].slice(0, 20),
            };
          }),
        }));
        return { ok: true, errors: [] };
      },

      deleteMember(id) {
        setState((s) => ({
          members: s.members.filter((m) => m.id !== id),
          joints: s.joints.filter((j) => j.aId !== id && j.bId !== id),
        }));
      },

      submitReview(id, reviewer, measured, opinion) {
        const target = stateRef.current.members.find((m) => m.id === id);
        if (!target) return { ok: false, errors: ["构件不存在"] };
        const check = reviewCheck(target, reviewer, measured);
        if (!check.ok) return { ok: false, errors: check.errors };
        const review: ReviewData = {
          reviewer: reviewer.trim(),
          measuredW: measured.w,
          measuredH: measured.h,
          measuredMoisture: measured.moisture,
          measuredThrough: measured.through,
          passed: true,
          opinion: opinion.trim(),
          at: now(),
        };
        setState((s) => ({
          ...s,
          members: s.members.map((m) =>
            m.id === id ? applyReview(m, review) : m,
          ),
        }));
        return { ok: true, errors: [] };
      },

      invalidateReview(id, editor) {
        setState((s) => ({
          ...s,
          members: s.members.map((m) => {
            if (m.id !== id || !m.review) return m;
            const version: MemberVersion = {
              savedAt: now(),
              editor: editor.trim() || "管理员",
              reason: "撤销复核结论，退回待复核",
              data: snapshotOf(m),
            };
            return {
              ...m,
              review: null,
              versions: [version, ...m.versions].slice(0, 20),
            };
          }),
        }));
      },

      addJoint(building, label, aId, bId, createdBy) {
        const errors: string[] = [];
        if (!label.trim()) errors.push("节点名称不能为空");
        if (!createdBy.trim()) errors.push("建边人不能为空");
        if (!aId || !bId) errors.push("请选择节点两端构件");
        if (aId && bId && aId === bId) errors.push("节点两端不能为同一构件");
        const d = derive(stateRef.current.members, stateRef.current.joints);
        const a = stateRef.current.members.find((m) => m.id === aId);
        const b = stateRef.current.members.find((m) => m.id === bId);
        if (a && d.statusById.get(a.id) === "pending")
          errors.push(`构件 ${a.code} 处于待复核，不得生成关系边`);
        if (b && d.statusById.get(b.id) === "pending")
          errors.push(`构件 ${b.code} 处于待复核，不得生成关系边`);
        if (
          a &&
          b &&
          stateRef.current.joints.some(
            (j) =>
              (j.aId === aId && j.bId === bId) ||
              (j.aId === bId && j.bId === aId),
          )
        )
          errors.push("两构件之间已存在关系边");
        if (errors.length) return { ok: false, errors };
        const joint: Joint = {
          id: uid("j"),
          building: building || a!.building,
          label: label.trim(),
          aId,
          bId,
          createdAt: now(),
          createdBy: createdBy.trim(),
          history: [],
        };
        setState((s) => ({ ...s, joints: [...s.joints, joint] }));
        return { ok: true, errors: [] };
      },

      deleteJoint(id) {
        setState((s) => ({ ...s, joints: s.joints.filter((j) => j.id !== id) }));
      },

      resetAll() {
        localStorage.removeItem(STORAGE_KEY);
        setState(seed());
      },
    };
  }, [state]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

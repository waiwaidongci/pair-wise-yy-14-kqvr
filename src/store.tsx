import React, { createContext, useCallback, useContext } from "react";
import { derive } from "./domain/derive";
import { initialState } from "./domain/seed";
import { diffNodeHistory, nextId, snap } from "./domain/utils";
import type {
  AppState,
  Building,
  Derived,
  Member,
  MemberSnap,
  MemberVersion,
  NodeDef,
  NodeHistoryEntry,
} from "./types";

const STORAGE_KEY = "sunmao-review-desk-v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    /* ignore */
  }
  return initialState();
}

export interface MemberDraft {
  buildingId: string;
  axis: string;
  code: string;
  wood: string;
  tenon: Member["tenon"];
  widthMm: number;
  heightMm: number;
  facing: Member["facing"];
  moisturePct: number;
  damageType: Member["damageType"];
  damageExtent: Member["damageExtent"];
  damageRange: string;
  note: string;
}

export interface ReviewDraft {
  reviewer: string;
  opinion: string;
  widthMm: number;
  heightMm: number;
  moisturePct: number;
  damageExtent: Member["damageExtent"];
  damageRange: string;
}

interface Store {
  state: AppState;
  derived: Derived;
  setUser: (user: string) => void;
  addBuilding: (name: string) => string;
  addMember: (d: MemberDraft) => { id: string };
  updateMember: (id: string, d: Partial<MemberDraft>) => void;
  submitReview: (id: string, d: ReviewDraft) => { ok: boolean; error?: string };
  addNode: (d: { buildingId: string; code: string; aId: string; bId: string }) => {
    ok: boolean;
    error?: string;
    id?: string;
  };
  deleteNode: (id: string) => void;
  toggleTask: (memberId: string) => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const stateRef = React.useRef<AppState | null>(null);
  if (stateRef.current === null) stateRef.current = load();
  const versionRef = React.useRef(0);
  const listenersRef = React.useRef(new Set<() => void>());

  const subscribe = useCallback((l: () => void) => {
    listenersRef.current.add(l);
    return () => {
      listenersRef.current.delete(l);
    };
  }, []);
  const getSnapshot = useCallback(() => versionRef.current, []);
  const version = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 任何上游改动后全部重算：state 变更 → version+1 → 重新派生
  const derived: Derived = React.useMemo(
    () => derive(stateRef.current!),
    [version],
  );

  const commit = useCallback((updater: (s: AppState) => AppState) => {
    const prev = stateRef.current!;
    let next = updater(prev);
    next = diffNodeHistory(prev, next, next.user);
    stateRef.current = next;
    versionRef.current += 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    listenersRef.current.forEach((l) => l());
  }, []);

  const emitReset = useCallback(() => {
    stateRef.current = initialState();
    versionRef.current += 1;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    } catch {
      /* ignore */
    }
    listenersRef.current.forEach((l) => l());
  }, []);

  const store: Store = {
    state: stateRef.current,
    derived,

    setUser: (user) => commit((s) => ({ ...s, user })),

    addBuilding: (name) => {
      let id = "";
      commit((s) => {
        id = nextId("B", s.seq);
        const b: Building = { id, name, createdAt: Date.now() };
        return { ...s, seq: s.seq + 1, buildings: [...s.buildings, b] };
      });
      return id;
    },

    addMember: (d) => {
      const s = stateRef.current!;
      const id = nextId("M", s.seq);
      const now = Date.now();
      const member: Member = {
        id,
        ...d,
        recorder: s.user,
        recordedAt: now,
        history: [
          {
            at: now,
            by: s.user,
            reason: "建档",
            snap: {
              buildingId: d.buildingId,
              axis: d.axis,
              code: d.code,
              wood: d.wood,
              tenon: d.tenon,
              widthMm: d.widthMm,
              heightMm: d.heightMm,
              facing: d.facing,
              moisturePct: d.moisturePct,
              damageType: d.damageType,
              damageExtent: d.damageExtent,
              damageRange: d.damageRange,
              note: d.note,
            } satisfies MemberSnap,
          },
        ],
      };
      commit((cur) => ({ ...cur, seq: cur.seq + 1, members: [...cur.members, member] }));
      return { id };
    },

    updateMember: (id, d) =>
      commit((s) => ({
        ...s,
        members: s.members.map((m0) => {
          if (m0.id !== id) return m0;
          const merged: Member = { ...m0, ...d };
          const version: MemberVersion = {
            at: Date.now(),
            by: s.user,
            reason: "改录",
            snap: snap(merged),
          };
          return { ...merged, history: [...m0.history, version] };
        }),
      })),

    submitReview: (id, d) => {
      const s = stateRef.current!;
      const target = s.members.find((x) => x.id === id);
      if (!target) return { ok: false, error: "构件不存在" };
      if (d.reviewer.trim() === target.recorder.trim()) {
        return { ok: false, error: "复核必须换人：复核人不得与建档人相同" };
      }
      if (!d.reviewer.trim()) return { ok: false, error: "请填写复核人姓名" };
      commit((cur) => ({
        ...cur,
        members: cur.members.map((m0) => {
          if (m0.id !== id) return m0;
          const merged: Member = {
            ...m0,
            widthMm: d.widthMm,
            heightMm: d.heightMm,
            moisturePct: d.moisturePct,
            damageExtent: d.damageExtent,
            damageRange: d.damageRange,
            review: { reviewer: d.reviewer.trim(), reviewedAt: Date.now(), opinion: d.opinion },
          };
          const version: MemberVersion = {
            at: Date.now(),
            by: d.reviewer.trim(),
            reason: "复核更新",
            snap: snap(merged),
          };
          return { ...merged, history: [...m0.history, version] };
        }),
      }));
      return { ok: true };
    },

    addNode: (d) => {
      const s0 = stateRef.current!;
      if (!d.aId || !d.bId || d.aId === d.bId) {
        return { ok: false, error: "请选择节点两端的不同构件" };
      }
      const a = s0.members.find((x) => x.id === d.aId);
      const b = s0.members.find((x) => x.id === d.bId);
      if (!a || !b) return { ok: false, error: "构件不存在" };
      if (a.buildingId !== b.buildingId) return { ok: false, error: "节点两端必须属于同一建筑" };
      const dup = s0.nodes.some(
        (n) =>
          (n.aId === d.aId && n.bId === d.bId) ||
          (n.aId === d.bId && n.bId === d.aId),
      );
      if (dup) return { ok: false, error: "该对构件已存在节点" };

      const id = nextId("N", s0.seq);
      const def: NodeDef = {
        id,
        buildingId: d.buildingId,
        code: d.code.trim() || `J-${a.axis}`,
        aId: d.aId,
        bId: d.bId,
        createdAt: Date.now(),
      };
      commit((cur) => {
        const derivedNow = derive({ ...cur, seq: cur.seq + 1, nodes: [...cur.nodes, def] });
        const dn = derivedNow.nodeById.get(id)!;
        const entry: NodeHistoryEntry = {
          at: def.createdAt,
          by: cur.user,
          action: "建档",
          toState: dn.state,
          reasons: dn.reasons,
          aId: def.aId,
          bId: def.bId,
        };
        return {
          ...cur,
          seq: cur.seq + 1,
          nodes: [...cur.nodes, def],
          nodeHistory: { ...cur.nodeHistory, [id]: [entry] },
        };
      });
      return { ok: true, id };
    },

    deleteNode: (id) =>
      commit((s) => {
        const def = s.nodes.find((n) => n.id === id);
        if (!def) return s;
        const before = derive(s).nodeById.get(id)!;
        const entry: NodeHistoryEntry = {
          at: Date.now(),
          by: s.user,
          action: "删除",
          fromState: before.state,
          toState: "blocked",
          reasons: ["节点已删除，留档备查"],
          aId: def.aId,
          bId: def.bId,
        };
        return {
          ...s,
          nodes: s.nodes.filter((n) => n.id !== id),
          nodeHistory: {
            ...s.nodeHistory,
            [id]: [...(s.nodeHistory[id] ?? []), entry],
          },
        };
      }),

    toggleTask: (memberId) =>
      commit((s) => ({
        ...s,
        taskDone: { ...s.taskDone, [memberId]: !s.taskDone[memberId] },
      })),

    resetAll: emitReset,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("Store missing");
  return v;
}

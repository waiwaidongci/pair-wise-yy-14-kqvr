import { derive } from "./derive";
import type {
  AppState,
  Member,
  MemberSnap,
  NodeHistoryEntry,
  NodeState,
} from "../types";

export function snap(m: Member): MemberSnap {
  const { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note } = m;
  return { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note };
}

let idCounter = 0;
export function nextId(prefix: string, seq: number): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${seq}${idCounter}`;
}

/** 在成员/节点改动后，比对节点派生状态，自动补“状态变更”留档（旧版留档） */
export function diffNodeHistory(prev: AppState, next: AppState, by: string): AppState {
  const before = derive(prev).nodeById;
  const after = derive(next).nodeById;
  const history = { ...next.nodeHistory };
  let changed = false;
  const at = Date.now();

  for (const [nodeId, dn] of after) {
    const old = before.get(nodeId);
    if (!old) continue;
    const oldSig = old.state + old.reasons.join("|");
    const newSig = dn.state + dn.reasons.join("|");
    if (oldSig !== newSig) {
      const entry: NodeHistoryEntry = {
        at,
        by,
        action: "状态变更",
        fromState: old.state as NodeState,
        toState: dn.state,
        reasons: dn.reasons,
        aId: dn.def.aId,
        bId: dn.def.bId,
      };
      history[nodeId] = [...(history[nodeId] ?? []), entry];
      changed = true;
    }
  }
  return changed ? { ...next, nodeHistory: history } : next;
}

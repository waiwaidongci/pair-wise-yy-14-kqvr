import {
  DAMAGE_LABEL,
  EXTENT_LABEL,
  FACING_LABEL,
  TENON_LABEL,
} from "../domain/constants";
import type { Member, MemberSnap, NodeState, TaskState } from "../types";

export function fmtDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function memberLabel(m: Member | MemberSnap): string {
  return `${m.axis}-${m.code}`;
}

export function sectionText(m: Pick<Member, "widthMm" | "heightMm">): string {
  return `${m.widthMm}×${m.heightMm}mm`;
}

export function damageText(m: Pick<Member, "damageType" | "damageExtent">): string {
  if (m.damageType === "none") return "无病害";
  return `${DAMAGE_LABEL[m.damageType]}（${EXTENT_LABEL[m.damageExtent]}）`;
}

export const NODE_STATE_LABEL: Record<NodeState, string> = {
  normal: "相符",
  frozen: "冻结",
  blocked: "待复核/阻断",
};

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  open: "待办",
  frozen: "冻结",
  done: "已完成",
};

export function fullMemberDesc(m: Member): string {
  return `${TENON_LABEL[m.tenon]} · ${sectionText(m)} · 朝${FACING_LABEL[m.facing]}`;
}

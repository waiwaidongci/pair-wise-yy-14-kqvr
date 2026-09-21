import type { Facing, Tenon } from "../types";

/** 含水率红线：>18% 只能进入待复核 */
export const MOISTURE_LIMIT = 18;

export const TENON_LABEL: Record<Tenon, string> = {
  tou: "透榫",
  yanwei: "燕尾榫",
  ban: "半榫",
  goutou: "箍头榫",
  yinding: "银锭榫",
};

export const TENON_OPTIONS = Object.entries(TENON_LABEL).map(([value, label]) => ({
  value: value as Tenon,
  label,
}));

export const FACING_LABEL: Record<Facing, string> = {
  E: "东",
  S: "南",
  W: "西",
  N: "北",
};

export const FACING_OPTIONS = Object.entries(FACING_LABEL).map(([value, label]) => ({
  value: value as Facing,
  label,
}));

/** 节点两端朝向必须对向 */
export const OPPOSITE: Record<Facing, Facing> = {
  E: "W",
  W: "E",
  S: "N",
  N: "S",
};

export const DAMAGE_LABEL = {
  none: "无病害",
  rot: "糟朽",
  crack: "开裂",
  deform: "变形",
  insect: "虫蛀",
} as const;

export const DAMAGE_OPTIONS = Object.entries(DAMAGE_LABEL).map(([value, label]) => ({
  value: value as keyof typeof DAMAGE_LABEL,
  label,
}));

export const EXTENT_LABEL = {
  local: "局部",
  through: "贯穿截面",
} as const;

export const EXTENT_OPTIONS = Object.entries(EXTENT_LABEL).map(([value, label]) => ({
  value: value as keyof typeof EXTENT_LABEL,
  label,
}));

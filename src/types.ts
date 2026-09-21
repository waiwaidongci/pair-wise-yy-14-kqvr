// 木构榫卯测绘复核台 —— 领域类型

export type TenonType =
  | "直榫"
  | "燕尾榫"
  | "透榫"
  | "半榫"
  | "箍头榫"
  | "管脚榫";

export type Orientation =
  | "东"
  | "西"
  | "南"
  | "北"
  | "上"
  | "下"
  | "东南"
  | "西北"
  | "东北"
  | "西南";

export type DamageZone = "柱顶" | "柱中" | "柱脚" | "梁端" | "梁中" | "节点区";

export type MemberStatus = "qualified" | "pending";

export type JointStatus = "ok" | "frozen" | "suspended" | "missing";

export type TaskState = "active" | "frozen";

/** 病害范围登记 */
export interface DamageInfo {
  zone: DamageZone;
  /** 损伤是否贯穿截面 */
  throughSection: boolean;
  /** 病害范围描述（起止位置、程度） */
  scope: string;
}

/** 复核实测值（由第二人填写） */
export interface ReviewData {
  reviewer: string;
  measuredW: number;
  measuredH: number;
  measuredMoisture: number;
  measuredThrough: boolean;
  passed: boolean;
  opinion: string;
  at: string;
}

/** 构件留档快照 */
export interface MemberSnapshot {
  name: string;
  wood: string;
  tenon: TenonType;
  sectionW: number;
  sectionH: number;
  orientation: Orientation;
  moisture: number;
  damaged: boolean;
  damage: DamageInfo | null;
  repairSuggestion: string;
}

export interface MemberVersion {
  savedAt: string;
  editor: string;
  reason: string;
  data: MemberSnapshot;
}

/** 构件建档：建筑 / 轴线 / 构件编号 三级索引 */
export interface Member extends MemberSnapshot {
  id: string;
  building: string;
  axis: string;
  code: string;
  recorder: string;
  createdAt: string;
  updatedAt: string;
  review: ReviewData | null;
  versions: MemberVersion[];
}

export interface JointEndSnapshot {
  memberId: string;
  code: string;
  tenon: TenonType;
  sectionW: number;
  sectionH: number;
  orientation: Orientation;
}

export interface JointHistoryEntry {
  at: string;
  editor: string;
  status: JointStatus;
  a: JointEndSnapshot;
  b: JointEndSnapshot;
  note: string;
}

/** 榫卯节点（关系边） */
export interface Joint {
  id: string;
  building: string;
  label: string;
  aId: string;
  bId: string;
  createdAt: string;
  createdBy: string;
  history: JointHistoryEntry[];
}

export interface RepairTask {
  id: string;
  memberId: string;
  building: string;
  code: string;
  name: string;
  suggestion: string;
  state: TaskState;
  frozenReason: string;
}

export interface JointEval {
  status: JointStatus;
  reasons: string[];
  a: JointEndSnapshot | null;
  b: JointEndSnapshot | null;
}

export interface DerivedState {
  statusById: Map<string, MemberStatus>;
  blockersById: Map<string, string[]>;
  jointById: Map<string, JointEval>;
  tasks: RepairTask[];
  blockedMembers: Set<string>;
  stats: {
    buildings: number;
    members: number;
    qualified: number;
    pending: number;
    damaged: number;
    joints: number;
    jointsOk: number;
    jointsFrozen: number;
    jointsSuspended: number;
    jointsMissing: number;
    tasksActive: number;
    tasksFrozen: number;
    avgMoisture: number;
  };
}

export type ViewKey =
  | "dashboard"
  | "members"
  | "dimensions"
  | "disease"
  | "joints"
  | "review"
  | "todo"
  | "archive";

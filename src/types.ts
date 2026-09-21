// 木构榫卯测绘复核台 —— 领域类型定义

/** 榫型 */
export type Tenon = "tou" | "yanwei" | "ban" | "goutou" | "yinding";

/** 榫头朝向：构件端部所朝方向；节点两端须对向（东—西、南—北） */
export type Facing = "E" | "S" | "W" | "N";

/** 病害类型 */
export type DamageType = "none" | "rot" | "crack" | "deform" | "insect";

/** 病害范围：局部 / 贯穿截面 */
export type DamageExtent = "local" | "through";

/** 硬性校验问题码 */
export type IssueCode = "duplicate" | "dim_nonpositive" | "moisture_high" | "damage_through";

export interface ValidationIssue {
  code: IssueCode;
  message: string;
}

/** 构件档案（按 建筑 / 轴线 / 构件编号 唯一） */
export interface Member {
  id: string;
  buildingId: string;
  axis: string;
  code: string;
  wood: string; // 木材种类
  tenon: Tenon; // 榫型
  widthMm: number; // 截面宽
  heightMm: number; // 截面高
  facing: Facing; // 朝向
  moisturePct: number; // 含水率 %
  damageType: DamageType;
  damageExtent: DamageExtent;
  damageRange: string; // 病害范围描述
  note: string;
  recorder: string; // 建档/测绘人
  recordedAt: number;
  /** 换人复核记录 */
  review?: MemberReview;
  /** 旧版留档 */
  history: MemberVersion[];
}

export interface MemberSnap {
  buildingId: string;
  axis: string;
  code: string;
  wood: string;
  tenon: Tenon;
  widthMm: number;
  heightMm: number;
  facing: Facing;
  moisturePct: number;
  damageType: DamageType;
  damageExtent: DamageExtent;
  damageRange: string;
  note: string;
}

export interface MemberVersion {
  at: number;
  by: string;
  reason: "建档" | "改录" | "复核更新";
  snap: MemberSnap;
}

export interface MemberReview {
  reviewer: string; // 复核人（必须与建档人不同）
  reviewedAt: number;
  opinion: string;
}

export interface Building {
  id: string;
  name: string;
  createdAt: number;
}

/** 节点定义：连接两个构件端 */
export interface NodeDef {
  id: string;
  buildingId: string;
  code: string; // 节点编号
  aId: string;
  bId: string;
  createdAt: number;
}

export type NodeState = "normal" | "frozen" | "blocked";

export interface DerivedMember {
  m: Member;
  state: "active" | "pending";
  issues: ValidationIssue[];
}

export interface DerivedNode {
  def: NodeDef;
  state: NodeState;
  reasons: string[];
  a?: DerivedMember;
  b?: DerivedMember;
}

export type TaskState = "open" | "frozen" | "done";

export interface RepairTask {
  id: string; // T:memberId，稳定身份
  memberId: string;
  buildingId: string;
  title: string;
  state: TaskState;
  frozenReason?: string;
  viaNodeId?: string;
}

export interface NodeHistoryEntry {
  at: number;
  by: string;
  action: "建档" | "状态变更" | "改录节点" | "删除";
  fromState?: NodeState;
  toState: NodeState;
  reasons: string[];
  aId?: string;
  bId?: string;
}

export interface Stats {
  buildingCount: number;
  memberCount: number;
  activeCount: number;
  pendingCount: number;
  nodeCount: number;
  normalCount: number;
  frozenCount: number;
  blockedCount: number;
  taskTotal: number;
  taskOpen: number;
  taskFrozen: number;
  taskDone: number;
  avgMoisture: number | null;
}

export interface AppState {
  version: 1;
  seq: number;
  user: string;
  buildings: Building[];
  members: Member[];
  nodes: NodeDef[];
  taskDone: Record<string, boolean>;
  nodeHistory: Record<string, NodeHistoryEntry[]>;
}

export interface Derived {
  members: DerivedMember[];
  memberById: Map<string, DerivedMember>;
  nodes: DerivedNode[];
  nodeById: Map<string, DerivedNode>;
  tasks: RepairTask[];
  stats: Stats;
}

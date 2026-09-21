import type { AppState, Member, NodeDef } from "../types";
import { derive } from "./derive";

function ts(y: number, mo: number, d: number, h = 9): number {
  return new Date(2026, mo - 1, d, h, 0).getTime();
}

function m(
  id: string,
  buildingId: string,
  axis: string,
  code: string,
  rest: Partial<Member>,
): Member {
  return {
    id,
    buildingId,
    axis,
    code,
    wood: rest.wood ?? "杉木",
    tenon: rest.tenon ?? "tou",
    widthMm: rest.widthMm ?? 200,
    heightMm: rest.heightMm ?? 200,
    facing: rest.facing ?? "E",
    moisturePct: rest.moisturePct ?? 12,
    damageType: rest.damageType ?? "none",
    damageExtent: rest.damageExtent ?? "local",
    damageRange: rest.damageRange ?? "",
    note: rest.note ?? "",
    recorder: rest.recorder ?? "王测绘",
    recordedAt: rest.recordedAt ?? ts(2026, 8, 10),
    review: rest.review,
    history: rest.history ?? [],
  };
}

const buildings = [
  { id: "B1", name: "正殿", createdAt: ts(2026, 8, 1) },
  { id: "B2", name: "东西配殿", createdAt: ts(2026, 8, 2) },
];

const members: Member[] = [
  // 正殿 · 轴1：柱—梁 正常节点
  m("M1", "B1", "轴1", "Z-01", { wood: "楠木", facing: "E", damageType: "rot", damageRange: "柱脚东侧糟朽 30cm" }),
  m("M2", "B1", "轴1", "L-01", { wood: "楠木", facing: "W", damageType: "crack", damageRange: "梁端顺纹裂缝 15cm" }),
  // 正殿 · 轴2：透榫↔半榫 → 冻结；并向下游传播
  m("M3", "B1", "轴2", "Z-02", { wood: "松木", tenon: "tou", facing: "E" }),
  m("M4", "B1", "轴2", "L-02", { wood: "松木", tenon: "ban", facing: "W" }),
  // 轴2 与 轴3 共用 M4 → 冻结向下游传播到 M5/M6 节点
  m("M5", "B1", "轴3", "Z-03", { wood: "松木", tenon: "ban", facing: "E", damageType: "deform", damageRange: "柱顶倾斜 8mm" }),
  m("M6", "B1", "轴3", "L-03", { wood: "松木", tenon: "ban", facing: "W" }),
  // 含水率超红线 → 待复核，不生成关系边与任务
  m("M7", "B1", "轴4", "L-04", { wood: "柏木", tenon: "yanwei", facing: "W", moisturePct: 20.4, damageType: "insect", damageRange: "梁背虫蛀" }),
  m("M8", "B1", "轴4", "Z-04", { wood: "柏木", tenon: "yanwei", facing: "E" }),
  // 东配殿 · 截面不符 → 冻结
  m("M9", "B2", "甲轴", "G-01", { wood: "杉木", widthMm: 160, heightMm: 180, facing: "S", damageType: "rot", damageRange: "斗栱座糟朽" }),
  m("M10", "B2", "甲轴", "F-01", { wood: "杉木", widthMm: 150, heightMm: 180, facing: "N" }),
  // 东配殿 · 正常燕尾榫
  m("M11", "B2", "乙轴", "G-02", { wood: "榆木", tenon: "yanwei", widthMm: 140, heightMm: 160, facing: "S" }),
  m("M12", "B2", "乙轴", "F-02", { wood: "榆木", tenon: "yanwei", widthMm: 140, heightMm: 160, facing: "N" }),
];

for (const mm of members) {
  mm.history = [
    {
      at: mm.recordedAt,
      by: mm.recorder,
      reason: "建档",
      snap: (() => {
        const { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note } = mm;
        return { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note };
      })(),
    },
  ];
}

const nodes: NodeDef[] = [
  { id: "N1", buildingId: "B1", code: "J-轴1", aId: "M1", bId: "M2", createdAt: ts(2026, 8, 11) },
  { id: "N2", buildingId: "B1", code: "J-轴2", aId: "M3", bId: "M4", createdAt: ts(2026, 8, 11) },
  { id: "N3", buildingId: "B1", code: "J-轴3西", aId: "M5", bId: "M4", createdAt: ts(2026, 8, 12) },
  { id: "N3B", buildingId: "B1", code: "J-轴3东", aId: "M6", bId: "M5", createdAt: ts(2026, 8, 12) },
  { id: "N4", buildingId: "B1", code: "J-轴4", aId: "M7", bId: "M8", createdAt: ts(2026, 8, 12) },
  { id: "N5", buildingId: "B2", code: "J-甲轴", aId: "M9", bId: "M10", createdAt: ts(2026, 8, 13) },
  { id: "N6", buildingId: "B2", code: "J-乙轴", aId: "M11", bId: "M12", createdAt: ts(2026, 8, 13) },
];

export function initialState(): AppState {
  const base: AppState = {
    version: 1,
    seq: 100,
    user: "王测绘",
    buildings,
    members,
    nodes,
    taskDone: {},
    nodeHistory: {},
  };
  // 建档留档按首次派生状态记录（可能建出来即冻结/阻断）
  const derivedNow = derive(base);
  base.nodeHistory = Object.fromEntries(
    nodes.map((n) => {
      const dn = derivedNow.nodeById.get(n.id)!;
      return [
        n.id,
        [
          {
            at: n.createdAt,
            by: "王测绘",
            action: "建档" as const,
            toState: dn.state,
            reasons: dn.reasons,
            aId: n.aId,
            bId: n.bId,
          },
        ],
      ];
    }),
  );
  return base;
}

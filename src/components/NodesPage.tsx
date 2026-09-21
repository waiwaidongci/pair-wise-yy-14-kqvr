import { useMemo, useState } from "react";
import { FACING_LABEL, OPPOSITE, TENON_LABEL } from "../domain/constants";
import { useStore } from "../store";
import type { DerivedNode, Member } from "../types";
import {
  fmtDate,
  memberLabel,
  NODE_STATE_LABEL,
  sectionText,
} from "./format";

const BOX_W = 150;
const BOX_H = 64;
const COL_GAP = 150;
const ROW_GAP = 34;
const PAD_X = 30;
const PAD_Y = 40;

interface Pos {
  x: number;
  y: number;
}

function Graph({ buildingId }: { buildingId: string }) {
  const { state, derived } = useStore();
  const buildingName = state.buildings.find((b) => b.id === buildingId)?.name ?? "";

  // 所有节点的构件参与布局；normal/frozen 为有效关系边，blocked 画虚线灰边
  const nodes = derived.nodes.filter((n) => n.def.buildingId === buildingId);
  const validEdges = nodes.filter((n) => n.state !== "blocked");
  const blockedEdges = nodes.filter((n) => n.state === "blocked");

  const axisIndex = new Map<string, number>();
  for (const m of state.members.filter((m) => m.buildingId === buildingId)) {
    if (!axisIndex.has(m.axis)) axisIndex.set(m.axis, axisIndex.size);
  }

  const layout = new Map<string, Pos>();
  const memberMeta = new Map<string, { m: Member; pending: boolean }>();
  const laneCount = new Map<number, number>();

  for (const n of nodes) {
    for (const dm of [n.a, n.b]) {
      if (!dm) continue;
      const col = axisIndex.get(dm.m.axis) ?? 0;
      if (!memberMeta.has(dm.m.id)) {
        const lane = laneCount.get(col) ?? 0;
        laneCount.set(col, lane + 1);
        layout.set(dm.m.id, {
          x: PAD_X + col * (BOX_W + COL_GAP),
          y: PAD_Y + lane * (BOX_H + ROW_GAP),
        });
        memberMeta.set(dm.m.id, { m: dm.m, pending: dm.state === "pending" });
      }
    }
  }

  const lanes = Math.max(1, ...laneCount.values());
  const width = Math.max(
    720,
    PAD_X * 2 + axisIndex.size * (BOX_W + COL_GAP),
  );
  const height = PAD_Y * 2 + lanes * BOX_H + Math.max(0, lanes - 1) * ROW_GAP;

  const edgePath = (n: DerivedNode) => {
    const pa = layout.get(n.def.aId);
    const pb = layout.get(n.def.bId);
    if (!pa || !pb) return null;
    // 按 x 位置定左右端，兼容同轴线上下构件相连
    const left = pa.x <= pb.x ? pa : pb;
    const right = pa.x <= pb.x ? pb : pa;
    const x1 = left.x + BOX_W;
    const y1 = left.y + BOX_H / 2;
    const x2 = right.x;
    const y2 = right.y + BOX_H / 2;
    if (x2 <= x1) {
      // 同列：右侧出发、右侧到达，弧线向右凸出避免压住构件框
      const bend = 70;
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 + BOX_W + bend} ${y2}, ${x2 + BOX_W} ${y2}`;
    }
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  };

  const edgeLabel = (n: DerivedNode) => {
    const pa = layout.get(n.def.aId);
    const pb = layout.get(n.def.bId);
    if (!pa || !pb) return null;
    const left = pa.x <= pb.x ? pa : pb;
    const right = pa.x <= pb.x ? pb : pa;
    const sameCol = right.x <= left.x;
    const mx = sameCol ? left.x + BOX_W + 70 : (left.x + BOX_W + right.x) / 2;
    const my = (left.y + right.y) / 2;
    return (
      <>
        <rect x={mx - 36} y={my - 11} width={72} height={22} rx={5} className="edge-label-bg" />
        <text x={mx} y={my + 4} textAnchor="middle" className="gnode-sub">
          {n.def.code}
        </text>
      </>
    );
  };

  return (
    <div>
      <h2 style={{ marginTop: 4 }}>{buildingName} · 构件关系图</h2>
      <div className="graph-legend">
        <span>
          <i className="legend-line" style={{ borderTopColor: "var(--accent)" }} />
          相符节点
        </span>
        <span>
          <i className="legend-line" style={{ borderTopColor: "var(--danger)" }} />
          冻结节点（榫型/截面/朝向不符）
        </span>
        <span>待复核构件不入图，其节点为阻断状态（虚线灰边）</span>
      </div>
      <div className="graph-wrap">
        <svg width={width} height={height}>
          {/* 轴线列标题 */}
          {[...axisIndex.entries()].map(([axis, col]) => (
            <text
              key={axis}
              x={PAD_X + col * (BOX_W + COL_GAP) + BOX_W / 2}
              y={18}
              textAnchor="middle"
              className="gnode-sub"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              {axis}
            </text>
          ))}

          {/* 有效边 */}
          {validEdges.map((n) => {
            const d = edgePath(n);
            if (!d) return null;
            return (
              <g key={n.def.id}>
                <path d={d} fill="none" className={n.state === "frozen" ? "edge-frozen" : "edge-normal"} />
                {edgeLabel(n)}
              </g>
            );
          })}

          {/* 阻断边（虚线灰，不形成有效关系） */}
          {blockedEdges.map((n) => {
            const d = edgePath(n);
            if (!d) return null;
            return (
              <g key={n.def.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth={3}
                  strokeDasharray="8 7"
                  opacity={0.7}
                />
                {edgeLabel(n)}
              </g>
            );
          })}

          {/* 构件节点 */}
          {[...layout.entries()].map(([id, p]) => {
            const meta = memberMeta.get(id)!;
            const { m, pending } = meta;
            return (
              <g key={id}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  className={`gnode-rect ${pending ? "member-pending" : ""}`}
                />
                <text x={p.x + 10} y={p.y + 22} className="gnode-label">
                  {memberLabel(m)}
                </text>
                <text x={p.x + 10} y={p.y + 40} className="gnode-sub">
                  {TENON_LABEL[m.tenon]} · {sectionText(m)} · {FACING_LABEL[m.facing]}
                </text>
                <text x={p.x + 10} y={p.y + 55} className="gnode-sub">
                  {m.wood} · {m.moisturePct}%
                  {pending ? " · 待复核" : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function NodesPage() {
  const { state, derived, addNode, deleteNode } = useStore();
  const [buildingId, setBuildingId] = useState(state.buildings[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [error, setError] = useState("");

  const membersInBuilding = state.members.filter((m) => m.buildingId === buildingId);
  const nodes = derived.nodes.filter((n) => n.def.buildingId === buildingId);
  const memberById = derived.memberById;
  const buildingName = (id: string) => state.buildings.find((b) => b.id === id)?.name ?? "?";

  const memberOption = (id: string) => {
    const dm = memberById.get(id);
    if (!dm) return `${id}（已删除）`;
    return `${memberLabel(dm.m)} · ${TENON_LABEL[dm.m.tenon]} · ${sectionText(dm.m)} · 朝${FACING_LABEL[dm.m.facing]}${dm.state === "pending" ? "〔待复核〕" : ""}`;
  };

  const create = () => {
    setError("");
    const r = addNode({ buildingId, code, aId, bId });
    if (!r.ok) {
      setError(r.error ?? "建节点失败");
      return;
    }
    setCode("");
    setAId("");
    setBId("");
  };

  // 即时预判：选好两端时显示对照结果
  const preview = useMemo(() => {
    const a = memberById.get(aId);
    const b = memberById.get(bId);
    if (!a || !b) return null;
    const rows: { key: string; label: string; va: string; vb: string; match: boolean }[] = [
      { key: "tenon", label: "榫型", va: TENON_LABEL[a.m.tenon], vb: TENON_LABEL[b.m.tenon], match: a.m.tenon === b.m.tenon },
      {
        key: "section",
        label: "截面",
        va: sectionText(a.m),
        vb: sectionText(b.m),
        match: a.m.widthMm === b.m.widthMm && a.m.heightMm === b.m.heightMm,
      },
      {
        key: "facing",
        label: "朝向",
        va: FACING_LABEL[a.m.facing],
        vb: FACING_LABEL[b.m.facing],
        match: b.m.facing === OPPOSITE[a.m.facing],
      },
    ];
    return { rows, aPending: a.state === "pending", bPending: b.state === "pending" };
  }, [aId, bId, memberById]);

  return (
    <div>
      <section className="panel">
        {buildingId && <Graph buildingId={buildingId} />}
      </section>

      <section className="panel">
        <h2>节点台账与建档</h2>
        <div className="toolbar">
          <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            {state.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input placeholder="节点编号，如 J-轴5" value={code} onChange={(e) => setCode(e.target.value)} style={{ minWidth: 170 }} />
          <select value={aId} onChange={(e) => setAId(e.target.value)}>
            <option value="">选择甲端构件</option>
            {membersInBuilding.map((m) => (
              <option key={m.id} value={m.id}>
                {memberOption(m.id)}
              </option>
            ))}
          </select>
          <select value={bId} onChange={(e) => setBId(e.target.value)}>
            <option value="">选择乙端构件</option>
            {membersInBuilding.map((m) => (
              <option key={m.id} value={m.id}>
                {memberOption(m.id)}
              </option>
            ))}
          </select>
          <button className="primary" onClick={create} disabled={!aId || !bId}>
            建立节点
          </button>
        </div>

        {preview && (
          <div className="orig" style={{ marginTop: 0 }}>
            <b>建前对照</b>
            <table className="data" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>项</th>
                  <th>甲端</th>
                  <th>乙端</th>
                  <th>结论</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{r.va}</td>
                    <td>{r.vb}</td>
                    <td style={{ color: r.match ? "var(--ok)" : "var(--danger)", fontWeight: 700 }}>
                      {r.match ? "相符" : "不符 → 节点将冻结"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(preview.aPending || preview.bPending) && (
              <p className="error-text" style={{ marginBottom: 0 }}>
                {preview.aPending ? "甲端" : ""}
                {preview.aPending && preview.bPending ? "、" : ""}
                {preview.bPending ? "乙端" : ""} 构件处于待复核，该节点只能为阻断状态，不生成有效关系边与修缮任务。
              </p>
            )}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}

        <table className="data">
          <thead>
            <tr>
              <th>节点编号</th>
              <th>建筑</th>
              <th>甲端构件</th>
              <th>乙端构件</th>
              <th>状态 / 不符项</th>
              <th>建档时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.def.id} className={n.state === "frozen" ? "frozen" : n.state === "blocked" ? "blocked" : ""}>
                <td>
                  <b>{n.def.code}</b>
                </td>
                <td>{buildingName(n.def.buildingId)}</td>
                <td>
                  {n.a ? (
                    <>
                      {memberLabel(n.a.m)}
                      {n.a.state === "pending" && <span className="badge pending">待复核</span>}
                    </>
                  ) : (
                    "已删除"
                  )}
                </td>
                <td>
                  {n.b ? (
                    <>
                      {memberLabel(n.b.m)}
                      {n.b.state === "pending" && <span className="badge pending">待复核</span>}
                    </>
                  ) : (
                    "已删除"
                  )}
                </td>
                <td>
                  <span className={`badge ${n.state}`}>{NODE_STATE_LABEL[n.state]}</span>
                  {n.reasons.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {n.reasons.map((r, i) => (
                        <div key={i}>{r}</div>
                      ))}
                    </div>
                  )}
                </td>
                <td>{fmtDate(n.def.createdAt)}</td>
                <td>
                  <button className="ghost-danger" onClick={() => deleteNode(n.def.id)}>
                    删除留档
                  </button>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  该建筑暂无节点
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>
          节点删除后从关系图移除，但状态变更与删除记录保留在「留档审计」中。
        </p>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Member } from "../types";
import { Badge, Empty, fmtTime, jointBadge, Modal } from "../components/ui";

const CARD_W = 168;
const CARD_H = 76;
const COL_DX = 220;
const ROW_DY = 116;
const PAD = 48;

export function Joints() {
  const { members, joints, derived, addJoint, deleteJoint } = useStore();
  const buildings = useMemo(
    () => Array.from(new Set(members.map((m) => m.building))),
    [members],
  );
  const [building, setBuilding] = useState(buildings[0] ?? "");
  const [showAdd, setShowAdd] = useState(false);
  const [historyOf, setHistoryOf] = useState<string | null>(null);

  const bm = useMemo(
    () => members.filter((m) => m.building === building),
    [members, building],
  );
  const bj = useMemo(
    () => joints.filter((j) => j.building === building),
    [joints, building],
  );
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  // 按轴线分列布局
  const axes = useMemo(
    () => Array.from(new Set(bm.map((m) => m.axis))),
    [bm],
  );
  const pos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const counters = new Map<string, number>();
    for (const m of bm) {
      const col = axes.indexOf(m.axis);
      const row = counters.get(m.axis) ?? 0;
      counters.set(m.axis, row + 1);
      map.set(m.id, {
        x: PAD + col * COL_DX,
        y: PAD + row * ROW_DY,
      });
    }
    return map;
  }, [bm, axes]);

  const boardW = Math.max(420, axes.length * COL_DX + PAD * 2);
  const boardH =
    Math.max(
      260,
      ...axes.map((a) => bm.filter((m) => m.axis === a).length * ROW_DY),
    ) + PAD * 2;

  const historyJoint = historyOf
    ? joints.find((j) => j.id === historyOf)
    : null;

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>单栋建筑构件关系视图</p>
            <h2>榫卯关系图</h2>
          </div>
          <div className="heading-actions">
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <button className="primary" onClick={() => setShowAdd(true)}>
              + 新建关系边
            </button>
          </div>
        </div>

        {bm.length === 0 ? (
          <Empty text="该建筑暂无构件" />
        ) : (
          <div className="graph-scroll">
            <div
              className="graph-board"
              style={{ width: boardW, height: boardH }}
            >
              <svg width={boardW} height={boardH}>
                {bj.map((j) => {
                  const pa = pos.get(j.aId);
                  const pb = pos.get(j.bId);
                  if (!pa || !pb) return null;
                  const ev = derived.jointById.get(j.id)!;
                  const cls =
                    ev.status === "frozen"
                      ? "edge-frozen"
                      : ev.status === "suspended"
                        ? "edge-suspended"
                        : ev.status === "missing"
                          ? "edge-missing"
                          : "edge-ok";
                  return (
                    <line
                      key={j.id}
                      x1={pa.x + CARD_W / 2}
                      y1={pa.y + CARD_H / 2}
                      x2={pb.x + CARD_W / 2}
                      y2={pb.y + CARD_H / 2}
                      className={cls}
                    />
                  );
                })}
              </svg>
              {axes.map((a, i) => (
                <div
                  key={a}
                  className="axis-label"
                  style={{ left: PAD + i * COL_DX, width: CARD_W }}
                >
                  {a}
                </div>
              ))}
              {bm.map((m) => {
                const p = pos.get(m.id)!;
                const st = derived.statusById.get(m.id)!;
                return (
                  <div
                    key={m.id}
                    className={`graph-node ${st === "pending" ? "node-pending" : "node-ok"}`}
                    style={{ left: p.x, top: p.y + 26, width: CARD_W, height: CARD_H }}
                    title={
                      st === "pending"
                        ? derived.blockersById.get(m.id)?.join("；")
                        : m.name
                    }
                  >
                    <b>{m.code}</b>
                    <span>{m.name}</span>
                    <small>
                      {m.tenon} · {m.sectionW}×{m.sectionH} · {m.orientation}
                    </small>
                    {st === "pending" && <em className="node-flag">待复核</em>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <p>两端榫型 / 截面 / 朝向一致性复核</p>
        <h2>节点清单</h2>
        {bj.length === 0 ? (
          <Empty text="该建筑暂无关系节点" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>节点</th>
                  <th>A 端</th>
                  <th>B 端</th>
                  <th>一致性</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {bj.map((j) => {
                  const ev = derived.jointById.get(j.id)!;
                  const a = memberById.get(j.aId);
                  const b = memberById.get(j.bId);
                  return (
                    <tr
                      key={j.id}
                      className={ev.status === "frozen" ? "row-frozen" : ""}
                    >
                      <td>
                        <b>{j.label}</b>
                        <small className="block">
                          建边人 {j.createdBy}
                        </small>
                      </td>
                      <td>
                        {a ? endText(a) : <Badge tone="muted">构件已删除</Badge>}
                      </td>
                      <td>
                        {b ? endText(b) : <Badge tone="muted">构件已删除</Badge>}
                      </td>
                      <td>
                        {ev.reasons.length ? (
                          <span className="reasons">{ev.reasons.join("；")}</span>
                        ) : (
                          <span className="ok-text">榫型 / 截面 / 朝向一致</span>
                        )}
                      </td>
                      <td>{jointBadge(ev.status)}</td>
                      <td className="nowrap">
                        <button onClick={() => setHistoryOf(j.id)}>
                          留档({j.history.length})
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            if (confirm("删除该关系边？")) deleteJoint(j.id);
                          }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && (
        <AddJointModal
          defaultBuilding={building}
          onClose={() => setShowAdd(false)}
          onSubmit={(b, label, aId, bId, by) =>
            addJoint(b, label, aId, bId, by)
          }
        />
      )}

      {historyJoint && (
        <Modal
          title={`旧版留档 · ${historyJoint.label}`}
          onClose={() => setHistoryOf(null)}
          wide
        >
          <JointHistory joint={historyJoint} memberById={memberById} />
        </Modal>
      )}
    </div>
  );
}

function endText(m: Member) {
  return (
    <span>
      <b>{m.code}</b> {m.name}
      <small className="block">
        {m.tenon} · {m.sectionW}×{m.sectionH} · 朝{m.orientation}
      </small>
    </span>
  );
}

function JointHistory({
  joint,
  memberById,
}: {
  joint: ReturnType<typeof useStore>["joints"][number];
  memberById: Map<string, Member>;
}) {
  const curA = memberById.get(joint.aId);
  const curB = memberById.get(joint.bId);
  return (
    <div className="history-stack">
      <div className="alert info">
        节点每次进入冻结状态时，系统自动保存两端构件当时的榫型、截面与朝向快照。
      </div>
      <h4>当前版本</h4>
      <div className="snapshot-pair">
        <SnapshotCard title="A 端（当前）" m={curA} />
        <SnapshotCard title="B 端（当前）" m={curB} />
      </div>
      <h4>冻结留档（{joint.history.length}）</h4>
      {joint.history.length === 0 ? (
        <Empty text="尚无冻结留档" />
      ) : (
        joint.history.map((h, i) => (
          <div key={i} className="archive-entry">
            <div className="archive-meta">
              <Badge tone="bad">冻结快照</Badge>
              <span>{fmtTime(h.at)}</span>
              <span>{h.editor}</span>
            </div>
            <div className="snapshot-pair">
              <SnapshotSnap title="A 端（旧版）" snap={h.a} />
              <SnapshotSnap title="B 端（旧版）" snap={h.b} />
            </div>
            <p className="reasons">{h.note}</p>
          </div>
        ))
      )}
    </div>
  );
}

function SnapshotCard({ title, m }: { title: string; m?: Member }) {
  return (
    <div className="snapshot-card">
      <h5>{title}</h5>
      {m ? (
        <ul>
          <li>{m.code} {m.name}</li>
          <li>榫型：{m.tenon}</li>
          <li>
            截面：{m.sectionW}×{m.sectionH} mm
          </li>
          <li>朝向：{m.orientation}</li>
        </ul>
      ) : (
        <p className="muted">构件已不存在</p>
      )}
    </div>
  );
}

function SnapshotSnap({
  title,
  snap,
}: {
  title: string;
  snap?: {
    code: string;
    tenon: string;
    sectionW: number;
    sectionH: number;
    orientation: string;
  } | null;
}) {
  return (
    <div className="snapshot-card snapshot-old">
      <h5>{title}</h5>
      {snap ? (
        <ul>
          <li>{snap.code}</li>
          <li>榫型：{snap.tenon}</li>
          <li>
            截面：{snap.sectionW}×{snap.sectionH} mm
          </li>
          <li>朝向：{snap.orientation}</li>
        </ul>
      ) : (
        <p className="muted">构件已不存在</p>
      )}
    </div>
  );
}

function AddJointModal({
  defaultBuilding,
  onClose,
  onSubmit,
}: {
  defaultBuilding: string;
  onClose: () => void;
  onSubmit: (
    building: string,
    label: string,
    aId: string,
    bId: string,
    by: string,
  ) => { ok: boolean; errors: string[] };
}) {
  const { members, derived } = useStore();
  const buildings = Array.from(new Set(members.map((m) => m.building)));
  const [building, setBuilding] = useState(defaultBuilding || buildings[0]);
  const [label, setLabel] = useState("");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [by, setBy] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const pool = members.filter((m) => m.building === building);

  const submit = () => {
    const r = onSubmit(building, label, aId, bId, by);
    setErrors(r.ok ? [] : r.errors);
    if (r.ok) onClose();
  };

  const optionFor = (id: string) => {
    const m = pool.find((x) => x.id === id);
    if (!m) return null;
    const st = derived.statusById.get(m.id)!;
    return (
      <option key={m.id} value={m.id} disabled={st === "pending"}>
        {m.axis} · {m.code} {m.name}
        {st === "pending" ? "（待复核，禁止建边）" : ""}
      </option>
    );
  };

  return (
    <Modal title="新建榫卯关系边" onClose={onClose}>
      <div className="form-stack">
        {errors.length > 0 && (
          <div className="alert bad">
            {errors.map((e) => (
              <div key={e}>⚠ {e}</div>
            ))}
          </div>
        )}
        <div className="alert info">
          待复核构件（编号重复 / 尺寸非正 / 含水率超标 / 损伤贯穿）不得生成关系边。
        </div>
        <label>
          <span>所属建筑</span>
          <select
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setAId("");
              setBId("");
            }}
          >
            {buildings.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          <span>节点名称</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="如：五架梁—金柱 燕尾节点"
          />
        </label>
        <div className="field-grid">
          <label>
            <span>A 端构件</span>
            <select value={aId} onChange={(e) => setAId(e.target.value)}>
              <option value="">请选择</option>
              {pool.map((m) => optionFor(m.id))}
            </select>
          </label>
          <label>
            <span>B 端构件</span>
            <select value={bId} onChange={(e) => setBId(e.target.value)}>
              <option value="">请选择</option>
              {pool.map((m) => optionFor(m.id))}
            </select>
          </label>
        </div>
        {aId && bId && (
          <JointPreview aId={aId} bId={bId} />
        )}
        <label>
          <span>建边人</span>
          <input value={by} onChange={(e) => setBy(e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="primary" onClick={submit}>
            建立关系边
          </button>
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </Modal>
  );
}

function JointPreview({ aId, bId }: { aId: string; bId: string }) {
  const { members } = useStore();
  const a = members.find((m) => m.id === aId)!;
  const b = members.find((m) => m.id === bId)!;
  const checks = [
    {
      label: "榫型",
      ok: a.tenon === b.tenon,
      text: `${a.tenon} ↔ ${b.tenon}`,
    },
    {
      label: "截面",
      ok: a.sectionW === b.sectionW && a.sectionH === b.sectionH,
      text: `${a.sectionW}×${a.sectionH} ↔ ${b.sectionW}×${b.sectionH}`,
    },
    {
      label: "朝向",
      ok: a.orientation === b.orientation,
      text: `${a.orientation} ↔ ${b.orientation}`,
    },
  ];
  return (
    <div className="joint-preview">
      {checks.map((c) => (
        <div key={c.label} className={c.ok ? "jp-ok" : "jp-bad"}>
          <span>{c.label}</span>
          <b>{c.text}</b>
          <em>{c.ok ? "一致" : "不符 → 建边后将冻结"}</em>
        </div>
      ))}
    </div>
  );
}

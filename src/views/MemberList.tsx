import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Member, ViewKey } from "../types";
import { TENON_TYPES } from "../domain";
import { Badge, Empty, memberBadge, Modal } from "../components/ui";
import { MemberForm } from "../components/MemberForm";

export function MemberList({ go }: { go: (v: ViewKey) => void }) {
  const { members, derived, addMember, updateMember, deleteMember } = useStore();
  const [building, setBuilding] = useState("全部");
  const [tenon, setTenon] = useState("全部");
  const [status, setStatus] = useState<"全部" | "qualified" | "pending">(
    "全部",
  );
  const [keyword, setKeyword] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const buildings = useMemo(
    () => ["全部", ...Array.from(new Set(members.map((m) => m.building)))],
    [members],
  );

  const rows = members.filter((m) => {
    if (building !== "全部" && m.building !== building) return false;
    if (tenon !== "全部" && m.tenon !== tenon) return false;
    const st = derived.statusById.get(m.id)!;
    if (status !== "全部" && st !== status) return false;
    if (
      keyword &&
      !`${m.code}${m.name}${m.wood}${m.axis}`.includes(keyword.trim())
    )
      return false;
    return true;
  });

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>按建筑 / 轴线 / 构件编号建档</p>
            <h2>构件清单</h2>
          </div>
          <button className="primary" onClick={() => setShowAdd(true)}>
            + 新增构件建档
          </button>
        </div>

        <div className="filter-bar">
          <label>
            建筑
            <select value={building} onChange={(e) => setBuilding(e.target.value)}>
              {buildings.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            榫卯类型
            <select value={tenon} onChange={(e) => setTenon(e.target.value)}>
              <option>全部</option>
              {TENON_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            状态
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as typeof status)
              }
            >
              <option value="全部">全部</option>
              <option value="qualified">合格建档</option>
              <option value="pending">待复核</option>
            </select>
          </label>
          <input
            className="grow"
            placeholder="搜索编号 / 名称 / 木材 / 轴线"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {rows.length === 0 ? (
          <Empty text="没有符合条件的构件" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>建筑 / 轴线 / 编号</th>
                  <th>构件</th>
                  <th>木材</th>
                  <th>榫型</th>
                  <th>截面(mm)</th>
                  <th>朝向</th>
                  <th>含水率</th>
                  <th>病害</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const st = derived.statusById.get(m.id)!;
                  const blockers = derived.blockersById.get(m.id) ?? [];
                  return (
                    <tr
                      key={m.id}
                      className={st === "pending" ? "row-pending" : ""}
                    >
                      <td>
                        <b>{m.building}</b>
                        <small className="block">
                          {m.axis} · {m.code}
                        </small>
                      </td>
                      <td>{m.name}</td>
                      <td>{m.wood}</td>
                      <td>{m.tenon}</td>
                      <td>
                        {m.sectionW}×{m.sectionH}
                      </td>
                      <td>{m.orientation}</td>
                      <td>
                        <span className={m.moisture > 18 ? "text-bad" : ""}>
                          {m.moisture}%
                        </span>
                      </td>
                      <td>
                        {m.damaged ? (
                          <Badge
                            tone={m.damage?.throughSection ? "bad" : "warn"}
                          >
                            {m.damage?.zone}
                            {m.damage?.throughSection ? "·贯穿" : ""}
                          </Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {memberBadge(st)}
                        {st === "pending" && (
                          <small className="block reasons">
                            {blockers.join("；")}
                          </small>
                        )}
                        {m.review && (
                          <small className="block ok-text">
                            复核：{m.review.reviewer}
                          </small>
                        )}
                      </td>
                      <td className="nowrap">
                        <button onClick={() => setEditing(m)}>编辑</button>
                        {st === "pending" && (
                          <button
                            className="primary"
                            onClick={() => go("review")}
                          >
                            去复核
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() => {
                            if (
                              confirm(
                                `删除构件 ${m.code} 将同时删除其关系边，确认？`,
                              )
                            )
                              deleteMember(m.id);
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
        <Modal title="新增构件建档" onClose={() => setShowAdd(false)} wide>
          <MemberForm
            onSubmit={(input) => {
              const r = addMember(input);
              if (r.ok) setShowAdd(false);
              return r;
            }}
            onCancel={() => setShowAdd(false)}
          />
        </Modal>
      )}
      {editing && (
        <Modal
          title={`编辑构件 ${editing.code}（旧版自动留档）`}
          onClose={() => setEditing(null)}
          wide
        >
          <MemberForm
            editing
            initial={editing}
            onSubmit={(input, meta) => {
              const r = updateMember(editing.id, input, meta.editor, meta.reason);
              if (r.ok) setEditing(null);
              return r;
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

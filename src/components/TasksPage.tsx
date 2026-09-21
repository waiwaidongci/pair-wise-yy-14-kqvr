import { useState } from "react";
import { DAMAGE_LABEL, EXTENT_LABEL } from "../domain/constants";
import { useStore } from "../store";
import { TASK_STATE_LABEL } from "./format";

export default function TasksPage() {
  const { state, derived, toggleTask } = useStore();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const tasks = derived.tasks.filter(
    (t) => buildingFilter === "all" || t.buildingId === buildingFilter,
  );
  const buildingName = (id: string) => state.buildings.find((b) => b.id === id)?.name ?? "?";
  const member = (id: string) => derived.memberById.get(id)?.m;

  const groups: { key: "open" | "frozen" | "done"; title: string }[] = [
    { key: "open", title: "待办修缮任务" },
    { key: "frozen", title: "冻结修缮任务（节点不符或下游传播）" },
    { key: "done", title: "已完成" },
  ];

  return (
    <div>
      <section className="panel">
        <div className="toolbar">
          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="all">全部建筑</option>
            {state.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="hint">
            修缮任务仅为「生效且有病害」的构件生成；待复核构件不生成任务，也不产生关系边。
          </span>
        </div>

        {groups.map((g) => {
          const list = tasks.filter((t) => t.state === g.key);
          return (
            <div key={g.key} style={{ marginBottom: 18 }}>
              <h2>
                {g.title}
                <span className="hint" style={{ marginLeft: 8 }}>
                  {list.length} 项
                </span>
              </h2>
              <div className="task-list">
                {list.map((t) => {
                  const m = member(t.memberId);
                  if (!m) return null;
                  return (
                    <div key={t.id} className={`task ${t.state}`}>
                      <input
                        type="checkbox"
                        style={{ width: 18, minHeight: 18 }}
                        checked={t.state === "done"}
                        disabled={t.state === "frozen"}
                        onChange={() => toggleTask(t.memberId)}
                      />
                      <div className="grow">
                        <div className="task-title">
                          {t.title}{" "}
                          <span className={`badge ${t.state}`}>{TASK_STATE_LABEL[t.state]}</span>
                        </div>
                        <div className="task-meta">
                          {buildingName(t.buildingId)} · {m.wood} · 含水率 {m.moisturePct}% · 病害
                          {DAMAGE_LABEL[m.damageType]}（{EXTENT_LABEL[m.damageExtent]}）
                          {m.damageRange ? ` · ${m.damageRange}` : ""}
                        </div>
                        {t.frozenReason && <div className="task-frozen-reason">{t.frozenReason}</div>}
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && <div className="empty">无</div>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

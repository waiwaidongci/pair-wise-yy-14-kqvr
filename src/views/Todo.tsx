import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Empty, taskBadge } from "../components/ui";

export function Todo() {
  const { derived } = useStore();
  const [building, setBuilding] = useState("全部");
  const [state, setState] = useState<"全部" | "active" | "frozen">("全部");

  const buildings = useMemo(
    () => [
      "全部",
      ...Array.from(new Set(derived.tasks.map((t) => t.building))),
    ],
    [derived.tasks],
  );

  const tasks = derived.tasks.filter(
    (t) =>
      (building === "全部" || t.building === building) &&
      (state === "全部" || t.state === state),
  );

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>修缮任务随构件与节点即时派生</p>
            <h2>修缮待办</h2>
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
            <select
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="全部">全部状态</option>
              <option value="active">待办</option>
              <option value="frozen">已冻结</option>
            </select>
          </div>
        </div>

        <div className="alert info">
          待复核构件不生成修缮任务；节点两端榫型 / 截面 / 朝向不符时，节点冻结，关联构件的下游修缮任务一并冻结。上游构件修改后本清单立即重算。
        </div>

        {tasks.length === 0 ? (
          <Empty text="当前没有修缮任务" />
        ) : (
          <div className="todo-list">
            {tasks.map((t) => (
              <article
                key={t.id}
                className={`todo-card ${t.state === "frozen" ? "todo-frozen" : ""}`}
              >
                <div className="todo-main">
                  <h3>
                    {t.building} · {t.code} {t.name}
                  </h3>
                  <p>{t.suggestion}</p>
                  {t.state === "frozen" && (
                    <p className="reasons">冻结原因：{t.frozenReason}</p>
                  )}
                </div>
                <div className="todo-side">{taskBadge(t.state)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

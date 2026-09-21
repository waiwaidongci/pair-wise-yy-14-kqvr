import { useStore } from "../store";
import type { ViewKey } from "../types";

export function Dashboard({ go }: { go: (v: ViewKey) => void }) {
  const { members, derived } = useStore();
  const s = derived.stats;
  const cards = [
    { label: "在档建筑", value: s.buildings, tone: "info" as const },
    { label: "构件总数", value: s.members, tone: "muted" as const },
    { label: "合格建档", value: s.qualified, tone: "ok" as const },
    { label: "待复核", value: s.pending, tone: "warn" as const },
    { label: "病害构件", value: s.damaged, tone: "bad" as const },
    { label: "关系节点", value: s.joints, tone: "info" as const },
    { label: "冻结节点", value: s.jointsFrozen, tone: "bad" as const },
    { label: "待办修缮", value: s.tasksActive, tone: "ok" as const },
    { label: "冻结任务", value: s.tasksFrozen, tone: "warn" as const },
    {
      label: "平均含水率",
      value: `${s.avgMoisture.toFixed(1)}%`,
      tone: s.avgMoisture > 18 ? ("bad" as const) : ("ok" as const),
    },
  ];

  const pending = members.filter(
    (m) => derived.statusById.get(m.id) === "pending",
  );
  const frozenJoints = useStoreJointFreeze();

  return (
    <div className="view-stack">
      <div className="metric-grid">
        {cards.map((c) => (
          <article key={c.label} className={`metric-card metric-${c.tone}`}>
            <small>{c.label}</small>
            <strong>{c.value}</strong>
          </article>
        ))}
      </div>

      <div className="dash-cols">
        <section className="panel">
          <div className="heading">
            <div>
              <p>硬性规则</p>
              <h2>待复核队列（{pending.length}）</h2>
            </div>
            <button onClick={() => go("review")}>前往复核</button>
          </div>
          {pending.length === 0 && <div className="empty">暂无待复核构件</div>}
          <ul className="alert-list">
            {pending.slice(0, 6).map((m) => (
              <li key={m.id}>
                <b>
                  {m.building} · {m.axis} · {m.code}
                </b>
                <span className="reasons">
                  {derived.blockersById.get(m.id)?.join("；")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>节点复核</p>
              <h2>冻结节点（{frozenJoints.length}）</h2>
            </div>
            <button onClick={() => go("joints")}>查看关系图</button>
          </div>
          {frozenJoints.length === 0 && <div className="empty">暂无冻结节点</div>}
          <ul className="alert-list">
            {frozenJoints.slice(0, 6).map(({ joint, ev }) => (
              <li key={joint.id}>
                <b>{joint.label}</b>
                <span className="reasons">{ev.reasons.join("；")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel rules-panel">
        <p>工作台规则</p>
        <h2>测绘复核流程</h2>
        <ol>
          <li>按 <b>建筑 → 轴线 → 构件编号</b> 建档，录入木材、榫型、截面、朝向、含水率与病害范围。</li>
          <li>出现 <b>编号重复、尺寸非正、含水率 &gt; 18%、损伤贯穿截面</b> 任一情况，构件只能进入待复核，不生成关系边与修缮任务。</li>
          <li>复核须 <b>换人</b> 填写实测值；实测仍不达标则不予通过。</li>
          <li>节点两端 <b>榫型 / 截面 / 朝向</b> 不符即冻结节点及其下游修缮任务，冻结时旧版数据自动留档。</li>
          <li>上游构件修改后，关联节点、任务与统计立即按新值重算；数据持久化，刷新后状态一致。</li>
        </ol>
      </section>
    </div>
  );
}

function useStoreJointFreeze() {
  const { joints, derived } = useStore();
  return joints
    .map((j) => ({ joint: j, ev: derived.jointById.get(j.id)! }))
    .filter((x) => x.ev?.status === "frozen");
}

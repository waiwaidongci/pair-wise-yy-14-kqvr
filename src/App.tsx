import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import MembersPage from "./components/MembersPage";
import NodesPage from "./components/NodesPage";
import TasksPage from "./components/TasksPage";
import ArchivePage from "./components/ArchivePage";
import { MOISTURE_LIMIT } from "./domain/constants";

const USERS = ["王测绘", "李复核", "张工长"];

type Tab = "members" | "nodes" | "tasks" | "archive";

const TABS: { key: Tab; label: string }[] = [
  { key: "members", label: "构件建档与复核" },
  { key: "nodes", label: "节点与关系图" },
  { key: "tasks", label: "修缮待办" },
  { key: "archive", label: "留档审计" },
];

function Shell() {
  const { state, derived, setUser, resetAll } = useStore();
  const [tab, setTab] = useState<Tab>("members");
  const s = derived.stats;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <h1>木构榫卯测绘复核台</h1>
          <p>按建筑 / 轴线 / 构件编号建档 · 硬性校验不通过一律待复核 · 换人实测复核</p>
        </div>
        <div className="userbox">
          当前操作人
          <select value={state.user} onChange={(e) => setUser(e.target.value)}>
            {USERS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (confirm("恢复演示数据？当前本地修改将被清空。")) resetAll();
            }}
          >
            重置演示数据
          </button>
        </div>
      </header>

      <div className="rules">
        <b>硬性红线：</b>
        编号重复、截面尺寸非正、含水率超过 {MOISTURE_LIMIT}%、损伤贯穿截面 ——
        命中任一条只能进入<b>待复核</b>，不生成关系边与修缮任务；复核须由
        <b>非建档人</b>填写实测值。节点两端榫型 / 截面 / 朝向不符即<b>冻结</b>该节点及
        <b>下游修缮任务</b>，旧版留档。上游构件任何改录，节点、任务、统计立即重算，清单 /
        关系图 / 待办 / 刷新后状态保持一致。
      </div>

      <section className="metrics">
        <article className="metric accent">
          <small>构件（生效）</small>
          <strong>
            {s.activeCount}
            <small style={{ fontWeight: 400 }}> / {s.memberCount}</small>
          </strong>
        </article>
        <article className="metric warn">
          <small>待复核构件</small>
          <strong>{s.pendingCount}</strong>
        </article>
        <article className="metric accent">
          <small>节点（相符 / 冻结 / 阻断）</small>
          <strong>
            {s.normalCount}
            <small style={{ fontWeight: 400, color: "var(--danger)" }}> / {s.frozenCount}</small>
            <small style={{ fontWeight: 400 }}> / {s.blockedCount}</small>
          </strong>
        </article>
        <article className="metric">
          <small>修缮任务（待办）</small>
          <strong>{s.taskOpen}</strong>
        </article>
        <article className="metric danger">
          <small>冻结任务</small>
          <strong>{s.taskFrozen}</strong>
        </article>
        <article className="metric">
          <small>平均含水率（生效件）</small>
          <strong>{s.avgMoisture === null ? "—" : `${s.avgMoisture}%`}</strong>
        </article>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "members" && <MembersPage />}
      {tab === "nodes" && <NodesPage />}
      {tab === "tasks" && <TasksPage />}
      {tab === "archive" && <ArchivePage />}
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

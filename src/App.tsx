import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import type { ViewKey } from "./types";
import { Dashboard } from "./views/Dashboard";
import { MemberList } from "./views/MemberList";
import { Dimensions } from "./views/Dimensions";
import { Disease } from "./views/Disease";
import { Joints } from "./views/Joints";
import { ReviewQueue } from "./views/ReviewQueue";
import { Todo } from "./views/Todo";
import { Archive } from "./views/Archive";

const NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "复核总览", icon: "▦" },
  { key: "members", label: "构件清单", icon: "☷" },
  { key: "dimensions", label: "尺寸记录表", icon: "📏" },
  { key: "disease", label: "病害标记图", icon: "✹" },
  { key: "joints", label: "关系视图", icon: "⫸" },
  { key: "review", label: "待复核", icon: "⚑" },
  { key: "todo", label: "修缮待办", icon: "🔨" },
  { key: "archive", label: "旧版留档", icon: "❏" },
];

function Shell() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const { derived, resetAll } = useStore();
  const s = derived.stats;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">榫</div>
          <div>
            <h1>木构榫卯</h1>
            <p>测绘复核台</p>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={view === n.key ? "nav-on" : ""}
              onClick={() => setView(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {n.key === "review" && s.pending > 0 && (
                <em className="nav-dot">{s.pending}</em>
              )}
              {n.key === "joints" && s.jointsFrozen > 0 && (
                <em className="nav-dot dot-bad">{s.jointsFrozen}</em>
              )}
              {n.key === "todo" && s.tasksFrozen > 0 && (
                <em className="nav-dot dot-warn">{s.tasksFrozen}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            onClick={() => {
              if (confirm("清空全部本地数据并恢复示例？")) resetAll();
            }}
          >
            重置示例数据
          </button>
          <p>数据保存在本机浏览器，刷新后状态一致</p>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h2>{NAV.find((n) => n.key === view)?.label}</h2>
            <p>
              {s.buildings} 栋建筑 · {s.members} 个构件 · {s.qualified} 合格 /{" "}
              <b className={s.pending ? "text-bad" : ""}>{s.pending} 待复核</b>{" "}
              · {s.jointsOk} 节点吻合 / {s.jointsFrozen} 冻结 ·{" "}
              {s.tasksActive + s.tasksFrozen} 项修缮任务
            </p>
          </div>
          <div className="topbar-badges">
            <span className="top-chip">
              平均含水率 {s.avgMoisture.toFixed(1)}%
            </span>
          </div>
        </header>
        <div className="view-body">
          {view === "dashboard" && <Dashboard go={setView} />}
          {view === "members" && <MemberList go={setView} />}
          {view === "dimensions" && <Dimensions />}
          {view === "disease" && <Disease />}
          {view === "joints" && <Joints />}
          {view === "review" && <ReviewQueue />}
          {view === "todo" && <Todo />}
          {view === "archive" && <Archive />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

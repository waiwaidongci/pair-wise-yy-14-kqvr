import { useState } from "react";
import {
  DAMAGE_LABEL,
  EXTENT_LABEL,
  FACING_LABEL,
  TENON_LABEL,
} from "../domain/constants";
import { useStore } from "../store";
import type { MemberSnap, NodeState } from "../types";
import { fmtDate, memberLabel, NODE_STATE_LABEL, sectionText } from "./format";

const STATE_BADGE: Record<NodeState, string> = {
  normal: "normal",
  frozen: "frozen",
  blocked: "blocked",
};

function snapFields(s: MemberSnap): [string, string][] {
  return [
    ["建筑", s.buildingId],
    ["轴线", s.axis],
    ["编号", s.code],
    ["木材", s.wood],
    ["榫型", TENON_LABEL[s.tenon]],
    ["截面", sectionText(s)],
    ["朝向", FACING_LABEL[s.facing]],
    ["含水率", `${s.moisturePct}%`],
    ["病害", `${DAMAGE_LABEL[s.damageType]}（${EXTENT_LABEL[s.damageExtent]}）`],
    ["范围", s.damageRange || "—"],
    ["备注", s.note || "—"],
  ];
}

function NodeArchive() {
  const { state, derived } = useStore();
  const allNodes: { id: string; code: string; buildingId: string }[] = [
    ...derived.nodes.map((n) => ({ id: n.def.id, code: n.def.code, buildingId: n.def.buildingId })),
    ...Object.keys(state.nodeHistory)
      .filter((id) => !state.nodes.some((n) => n.id === id))
      .map((id) => {
        const hist = state.nodeHistory[id] ?? [];
        const first = hist[0];
        const members = state.members;
        const code =
          members.find((m) => m.id === first?.aId)?.axis ?? "节点";
        return { id, code: `（已删）${code}`, buildingId: members.find((m) => m.id === first?.aId)?.buildingId ?? "" };
      }),
  ];
  const buildingName = (id: string) => state.buildings.find((b) => b.id === id)?.name ?? "?";

  return (
    <div className="timeline">
      {allNodes.length === 0 && <div className="empty">暂无节点留档</div>}
      {allNodes.map(({ id, code, buildingId }) => {
        const hist = state.nodeHistory[id] ?? [];
        return (
          <div key={id} className="panel" style={{ marginBottom: 10 }}>
            <h2>
              {code} <span className="hint">{buildingName(buildingId)}</span>
            </h2>
            <div className="timeline">
              {[...hist].reverse().map((e) => (
                <div key={`${id}-${e.at}-${e.action}`} className={`tl-item ${e.toState}`}>
                  <div>
                    <b>{e.action}</b> · {e.by} · <span className="tl-time">{fmtDate(e.at)}</span>{" "}
                    {e.fromState && (
                      <>
                        <span className={`badge ${STATE_BADGE[e.fromState]}`}>
                          {NODE_STATE_LABEL[e.fromState]}
                        </span>{" "}
                        →{" "}
                      </>
                    )}
                    <span className={`badge ${STATE_BADGE[e.toState]}`}>{NODE_STATE_LABEL[e.toState]}</span>
                  </div>
                  {e.reasons.length > 0 && (
                    <div className="hint" style={{ color: "var(--danger)" }}>
                      {e.reasons.join("；")}
                    </div>
                  )}
                  {(e.aId || e.bId) && (
                    <div className="hint">
                      两端：{e.aId ? state.members.find((m) => m.id === e.aId)?.code ?? e.aId : "—"}
                      {" ↔ "}
                      {e.bId ? state.members.find((m) => m.id === e.bId)?.code ?? e.bId : "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemberArchive() {
  const { state } = useStore();
  const buildingName = (id: string) => state.buildings.find((b) => b.id === id)?.name ?? "?";

  return (
    <div>
      {state.members.map((m) => (
        <div key={m.id} className="panel" style={{ marginBottom: 10 }}>
          <h2>
            {buildingName(m.buildingId)} · {memberLabel(m)}
            <span className="hint">
              {" "}
              共 {m.history.length} 版（建档/改录/复核更新全部留档）
            </span>
          </h2>
          <div className="timeline">
            {[...m.history].reverse().map((v, idx, arr) => {
              const prev = arr[idx + 1]?.snap; // 时间上更早的一版
              const cur = v.snap;
              return (
                <div key={`${m.id}-${v.at}`} className="tl-item">
                  <div>
                    <b>{v.reason}</b> · {v.by} · <span className="tl-time">{fmtDate(v.at)}</span>
                  </div>
                  <div className="snapdiff" style={{ marginTop: 6 }}>
                    <span className="hd">字段</span>
                    <span className="hd">{prev ? "旧值" : "初始值"}</span>
                    <span className="hd">新值</span>
                    {snapFields(cur).map(([key, val], i) => {
                      const oldVal = prev ? snapFields(prev)[i][1] : "";
                      const changed = prev ? oldVal !== val : false;
                      return (
                        <div key={key} style={{ display: "contents" }}>
                          <span className="hd">{key}</span>
                          <span className={changed ? "changed" : ""}>{prev ? oldVal : "—"}</span>
                          <span className={changed ? "changed" : ""}>{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {state.members.length === 0 && <div className="empty">暂无构件留档</div>}
    </div>
  );
}

export default function ArchivePage() {
  const [tab, setTab] = useState<"node" | "member">("node");
  return (
    <div>
      <div className="tabs">
        <button className={tab === "node" ? "active" : ""} onClick={() => setTab("node")}>
          节点旧版留档
        </button>
        <button className={tab === "member" ? "active" : ""} onClick={() => setTab("member")}>
          构件版本留档
        </button>
      </div>
      {tab === "node" ? <NodeArchive /> : <MemberArchive />}
    </div>
  );
}

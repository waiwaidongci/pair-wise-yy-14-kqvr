import { useState } from "react";
import { useStore } from "../store";
import { Badge, Empty, fmtTime } from "../components/ui";
import type { MemberSnapshot } from "../types";

/** 旧版留档：构件修改历史 + 节点冻结快照 */
export function Archive() {
  const { members, joints } = useStore();
  const [tab, setTab] = useState<"member" | "joint">("member");

  const memberVersions = members
    .filter((m) => m.versions.length > 0)
    .flatMap((m) =>
      m.versions.map((v) => ({ member: m, version: v })),
    )
    .sort((a, b) => (a.version.savedAt < b.version.savedAt ? 1 : -1));

  const jointArchives = joints
    .filter((j) => j.history.length > 0)
    .flatMap((j) => j.history.map((h) => ({ joint: j, entry: h })))
    .sort((a, b) => (a.entry.at < b.entry.at ? 1 : -1));

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>修改即留痕，冻结即存档</p>
            <h2>旧版留档</h2>
          </div>
          <div className="segmented">
            <button
              className={tab === "member" ? "seg-on" : ""}
              onClick={() => setTab("member")}
            >
              构件旧版（{memberVersions.length}）
            </button>
            <button
              className={tab === "joint" ? "seg-on" : ""}
              onClick={() => setTab("joint")}
            >
              节点冻结快照（{jointArchives.length}）
            </button>
          </div>
        </div>

        {tab === "member" ? (
          memberVersions.length === 0 ? (
            <Empty text="尚无构件修改记录" />
          ) : (
            <div className="archive-timeline">
              {memberVersions.map(({ member, version }, i) => (
                <div key={`${member.id}-${i}`} className="archive-entry">
                  <div className="archive-meta">
                    <Badge tone="info">构件旧版</Badge>
                    <b>
                      {member.building} · {member.axis} · {member.code}{" "}
                      {member.name}
                    </b>
                    <span>{fmtTime(version.savedAt)}</span>
                    <span>操作人：{version.editor}</span>
                  </div>
                  <p>修改原因：{version.reason}</p>
                  <SnapshotTable data={version.data} />
                </div>
              ))}
            </div>
          )
        ) : jointArchives.length === 0 ? (
          <Empty text="尚无节点冻结留档" />
        ) : (
          <div className="archive-timeline">
            {jointArchives.map(({ joint, entry }, i) => (
              <div key={`${joint.id}-${i}`} className="archive-entry">
                <div className="archive-meta">
                  <Badge tone="bad">冻结快照</Badge>
                  <b>{joint.label}</b>
                  <span>{fmtTime(entry.at)}</span>
                  <span>{entry.editor}</span>
                </div>
                <p className="reasons">{entry.note}</p>
                <div className="snapshot-pair">
                  <EndSnap title="A 端旧版" snap={entry.a} />
                  <EndSnap title="B 端旧版" snap={entry.b} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SnapshotTable({ data }: { data: MemberSnapshot }) {
  const rows: [string, string][] = [
    ["构件名称", data.name],
    ["木材种类", data.wood],
    ["榫卯类型", data.tenon],
    ["截面尺寸", `${data.sectionW}×${data.sectionH} mm`],
    ["朝向", data.orientation],
    ["含水率", `${data.moisture}%`],
    [
      "病害",
      data.damaged
        ? `${data.damage?.zone ?? ""}${data.damage?.throughSection ? "（贯穿截面）" : ""} ${data.damage?.scope ?? ""}`
        : "无",
    ],
    ["修缮建议", data.repairSuggestion || "—"],
  ];
  return (
    <div className="table-wrap">
      <table className="data-table compact">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndSnap({
  title,
  snap,
}: {
  title: string;
  snap:
    | { code: string; tenon: string; sectionW: number; sectionH: number; orientation: string }
    | null;
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

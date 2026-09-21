import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Empty } from "../components/ui";
import type { DamageZone, Member } from "../types";

const COLUMN_ZONES: DamageZone[] = ["柱顶", "柱中", "柱脚"];
const BEAM_ZONES: DamageZone[] = ["梁端", "梁中", "梁端"];

/** 病害标记图：按建筑展示构件示意，病害部位着色，贯穿截面整段红框 */
export function Disease() {
  const { members, derived } = useStore();
  const buildings = useMemo(
    () => Array.from(new Set(members.map((m) => m.building))),
    [members],
  );
  const [building, setBuilding] = useState(buildings[0] ?? "");

  const list = members.filter((m) => m.building === building);
  const damaged = list.filter((m) => m.damaged);

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>病害位置标记 · 贯穿截面判定</p>
            <h2>病害标记图</h2>
          </div>
          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>

        {list.length === 0 ? (
          <Empty text="该建筑暂无构件" />
        ) : (
          <>
            <div className="legend">
              <span>
                <i className="swatch swatch-none" /> 无病害
              </span>
              <span>
                <i className="swatch swatch-part" /> 局部病害（未贯穿）
              </span>
              <span>
                <i className="swatch swatch-through" /> 损伤贯穿截面（待复核）
              </span>
            </div>
            <div className="marking-board">
              {list.map((m) => {
                const st = derived.statusById.get(m.id)!;
                const isColumn = m.name.includes("柱");
                return (
                  <article
                    key={m.id}
                    className={`mark-card ${
                      m.damage?.throughSection
                        ? "mark-through"
                        : m.damaged
                          ? "mark-part"
                          : ""
                    } ${st === "pending" ? "mark-pending" : ""}`}
                  >
                    <header>
                      <b>
                        {m.axis} · {m.code}
                      </b>
                      <span>{m.name}</span>
                      {m.damaged ? (
                        <Badge
                          tone={m.damage?.throughSection ? "bad" : "warn"}
                        >
                          {m.damage?.zone}
                          {m.damage?.throughSection ? " · 贯穿" : ""}
                        </Badge>
                      ) : (
                        <Badge tone="muted">完好</Badge>
                      )}
                    </header>
                    <div
                      className={`mark-figure ${
                        isColumn ? "fig-column" : "fig-beam"
                      }`}
                    >
                      {isColumn
                        ? COLUMN_ZONES.map((z, i) => (
                            <ZoneCell
                              key={i}
                              zone={z}
                              member={m}
                              zoneKey={z}
                            />
                          ))
                        : BEAM_ZONES.map((z, i) => (
                            <ZoneCell
                              key={i}
                              zone={i === 2 ? "梁端(另一)" : z}
                              member={m}
                              zoneKey={z}
                            />
                          ))}
                    </div>
                    <footer>
                      {m.damaged ? (
                        <span>{m.damage?.scope || "未填写范围描述"}</span>
                      ) : (
                        <span className="muted">无登记病害</span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <p>截面判定</p>
        <h2>贯穿截面病害一览（{damaged.filter((m) => m.damage?.throughSection).length}）</h2>
        {damaged.length === 0 ? (
          <Empty text="该建筑暂无病害构件" />
        ) : (
          <div className="section-grid">
            {damaged.map((m) => (
              <div
                key={m.id}
                className={`section-card ${
                  m.damage?.throughSection ? "sec-through" : "sec-part"
                }`}
              >
                <div className="cross-section">
                  {m.damage?.throughSection ? (
                    <div className="cross-fill-through">
                      <span>贯穿</span>
                    </div>
                  ) : (
                    <div className="cross-fill-part">
                      <span>局部</span>
                    </div>
                  )}
                </div>
                <div>
                  <b>
                    {m.code} {m.name}
                  </b>
                  <small className="block">
                    {m.damage?.zone} · {m.sectionW}×{m.sectionH}mm
                  </small>
                  <small className="block">
                    {m.damage?.throughSection
                      ? "损伤贯穿截面 → 待复核，冻结建边与任务"
                      : "未贯穿截面，可按合格流程建档"}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ZoneCell({
  zone,
  zoneKey,
  member,
}: {
  zone: string;
  zoneKey: DamageZone;
  member: Member;
}) {
  const hit = member.damaged && member.damage?.zone === zoneKey;
  const through = member.damage?.throughSection;
  return (
    <div
      className={`zone-cell ${
        hit ? (through ? "zone-through" : "zone-part") : "zone-ok"
      }`}
      title={zone}
    >
      {hit && (through ? "✕" : "◒")}
      <small>{zone}</small>
    </div>
  );
}

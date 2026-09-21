import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Empty, memberBadge } from "../components/ui";

/** 尺寸记录表：只展示截面/含水率等实测字段，待复核行高亮隔离 */
export function Dimensions() {
  const { members, derived } = useStore();
  const [building, setBuilding] = useState("全部");

  const buildings = useMemo(
    () => ["全部", ...Array.from(new Set(members.map((m) => m.building)))],
    [members],
  );
  const rows = members.filter(
    (m) => building === "全部" || m.building === building,
  );

  const exportCsv = () => {
    const head = [
      "建筑",
      "轴线",
      "构件编号",
      "名称",
      "榫型",
      "截面宽mm",
      "截面高mm",
      "朝向",
      "含水率%",
      "状态",
      "复核人",
      "实测宽mm",
      "实测高mm",
      "实测含水率%",
    ];
    const lines = rows.map((m) => {
      const st = derived.statusById.get(m.id)!;
      return [
        m.building,
        m.axis,
        m.code,
        m.name,
        m.tenon,
        m.sectionW,
        m.sectionH,
        m.orientation,
        m.moisture,
        st === "qualified" ? "合格" : "待复核",
        m.review?.reviewer ?? "",
        m.review?.measuredW ?? "",
        m.review?.measuredH ?? "",
        m.review?.measuredMoisture ?? "",
      ].join(",");
    });
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "榫卯构件尺寸记录表.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>截面尺寸 / 含水率记录</p>
            <h2>尺寸记录表</h2>
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
            <button onClick={exportCsv}>导出CSV</button>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty text="暂无记录" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>建筑 / 轴线</th>
                  <th>编号</th>
                  <th>名称</th>
                  <th>登记截面</th>
                  <th>朝向</th>
                  <th>登记含水率</th>
                  <th>复核实测截面</th>
                  <th>实测含水率</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const st = derived.statusById.get(m.id)!;
                  return (
                    <tr
                      key={m.id}
                      className={st === "pending" ? "row-pending" : ""}
                    >
                      <td>
                        {m.building}
                        <small className="block">{m.axis}</small>
                      </td>
                      <td>
                        <b>{m.code}</b>
                      </td>
                      <td>{m.name}</td>
                      <td>
                        {m.sectionW}×{m.sectionH}
                        {!(m.sectionW > 0 && m.sectionH > 0) && (
                          <small className="block text-bad">尺寸非正</small>
                        )}
                      </td>
                      <td>{m.orientation}</td>
                      <td>
                        <span className={m.moisture > 18 ? "text-bad" : ""}>
                          {m.moisture}%
                        </span>
                      </td>
                      <td>
                        {m.review
                          ? `${m.review.measuredW}×${m.review.measuredH}`
                          : "—"}
                      </td>
                      <td>
                        {m.review
                          ? `${m.review.measuredMoisture}%`
                          : "—"}
                      </td>
                      <td>{memberBadge(st)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

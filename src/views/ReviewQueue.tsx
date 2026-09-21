import { useState } from "react";
import { MOISTURE_LIMIT, hardBlockers } from "../domain";
import { useStore } from "../store";
import type { Member } from "../types";
import { Badge, Empty, fmtTime } from "../components/ui";

export function ReviewQueue() {
  const { members, derived, submitReview, invalidateReview } = useStore();
  const pending = members.filter(
    (m) => derived.statusById.get(m.id) === "pending",
  );
  const reviewed = members.filter((m) => m.review?.passed);
  const [active, setActive] = useState<Member | null>(
    pending[0] ?? null,
  );

  const current = active && members.find((m) => m.id === active.id);
  const currentPending = current && pending.some((m) => m.id === current.id)
    ? current
    : null;

  return (
    <div className="view-stack review-layout">
      <section className="panel">
        <div className="heading">
          <div>
            <p>编号重复 / 尺寸非正 / 含水率&gt;{MOISTURE_LIMIT}% / 贯穿损伤</p>
            <h2>待复核队列（{pending.length}）</h2>
          </div>
        </div>
        {pending.length === 0 ? (
          <Empty text="没有待复核构件，全部数据满足硬性规则" />
        ) : (
          <ul className="queue-list">
            {pending.map((m) => (
              <li
                key={m.id}
                className={current?.id === m.id ? "queue-active" : ""}
                onClick={() => setActive(m)}
              >
                <b>
                  {m.building} · {m.axis} · {m.code}
                </b>
                <span>{m.name}</span>
                <div className="reason-tags">
                  {derived.blockersById.get(m.id)!.map((r) => (
                    <Badge key={r} tone="warn">
                      {r}
                    </Badge>
                  ))}
                </div>
                <small>录入人：{m.recorder}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        {!currentPending ? (
          current ? (
            <div className="review-done">
              <h2>{current.code} 已复核通过</h2>
              <ReviewSummary m={current} />
            </div>
          ) : (
            <Empty text="选择左侧构件开始复核" />
          )
        ) : (
          <ReviewForm
            key={currentPending.id}
            m={currentPending}
            onSubmit={(reviewer, measured, opinion) =>
              submitReview(
                currentPending.id,
                reviewer,
                measured,
                opinion,
              )
            }
          />
        )}
      </section>

      <section className="panel">
        <p>已留痕的复核记录</p>
        <h2>复核台账（{reviewed.length}）</h2>
        {reviewed.length === 0 ? (
          <Empty text="尚无复核通过记录" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>构件</th>
                  <th>录入人</th>
                  <th>复核人</th>
                  <th>实测截面</th>
                  <th>实测含水率</th>
                  <th>复核时间</th>
                  <th>意见</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.building} · {m.code} {m.name}
                    </td>
                    <td>{m.recorder}</td>
                    <td>
                      <Badge tone="ok">{m.review!.reviewer}</Badge>
                    </td>
                    <td>
                      {m.review!.measuredW}×{m.review!.measuredH}
                    </td>
                    <td>{m.review!.measuredMoisture}%</td>
                    <td>{fmtTime(m.review!.at)}</td>
                    <td>{m.review!.opinion || "—"}</td>
                    <td>
                      <button
                        className="danger"
                        onClick={() => {
                          const who = prompt("撤销复核将退回待复核。操作人：");
                          if (who !== null) invalidateReview(m.id, who);
                        }}
                      >
                        撤销
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewSummary({ m }: { m: Member }) {
  return (
    <div className="review-summary">
      <div className="alert ok">
        {m.code} 已由 {m.review!.reviewer} 复核通过，实测值已写回并参与节点/任务重算。
      </div>
      <ul>
        <li>实测截面：{m.review!.measuredW}×{m.review!.measuredH} mm</li>
        <li>实测含水率：{m.review!.measuredMoisture}%</li>
        <li>
          贯穿截面：
          {m.review!.measuredThrough ? "是" : "否"}
        </li>
        <li>复核意见：{m.review!.opinion || "（无）"}</li>
        <li>复核时间：{fmtTime(m.review!.at)}</li>
      </ul>
    </div>
  );
}

function ReviewForm({
  m,
  onSubmit,
}: {
  m: Member;
  onSubmit: (
    reviewer: string,
    measured: { w: number; h: number; moisture: number; through: boolean },
    opinion: string,
  ) => { ok: boolean; errors: string[] };
}) {
  const [reviewer, setReviewer] = useState("");
  const [w, setW] = useState<number>(m.sectionW > 0 ? m.sectionW : 0);
  const [h, setH] = useState<number>(m.sectionH > 0 ? m.sectionH : 0);
  const [moisture, setMoisture] = useState<number>(
    m.moisture > 0 ? m.moisture : 0,
  );
  const [through, setThrough] = useState<boolean>(
    m.damage?.throughSection ?? false,
  );
  const [opinion, setOpinion] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const num = (v: string) => (v === "" ? 0 : Number(v));
  const live = hardBlockers({
    sectionW: w,
    sectionH: h,
    moisture,
    damaged: true,
    damage: { throughSection: through } as Member["damage"],
    review: null,
  });

  const submit = () => {
    const r = onSubmit(reviewer, { w, h, moisture, through }, opinion);
    if (r.ok) {
      setErrors([]);
      setDone(true);
    } else {
      setErrors(r.errors);
    }
  };

  if (done) {
    return (
      <div className="alert ok">
        复核通过，构件已转为合格建档，关联节点、修缮任务与统计已立即重算。
      </div>
    );
  }

  return (
    <div className="form-stack">
      <div className="heading">
        <div>
          <p>第二人现场实测</p>
          <h2>
            复核 {m.building} · {m.axis} · {m.code}（{m.name}）
          </h2>
        </div>
      </div>

      <div className="review-register">
        <table className="data-table">
          <tbody>
            <tr>
              <th>登记值</th>
              <td>
                {m.sectionW}×{m.sectionH} mm · 含水率 {m.moisture}% · 贯穿
                {m.damage?.throughSection ? "是" : "否"}
              </td>
            </tr>
            <tr>
              <th>录入人</th>
              <td>{m.recorder}（复核人不得相同）</td>
            </tr>
            <tr>
              <th>待复核原因</th>
              <td className="reasons">{hardBlockers(m).join("；") || "编号重复"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <div className="alert bad">
          {errors.map((e) => (
            <div key={e}>⚠ {e}</div>
          ))}
        </div>
      )}

      <div className="field-grid">
        <label>
          <span>复核人（须换人）*</span>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="不得与录入人相同"
          />
        </label>
        <label>
          <span>实测截面宽 (mm) *</span>
          <input
            type="number"
            value={w || ""}
            onChange={(e) => setW(num(e.target.value))}
          />
        </label>
        <label>
          <span>实测截面高 (mm) *</span>
          <input
            type="number"
            value={h || ""}
            onChange={(e) => setH(num(e.target.value))}
          />
        </label>
        <label>
          <span>实测含水率 (%) *</span>
          <input
            type="number"
            step="0.1"
            value={moisture || ""}
            onChange={(e) => setMoisture(num(e.target.value))}
          />
          <small className={moisture > MOISTURE_LIMIT ? "hint-bad" : ""}>
            限值 ≤ {MOISTURE_LIMIT}%
          </small>
        </label>
        <label>
          <span>实测是否贯穿截面 *</span>
          <select
            value={through ? "1" : "0"}
            onChange={(e) => setThrough(e.target.value === "1")}
          >
            <option value="0">未贯穿</option>
            <option value="1">仍贯穿（不予通过）</option>
          </select>
        </label>
      </div>
      <label className="full-line">
        <span>复核意见</span>
        <textarea
          rows={2}
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          placeholder="现场复测情况说明"
        />
      </label>

      {live.length > 0 ? (
        <div className="alert warn">
          实测值仍不满足：{live.join("；")}，无法通过复核。
        </div>
      ) : (
        <div className="alert ok">实测值满足全部硬性指标，可提交复核结论。</div>
      )}

      <div className="form-actions">
        <button className="primary" onClick={submit}>
          提交复核实测值
        </button>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  DAMAGE_LABEL,
  DAMAGE_OPTIONS,
  EXTENT_LABEL,
  EXTENT_OPTIONS,
  FACING_OPTIONS,
  MOISTURE_LIMIT,
  TENON_OPTIONS,
} from "../domain/constants";
import type { Member, Tenon } from "../types";
import { useStore, type MemberDraft } from "../store";
import { damageText, fmtDate, fullMemberDesc, memberLabel, sectionText } from "./format";

const USERS = ["王测绘", "李复核", "张工长"];

function emptyDraft(buildingId: string): MemberDraft {
  return {
    buildingId,
    axis: "",
    code: "",
    wood: "杉木",
    tenon: "tou",
    widthMm: 200,
    heightMm: 200,
    facing: "E",
    moisturePct: 12,
    damageType: "none",
    damageExtent: "local",
    note: "",
    damageRange: "",
  };
}

function draftOf(m: Member): MemberDraft {
  const { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note } = m;
  return { buildingId, axis, code, wood, tenon, widthMm, heightMm, facing, moisturePct, damageType, damageExtent, damageRange, note };
}

function MemberForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: MemberDraft;
  submitLabel: string;
  onSubmit: (d: MemberDraft) => void;
  onCancel?: () => void;
}) {
  const { state } = useStore();
  const [d, setD] = useState<MemberDraft>(initial);
  const set = <K extends keyof MemberDraft>(k: K, v: MemberDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="form-grid">
        <label className="field">
          <span>建筑</span>
          <select value={d.buildingId} onChange={(e) => set("buildingId", e.target.value)}>
            {state.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>轴线 *</span>
          <input value={d.axis} placeholder="如 轴2 / 甲轴" onChange={(e) => set("axis", e.target.value)} />
        </label>
        <label className="field">
          <span>构件编号 *</span>
          <input value={d.code} placeholder="如 Z-02" onChange={(e) => set("code", e.target.value)} />
        </label>
        <label className="field">
          <span>木材种类</span>
          <input value={d.wood} onChange={(e) => set("wood", e.target.value)} />
        </label>
        <label className="field">
          <span>榫型</span>
          <select value={d.tenon} onChange={(e) => set("tenon", e.target.value as Tenon)}>
            {TENON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>榫头朝向</span>
          <select value={d.facing} onChange={(e) => set("facing", e.target.value as MemberDraft["facing"])}>
            {FACING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                朝{o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>截面宽 mm（须为正数）</span>
          <input type="number" value={d.widthMm} onChange={(e) => set("widthMm", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>截面高 mm（须为正数）</span>
          <input type="number" value={d.heightMm} onChange={(e) => set("heightMm", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>含水率 %（红线 {MOISTURE_LIMIT}%）</span>
          <input type="number" step="0.1" value={d.moisturePct} onChange={(e) => set("moisturePct", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>病害类型</span>
          <select value={d.damageType} onChange={(e) => set("damageType", e.target.value as MemberDraft["damageType"])}>
            {DAMAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>病害范围</span>
          <select
            value={d.damageExtent}
            disabled={d.damageType === "none"}
            onChange={(e) => set("damageExtent", e.target.value as MemberDraft["damageExtent"])}
          >
            {EXTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>病害范围描述</span>
          <input value={d.damageRange} placeholder="如 柱脚东侧糟朽30cm" onChange={(e) => set("damageRange", e.target.value)} />
        </label>
        <label className="field wide">
          <span>备注</span>
          <textarea value={d.note} onChange={(e) => set("note", e.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary" onClick={() => onSubmit(d)} disabled={!d.axis.trim() || !d.code.trim()}>
          {submitLabel}
        </button>
        {onCancel && <button onClick={onCancel}>取消</button>}
      </div>
    </div>
  );
}

function ReviewModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { submitReview, state } = useStore();
  const [reviewer, setReviewer] = useState(state.user === member.recorder ? "" : state.user);
  const [opinion, setOpinion] = useState("");
  const [widthMm, setWidth] = useState(member.widthMm);
  const [heightMm, setHeight] = useState(member.heightMm);
  const [moisturePct, setMoisture] = useState(member.moisturePct);
  const [damageExtent, setExtent] = useState<Member["damageExtent"]>(member.damageExtent);
  const [damageRange, setRange] = useState(member.damageRange);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = () => {
    setError("");
    const r = submitReview(member.id, {
      reviewer,
      opinion,
      widthMm,
      heightMm,
      moisturePct,
      damageExtent,
      damageRange,
    });
    if (!r.ok) {
      setError(r.error ?? "提交失败");
      return;
    }
    setOk(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>换人复核 · {memberLabel(member)}</h2>
        <p className="hint">
          复核人必须与建档人不同，由复核人现场填写实测值；修正后仍不满足硬性条件的构件继续留在待复核。
        </p>
        <div className="orig">
          <b>建档值（{member.recorder} · {fmtDate(member.recordedAt)}）</b>
          <br />
          截面 {sectionText(member)} ｜ 含水率 {member.moisturePct}% ｜ 病害{" "}
          {damageText(member)} {member.damageRange ? `｜ ${member.damageRange}` : ""}
        </div>
        <div className="form-grid">
          <label className="field">
            <span>复核人（≠ {member.recorder}）*</span>
            <select value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option value="">请选择复核人</option>
              {USERS.filter((u) => u !== member.recorder).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>实测截面宽 mm</span>
            <input type="number" value={widthMm} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>实测截面高 mm</span>
            <input type="number" value={heightMm} onChange={(e) => setHeight(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>实测含水率 %</span>
            <input type="number" step="0.1" value={moisturePct} onChange={(e) => setMoisture(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>复核病害范围</span>
            <select value={damageExtent} onChange={(e) => setExtent(e.target.value as Member["damageExtent"])}>
              {EXTENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>病害范围描述</span>
            <input value={damageRange} onChange={(e) => setRange(e.target.value)} />
          </label>
          <label className="field wide">
            <span>复核意见</span>
            <textarea value={opinion} placeholder="如：经复测尺寸属实，含水率已降至 14.2%" onChange={(e) => setOpinion(e.target.value)} />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
        {ok && <p className="ok-text">复核已提交，构件状态与关联节点、任务已重算。</p>}
        <div className="form-actions">
          <button className="primary" onClick={submit} disabled={ok}>
            提交实测复核
          </button>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { state, derived, addMember, updateMember, addBuilding } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Member | null>(null);
  const [newBuilding, setNewBuilding] = useState("");

  const [buildingFilter, setBuildingFilter] = useState("all");
  const [tenonFilter, setTenonFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [kw, setKw] = useState("");

  const axes = useMemo(() => {
    const s = new Set<string>();
    state.members
      .filter((m) => buildingFilter === "all" || m.buildingId === buildingFilter)
      .forEach((m) => s.add(m.axis));
    return [...s];
  }, [state.members, buildingFilter]);

  const list = derived.members.filter(({ m, state: st }) => {
    if (buildingFilter !== "all" && m.buildingId !== buildingFilter) return false;
    if (tenonFilter !== "all" && m.tenon !== tenonFilter) return false;
    if (stateFilter !== "all" && st !== stateFilter) return false;
    if (kw.trim()) {
      const blob = `${m.axis} ${m.code} ${m.wood} ${m.damageRange}`;
      if (!blob.includes(kw.trim())) return false;
    }
    return true;
  });

  const buildingName = (id: string) => state.buildings.find((b) => b.id === id)?.name ?? "?";

  return (
    <div>
      <section className="panel">
        <div className="toolbar">
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "收起建档表单" : "+ 新建构件档案"}
          </button>
          <input
            placeholder="新增建筑名称"
            value={newBuilding}
            onChange={(e) => setNewBuilding(e.target.value)}
          />
          <button
            onClick={() => {
              if (newBuilding.trim()) {
                addBuilding(newBuilding.trim());
                setNewBuilding("");
              }
            }}
          >
            新增建筑
          </button>
          <span className="hint">按「建筑 / 轴线 / 构件编号」建档</span>
        </div>

        {showForm && (
          <MemberForm
            initial={emptyDraft(state.buildings[0]?.id ?? "")}
            submitLabel="保存档案"
            onSubmit={(d) => {
              addMember(d);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </section>

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
          <select value={tenonFilter} onChange={(e) => setTenonFilter(e.target.value)}>
            <option value="all">全部榫型</option>
            {TENON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="all">全部状态</option>
            <option value="active">生效</option>
            <option value="pending">待复核</option>
          </select>
          <input placeholder="搜索轴线/编号/木材/病害" value={kw} onChange={(e) => setKw(e.target.value)} />
          <span className="hint">
            共 {list.length} 件，轴线 {axes.length} 条
          </span>
        </div>

        <div className="member-grid">
          {list.map(({ m, state: st, issues }) => (
            <article key={m.id} className={`mcard ${st === "pending" ? "pending" : ""}`}>
              <div className="mhead">
                <h3>
                  {buildingName(m.buildingId)} · {memberLabel(m)}
                </h3>
                <span className={`badge ${st}`}>{st === "active" ? "生效" : "待复核"}</span>
              </div>
              <dl>
                <dt>木材</dt>
                <dd>{m.wood}</dd>
                <dt>榫卯</dt>
                <dd>{fullMemberDesc(m)}</dd>
                <dt>含水率</dt>
                <dd style={{ color: m.moisturePct > MOISTURE_LIMIT ? "var(--danger)" : undefined }}>
                  {m.moisturePct}%
                </dd>
                <dt>病害</dt>
                <dd>
                  {DAMAGE_LABEL[m.damageType]}
                  {m.damageType !== "none" && `（${EXTENT_LABEL[m.damageExtent]}）`}
                  {m.damageRange ? ` · ${m.damageRange}` : ""}
                </dd>
                <dt>建档</dt>
                <dd>
                  {m.recorder} · {fmtDate(m.recordedAt)}
                </dd>
                {m.review && (
                  <>
                    <dt>复核</dt>
                    <dd className="reviewed">
                      {m.review.reviewer} · {fmtDate(m.review.reviewedAt)}
                      {m.review.opinion ? ` · ${m.review.opinion}` : ""}
                    </dd>
                  </>
                )}
              </dl>
              {issues.length > 0 && (
                <ul className="issue-list">
                  {issues.map((i) => (
                    <li key={i.code}>{i.message}</li>
                  ))}
                </ul>
              )}
              <div className="card-actions">
                <button onClick={() => setEditTarget(m)}>改录</button>
                <button className="primary" onClick={() => setReviewTarget(m)}>
                  换人复核
                </button>
              </div>
            </article>
          ))}
          {list.length === 0 && <div className="empty">没有符合筛选条件的构件</div>}
        </div>
      </section>

      {editTarget && (
        <div className="modal-mask" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>改录构件 · {memberLabel(editTarget)}</h2>
            <p className="hint">上游构件改录后，关联节点、修缮任务与统计立即按新值重算；旧版自动留档。</p>
            <MemberForm
              initial={draftOf(editTarget)}
              submitLabel="保存改录"
              onSubmit={(d) => {
                updateMember(editTarget.id, d);
                setEditTarget(null);
              }}
              onCancel={() => setEditTarget(null)}
            />
          </div>
        </div>
      )}

      {reviewTarget && <ReviewModal member={reviewTarget} onClose={() => setReviewTarget(null)} />}
    </div>
  );
}

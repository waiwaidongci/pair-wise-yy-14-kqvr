import { useState } from "react";
import {
  DAMAGE_ZONES,
  ORIENTATIONS,
  TENON_TYPES,
  type MemberInput,
} from "../domain";
import type { DamageZone, Member, Orientation, TenonType } from "../types";

const blank: MemberInput = {
  building: "",
  axis: "",
  code: "",
  name: "",
  wood: "",
  tenon: "直榫",
  sectionW: 0,
  sectionH: 0,
  orientation: "东",
  moisture: 0,
  damaged: false,
  damage: null,
  repairSuggestion: "",
  recorder: "",
};

function fromMember(m: Member): MemberInput {
  return {
    building: m.building,
    axis: m.axis,
    code: m.code,
    name: m.name,
    wood: m.wood,
    tenon: m.tenon,
    sectionW: m.sectionW,
    sectionH: m.sectionH,
    orientation: m.orientation,
    moisture: m.moisture,
    damaged: m.damaged,
    damage: m.damage,
    repairSuggestion: m.repairSuggestion,
    recorder: m.recorder,
  };
}

export function MemberForm({
  initial,
  editing,
  onSubmit,
  onCancel,
}: {
  initial?: Member;
  editing?: boolean;
  onSubmit: (
    input: MemberInput,
    meta: { editor: string; reason: string },
  ) => { ok: boolean; errors: string[] };
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MemberInput>(
    initial ? fromMember(initial) : blank,
  );
  const [editor, setEditor] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const num = (v: string) => (v === "" ? 0 : Number(v));

  const submit = () => {
    const res = onSubmit(form, { editor, reason });
    if (!res.ok) {
      setErrors(res.errors);
    } else {
      setErrors([]);
    }
  };

  return (
    <div className="form-stack">
      {errors.length > 0 && (
        <div className="alert bad">
          {errors.map((e) => (
            <div key={e}>⚠ {e}</div>
          ))}
        </div>
      )}
      {editing && initial?.review && (
        <div className="alert info">
          该构件已有复核结论。保存修改将使复核失效，构件退回待复核，须换人重新复核。
        </div>
      )}

      <div className="field-grid">
        <label>
          <span>建筑 *</span>
          <input
            value={form.building}
            onChange={(e) => set("building", e.target.value)}
            placeholder="如：大成殿"
          />
        </label>
        <label>
          <span>轴线 *</span>
          <input
            value={form.axis}
            onChange={(e) => set("axis", e.target.value)}
            placeholder="如：A轴"
          />
        </label>
        <label>
          <span>构件编号 *</span>
          <input
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="如：L-01"
          />
        </label>
        <label>
          <span>构件名称 *</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="如：五架梁"
          />
        </label>
        <label>
          <span>木材种类 *</span>
          <input
            value={form.wood}
            onChange={(e) => set("wood", e.target.value)}
            placeholder="如：楠木"
          />
        </label>
        <label>
          <span>榫卯类型 *</span>
          <select
            value={form.tenon}
            onChange={(e) => set("tenon", e.target.value as TenonType)}
          >
            {TENON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>截面宽 (mm) *</span>
          <input
            type="number"
            value={form.sectionW || ""}
            onChange={(e) => set("sectionW", num(e.target.value))}
          />
        </label>
        <label>
          <span>截面高 (mm) *</span>
          <input
            type="number"
            value={form.sectionH || ""}
            onChange={(e) => set("sectionH", num(e.target.value))}
          />
        </label>
        <label>
          <span>朝向 *</span>
          <select
            value={form.orientation}
            onChange={(e) => set("orientation", e.target.value as Orientation)}
          >
            {ORIENTATIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>含水率 (%) *</span>
          <input
            type="number"
            step="0.1"
            value={form.moisture || ""}
            onChange={(e) => set("moisture", num(e.target.value))}
          />
          <small className={form.moisture > 18 ? "hint-bad" : ""}>
            限值 ≤ 18%
          </small>
        </label>
        <label>
          <span>录入人 *</span>
          <input
            value={form.recorder}
            onChange={(e) => set("recorder", e.target.value)}
            placeholder="测绘建档人"
            disabled={editing}
          />
          {editing && <small>录入人不可改；复核须由第二人完成</small>}
        </label>
      </div>

      <fieldset className="damage-box">
        <legend>病害范围</legend>
        <label className="inline">
          <input
            type="checkbox"
            checked={form.damaged}
            onChange={(e) =>
              set(
                "damaged",
                e.target.checked,
              )
            }
          />
          存在病害
        </label>
        {form.damaged && (
          <div className="field-grid">
            <label>
              <span>病害部位</span>
              <select
                value={form.damage?.zone ?? DAMAGE_ZONES[0]}
                onChange={(e) =>
                  set("damage", {
                    zone: e.target.value as DamageZone,
                    throughSection: form.damage?.throughSection ?? false,
                    scope: form.damage?.scope ?? "",
                  })
                }
              >
                {DAMAGE_ZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <label>
              <span>损伤是否贯穿截面</span>
              <select
                value={form.damage?.throughSection ? "1" : "0"}
                onChange={(e) =>
                  set("damage", {
                    zone: form.damage?.zone ?? "梁端",
                    throughSection: e.target.value === "1",
                    scope: form.damage?.scope ?? "",
                  })
                }
              >
                <option value="0">未贯穿</option>
                <option value="1">贯穿截面（强制待复核）</option>
              </select>
            </label>
            <label className="span-2">
              <span>病害范围描述</span>
              <input
                value={form.damage?.scope ?? ""}
                onChange={(e) =>
                  set("damage", {
                    zone: form.damage?.zone ?? "梁端",
                    throughSection: form.damage?.throughSection ?? false,
                    scope: e.target.value,
                  })
                }
                placeholder="如：梁端0.4m范围内顺纹开裂"
              />
            </label>
          </div>
        )}
      </fieldset>

      <label className="full-line">
        <span>修缮建议</span>
        <textarea
          rows={2}
          value={form.repairSuggestion}
          onChange={(e) => set("repairSuggestion", e.target.value)}
          placeholder="待复核构件不会生成修缮任务"
        />
      </label>

      {editing && (
        <div className="field-grid">
          <label>
            <span>修改人 *</span>
            <input
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              placeholder="本次修改操作人"
            />
          </label>
          <label>
            <span>修改原因 *</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：现场复测纠正截面"
            />
          </label>
        </div>
      )}

      <div className="form-actions">
        <button className="primary" onClick={submit}>
          {editing ? "保存修改（留档旧版）" : "建档保存"}
        </button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

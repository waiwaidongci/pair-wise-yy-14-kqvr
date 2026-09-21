// 业务不变量自测：npx tsx scripts/selftest.ts
import { derive } from "../src/domain/derive";
import { initialState } from "../src/domain/seed";
import { diffNodeHistory } from "../src/domain/utils";
import type { AppState, Member, NodeDef } from "../src/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function patchMember(s: AppState, id: string, p: Partial<Member>): AppState {
  return { ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...p } : m)) };
}

function patchNode(s: AppState, id: string, p: Partial<NodeDef>): AppState {
  return { ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) };
}

// ---------- 种子数据基线 ----------
console.log("种子基线：");
{
  const d = derive(initialState());
  const states = Object.fromEntries(d.members.map((x) => [x.m.id, x.state]));
  check("M1-M6、M8-M12 生效", ["M1", "M2", "M3", "M4", "M5", "M6", "M8", "M9", "M10", "M11", "M12"].every((id) => states[id] === "active"));
  check("M7 含水率20.4% → 待复核", states.M7 === "pending");

  const ns = Object.fromEntries(d.nodes.map((n) => [n.def.id, n.state]));
  check("N1 正常", ns.N1 === "normal");
  check("N2 透榫↔半榫 → 冻结", ns.N2 === "frozen");
  check("N3 本身相符", ns.N3 === "normal");
  check("N4 端构件待复核 → blocked", ns.N4 === "blocked");
  check("N5 截面不符 → 冻结", ns.N5 === "frozen");
  check("N6 正常", ns.N6 === "normal");

  const tasks = Object.fromEntries(d.tasks.map((t) => [t.memberId, t.state]));
  check("待复核 M7 不生成任务", !("M7" in tasks));
  check("无病害 M3 不生成任务", !("M3" in tasks));
  check("M1 任务待办", tasks.M1 === "open");
  check("M2 任务待办", tasks.M2 === "open");
  check("M5 因 N2 冻结经 M4 传播 → 任务冻结", tasks.M5 === "frozen");
  check("M9 属冻结节点 N5 → 任务冻结", tasks.M9 === "frozen");
  check("统计：生效11 待复核1", d.stats.activeCount === 11 && d.stats.pendingCount === 1);
  check("统计：任务3个（M1,M2,M5,M9共4个）", d.tasks.length === 4, `got ${d.tasks.length}`);
  check("统计：冻结任务2", d.stats.taskFrozen === 2);
}

// ---------- 四条硬性红线 ----------
console.log("硬性红线：");
{
  const base = initialState();
  // 编号重复：同建筑同轴同编号
  const dup: Member = { ...clone(base.members.find((m) => m.id === "M2")!), id: "MX", code: "Z-01", axis: "轴1" };
  let d = derive({ ...base, members: [...base.members, dup] });
  check("编号重复 → 两者都待复核", d.members.filter((x) => ["M1", "MX"].includes(x.m.id)).every((x) => x.state === "pending"));

  // 尺寸非正
  d = derive(patchMember(base, "M1", { widthMm: 0 }));
  check("截面宽为0 → 待复核", d.memberById.get("M1")!.state === "pending");
  d = derive(patchMember(base, "M1", { heightMm: -5 }));
  check("截面高为负 → 待复核", d.memberById.get("M1")!.state === "pending");

  // 含水率边界：18 合法，18.1 不合法
  d = derive(patchMember(base, "M1", { moisturePct: 18 }));
  check("含水率=18% 仍生效", d.memberById.get("M1")!.state === "active");
  d = derive(patchMember(base, "M1", { moisturePct: 18.1 }));
  check("含水率>18% → 待复核", d.memberById.get("M1")!.state === "pending");

  // 损伤贯穿
  d = derive(patchMember(base, "M2", { damageType: "crack", damageExtent: "through" }));
  check("损伤贯穿截面 → 待复核", d.memberById.get("M2")!.state === "pending");
}

// ---------- 待复核构件不得形成关系边 ----------
console.log("关系边阻断：");
{
  let d = derive(patchMember(initialState(), "M1", { moisturePct: 25 }));
  check("M1 转待复核后 N1 → blocked", d.nodeById.get("N1")!.state === "blocked");
  const n1 = d.nodeById.get("N1")!;
  // M1 任务消失
  check("M1 待复核后其修缮任务消失", !d.tasks.some((t) => t.memberId === "M1"));
  // M2 仍生效且 N1 blocked —— M2 无其它节点，任务保持 open（阻断不传播冻结）
  const t2 = d.tasks.find((t) => t.memberId === "M2");
  check("阻断不传播：M2 任务仍 open", t2?.state === "open");
  void n1;
}

// ---------- 节点三不符 ----------
console.log("节点判定：");
{
  let s = patchMember(initialState(), "M11", { tenon: "ban" });
  check("榫型不符 → 冻结", derive(s).nodeById.get("N6")!.state === "frozen");
  s = patchMember(initialState(), "M11", { widthMm: 999 });
  check("截面不符 → 冻结", derive(s).nodeById.get("N6")!.state === "frozen");
  s = patchMember(initialState(), "M11", { facing: "E" });
  check("朝向不相对（M11朝东，M12朝北）→ 冻结", derive(s).nodeById.get("N6")!.state === "frozen");
  s = patchMember(initialState(), "M11", { facing: "N" });
  check("M11朝北、M12朝北（同向）仍非对向 → 冻结", derive(s).nodeById.get("N6")!.state === "frozen");
  s = patchMember(initialState(), "M11", { facing: "N" });
  s = patchMember(s, "M12", { facing: "S" });
  check("改为南北对向且其余相符 → normal", derive(s).nodeById.get("N6")!.state === "normal");
}

// ---------- 换人复核后重算 ----------
console.log("复核闭环：");
{
  const s0 = initialState();
  const m7 = s0.members.find((m) => m.id === "M7")!;
  check("M7 建档人王测绘", m7.recorder === "王测绘");
  // 模拟李复核提交实测值：含水率降到 13.5、虫害局部
  const s1 = JSON.parse(JSON.stringify(s0)) as AppState;
  const fixed: AppState = {
    ...s1,
    members: s1.members.map((m) =>
      m.id === "M7"
        ? {
            ...m,
            moisturePct: 13.5,
            damageExtent: "local",
            review: { reviewer: "李复核", reviewedAt: Date.now(), opinion: "复测合格" },
          }
        : m,
    ),
  };
  const d = derive(fixed);
  check("复核修正后 M7 生效", d.memberById.get("M7")!.state === "active");
  check("N4 由 blocked 转 normal（M7/M8 均燕尾榫对向）", d.nodeById.get("N4")!.state === "normal");
  check("M7 现有病害(局部虫蛀) → 生成 open 任务", d.tasks.find((t) => t.memberId === "M7")?.state === "open");
}

// ---------- 上游改录后立即重算 / 冻结解除 ----------
console.log("改录级联：");
{
  // 把 M3 的榫型改为半榫（消除 N2 不符，且不影响 N3）→ N2 解冻 → M5 任务解除冻结
  const s = patchMember(initialState(), "M3", { tenon: "ban" });
  const d = derive(s);
  check("M3 改半榫后 N2 normal", d.nodeById.get("N2")!.state === "normal");
  check("N3 保持 normal", d.nodeById.get("N3")!.state === "normal");
  check("N3B 保持 normal", d.nodeById.get("N3B")!.state === "normal");
  const t5 = d.tasks.find((t) => t.memberId === "M5");
  check("M5 任务解冻回 open", t5?.state === "open");

  // 改 M1 截面 → N1 冻结 → M1、M2 任务冻结
  const s2 = patchMember(initialState(), "M1", { widthMm: 999 });
  const d2 = derive(s2);
  check("改录 M1 截面 → N1 冻结", d2.nodeById.get("N1")!.state === "frozen");
  check("M1 任务冻结", d2.tasks.find((t) => t.memberId === "M1")?.state === "frozen");
  check("M2 任务冻结", d2.tasks.find((t) => t.memberId === "M2")?.state === "frozen");
}

// ---------- 连通传播：冻结沿构件链向两侧传播 ----------
console.log("传播方向：");
{
  // 扩展链：M6 已经 N3B 与 M5 相连（N3→M5→N3B→M6）；
  // 新增 N7: M6-M13，M13 有病害；N2 冻结应沿链传播到 M13 任务
  let s = initialState();
  const m13: Member = {
    ...clone(s.members.find((m) => m.id === "M6")!),
    id: "M13",
    code: "L-13",
    axis: "轴3",
    facing: "E", // M6 朝西（a端），M13 作为乙端须朝东对向
    damageType: "rot",
    damageExtent: "local",
    damageRange: "糟朽",
  };
  const n7: NodeDef = { id: "N7", buildingId: "B1", code: "J-轴3延伸", aId: "M6", bId: "M13", createdAt: Date.now() };
  s = { ...s, members: [...s.members, m13], nodes: [...s.nodes, n7] };
  const d = derive(s);
  check("N7 本身相符", d.nodeById.get("N7")!.state === "normal");
  check("M13 任务因 N2 冻结沿构件链传播而冻结", d.tasks.find((t) => t.memberId === "M13")?.state === "frozen");
}

// ---------- 完成状态派生 ----------
console.log("任务完成态：");
{
  const s: AppState = { ...initialState(), taskDone: { M1: true } };
  const d = derive(s);
  check("taskDone 的 open 任务显示 done", d.tasks.find((t) => t.memberId === "M1")?.state === "done");
  // 冻结优先于 done
  const s2: AppState = { ...initialState(), taskDone: { M5: true } };
  const d2 = derive(s2);
  check("冻结优先于已完成（M5 仍 frozen）", d2.tasks.find((t) => t.memberId === "M5")?.state === "frozen");
}

// ---------- 状态变更留档（旧版留档） ----------
console.log("留档：");
{
  const prev = initialState();
  // 种子里 N2 建档即冻结；把 M3 改为半榫后 N2 → normal，应自动追加一条状态变更
  const next = diffNodeHistory(prev, patchMember(prev, "M3", { tenon: "ban" }), "李复核");
  const hist = next.nodeHistory.N2;
  const last = hist[hist.length - 1];
  check("节点解冻自动留档：fromState=frozen → toState=normal", last.fromState === "frozen" && last.toState === "normal");
  check("留档记录操作人", last.by === "李复核");
  check("旧版仍保留（建档条目在）", hist[0].action === "建档");

  // 无状态变化时不追加
  const same = diffNodeHistory(next, patchMember(next, "M1", { note: "仅改备注" }), "王测绘");
  check("节点状态未变 → 不追加留档", same.nodeHistory.N2.length === hist.length);
}

// ---------- 纯函数 = 刷新一致 ----------
console.log("一致性：");
{
  const s = initialState();
  const a = derive(s);
  const b = derive(JSON.parse(JSON.stringify(s)));
  const sig = (x: typeof a) =>
    JSON.stringify({
      m: x.members.map((d) => [d.m.id, d.state, d.issues.map((i) => i.code)]),
      n: x.nodes.map((d) => [d.def.id, d.state, d.reasons]),
      t: x.tasks.map((t) => [t.memberId, t.state]),
      s: x.stats,
    });
  check("同一状态两次派生结果一致（刷新后状态一致）", sig(a) === sig(b));
}

console.log(`\n${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);

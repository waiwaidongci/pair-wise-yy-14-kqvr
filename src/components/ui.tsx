import type { ReactNode } from "react";
import type { JointStatus, MemberStatus, TaskState } from "../types";

export function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted" | "info";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function memberBadge(status: MemberStatus) {
  return status === "qualified" ? (
    <Badge tone="ok">合格建档</Badge>
  ) : (
    <Badge tone="warn">待复核</Badge>
  );
}

export function jointBadge(status: JointStatus) {
  switch (status) {
    case "ok":
      return <Badge tone="ok">吻合</Badge>;
    case "frozen":
      return <Badge tone="bad">已冻结</Badge>;
    case "suspended":
      return <Badge tone="warn">挂起（待复核）</Badge>;
    case "missing":
      return <Badge tone="muted">构件缺失</Badge>;
  }
}

export function taskBadge(state: TaskState) {
  return state === "active" ? (
    <Badge tone="info">待办</Badge>
  ) : (
    <Badge tone="bad">已冻结</Badge>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

import React from "react";

export default function NoticeModal({
  open,
  title = "Thông báo",
  message = "",
  type = "info", // info | success | warning | error
  onClose,
}) {
  if (!open) return null;

  const tone = getTone(type);

  return (
    <div className="overlay">
      <div
        className="modal"
        style={{
          width: "min(520px, 95%)",
          borderColor: tone.border,
          boxShadow: tone.shadow,
        }}
      >
        <div
          className="modal-top"
          style={{
            justifyContent: "center",
            background: tone.headerBg,
            borderBottom: `1px solid ${tone.border}`,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 54,
                height: 54,
                margin: "0 auto 10px",
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                background: tone.iconBg,
                border: `1px solid ${tone.border}`,
              }}
            >
              {tone.icon}
            </div>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
        </div>

        <div className="modal-content">
          <div
            style={{
              textAlign: "center",
              lineHeight: 1.6,
              color: "var(--text)",
              fontSize: 15,
              whiteSpace: "pre-wrap",
            }}
          >
            {message}
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn" onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

function getTone(type) {
  switch (type) {
    case "success":
      return {
        icon: "✓",
        border: "rgba(34,197,94,.45)",
        iconBg: "rgba(34,197,94,.16)",
        headerBg: "linear-gradient(135deg, rgba(34,197,94,.18), rgba(20,184,166,.12))",
        shadow: "0 30px 80px rgba(34,197,94,.12)",
      };
    case "warning":
      return {
        icon: "!",
        border: "rgba(245,158,11,.45)",
        iconBg: "rgba(245,158,11,.16)",
        headerBg: "linear-gradient(135deg, rgba(245,158,11,.18), rgba(251,191,36,.10))",
        shadow: "0 30px 80px rgba(245,158,11,.12)",
      };
    case "error":
      return {
        icon: "×",
        border: "rgba(239,68,68,.45)",
        iconBg: "rgba(239,68,68,.16)",
        headerBg: "linear-gradient(135deg, rgba(239,68,68,.18), rgba(220,38,38,.10))",
        shadow: "0 30px 80px rgba(239,68,68,.12)",
      };
    default:
      return {
        icon: "i",
        border: "rgba(11,106,167,.45)",
        iconBg: "rgba(11,106,167,.16)",
        headerBg: "linear-gradient(135deg, rgba(11,106,167,.18), rgba(20,184,166,.12))",
        shadow: "0 30px 80px rgba(11,106,167,.12)",
      };
  }
}
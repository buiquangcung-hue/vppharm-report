import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
} from "firebase/firestore";

function formatTs(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "";
    return d.toLocaleString("vi-VN");
  } catch {
    return "";
  }
}

function safeText(x) {
  return (x || "").toString().replace(/\s+/g, " ").trim();
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function Reports({ isAdmin = false }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    const uid = auth.currentUser?.uid || "";
    const base = collection(db, "weekly_reports");

    const qy = isAdmin
      ? query(base, orderBy("createdAt", "desc"), limit(50))
      : query(base, where("ownerUid", "==", uid), limit(50));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setItems(rows);

        if ((!selectedId || !rows.some((r) => r.id === selectedId)) && rows.length) {
          setSelectedId(rows[0].id);
        }

        if (!rows.length) {
          setSelectedId("");
        }
      },
      (err) => {
        console.error("Reports snapshot error:", err);
        setItems([]);
        setSelectedId("");
        setError("Không thể tải dữ liệu báo cáo. Vui lòng thử lại sau.");
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Lịch sử báo cáo</h2>
          <p>
            {isAdmin
              ? "Admin: xem tất cả báo cáo (50 bản ghi gần nhất)"
              : "Chỉ báo cáo của bạn (50 bản ghi gần nhất)"}
          </p>
        </div>
        <div className="card-body">
          {error ? (
            <div className="small">
              {error}
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill">
              <span className="small">Tổng</span>{" "}
              <span className="kbd">{items.length}</span>
            </span>
            <span className="pill">
              <span className="small">Quyền</span>{" "}
              <span className="kbd">{isAdmin ? "admin" : "user"}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "360px 1fr",
          gap: 14,
        }}
      >
        <div className="card">
          <div className="card-header">
            <h2>Danh sách</h2>
            <p>Click để xem chi tiết</p>
          </div>
          <div
            className="card-body"
            style={{ maxHeight: "70vh", overflow: "auto", display: "grid", gap: 10 }}
          >
            {items.length === 0 ? (
              <div className="small">Chưa có báo cáo nào.</div>
            ) : (
              items.map((it) => {
                const active = it.id === selectedId;
                const weekKey = it.weekKey || it?.input?.weekKey || "unknown-week";
                const created = formatTs(it.createdAt) || "unknown-time";
                const preview =
                  safeText(it.analysis_text).slice(0, 90) || "(Chưa có analysis_text)";

                return (
                  <button
                    key={it.id}
                    className="btn secondary"
                    onClick={() => setSelectedId(it.id)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      borderColor: active
                        ? "rgba(20,184,166,.55)"
                        : "rgba(255,255,255,.14)",
                      background: active
                        ? "rgba(255,255,255,.14)"
                        : "rgba(255,255,255,.10)",
                    }}
                    title={it.id}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{weekKey}</div>
                      <div className="small">{created}</div>
                    </div>

                    {isAdmin ? (
                      <div className="small" style={{ marginTop: 6 }}>
                        Owner: <span className="kbd">{it.ownerEmail || ""}</span>
                      </div>
                    ) : null}

                    <div className="small" style={{ marginTop: 6, lineHeight: 1.35 }}>
                      {preview}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Chi tiết</h2>
            <p>Input + kết quả AI</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            {!selected ? (
              <div className="small">Chọn 1 báo cáo ở danh sách bên trái.</div>
            ) : (
              <>
                <div className="small">
                  <div>
                    <b>ID:</b> <span className="kbd">{selected.id}</span>
                  </div>
                  <div>
                    <b>Tuần:</b>{" "}
                    <span className="kbd">
                      {selected.weekKey || selected?.input?.weekKey || "unknown"}
                    </span>
                  </div>
                  <div>
                    <b>Tạo lúc:</b>{" "}
                    <span className="kbd">
                      {formatTs(selected.createdAt) || "unknown"}
                    </span>
                  </div>

                  {isAdmin ? (
                    <div>
                      <b>Owner:</b>{" "}
                      <span className="kbd">{selected.ownerEmail || ""}</span>{" "}
                      (<span className="kbd">{selected.ownerUid || ""}</span>)
                    </div>
                  ) : null}
                </div>

                <div className="hr" />

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Báo cáo gốc (Input)
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      overflow: "auto",
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
{JSON.stringify(selected.input || {}, null, 2)}
                  </pre>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Kết quả AI (Text)
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      padding: 12,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.10)",
                      minHeight: 160,
                    }}
                  >
                    {selected.analysis_text || "(Chưa có analysis_text)"}
                  </div>
                </div>

                {selected.analysis_json ? (
                  <details>
                    <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                      Xem JSON cấu trúc
                    </summary>
                    <pre
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: "rgba(0,0,0,.25)",
                        borderRadius: 14,
                        overflow: "auto",
                        border: "1px solid rgba(255,255,255,.10)",
                        color: "#d6e2ff",
                      }}
                    >
{JSON.stringify(selected.analysis_json, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
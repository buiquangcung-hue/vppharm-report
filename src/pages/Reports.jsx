import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

function formatTs(ts) {
  try {
    // Firestore Timestamp có toDate()
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "";
    return d.toLocaleString("vi-VN");
  } catch {
    return "";
  }
}

export default function Reports() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "weekly_reports"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(rows);
        if (!selectedId && rows.length) setSelectedId(rows[0].id);
      },
      (err) => {
        console.error("Reports snapshot error:", err);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "34px auto", padding: "0 14px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Lịch sử báo cáo tuần</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            Firestore • weekly_reports • 50 bản ghi gần nhất
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          Tổng: <b>{items.length}</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginTop: 18 }}>
        {/* LEFT: list */}
        <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
            Danh sách
          </div>

          <div style={{ maxHeight: "72vh", overflow: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: 12, color: "#666" }}>
                Chưa có báo cáo nào. Hãy tạo báo cáo ở tab Weekly.
              </div>
            ) : (
              items.map((it) => {
                const isActive = it.id === selectedId;
                const weekKey = it.weekKey || it?.input?.weekKey || "unknown-week";
                const created = formatTs(it.createdAt);
                const preview =
                  (it.analysis_text || "").replace(/\s+/g, " ").slice(0, 90) ||
                  "Chưa có analysis_text";

                return (
                  <button
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      borderBottom: "1px solid #f1f1f1",
                      background: isActive ? "#111" : "#fff",
                      color: isActive ? "#fff" : "#111",
                      cursor: "pointer",
                    }}
                    title={it.id}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{weekKey}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{created}</div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                      {preview}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: details */}
        <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
            Chi tiết
          </div>

          {!selected ? (
            <div style={{ padding: 12, color: "#666" }}>Chọn 1 báo cáo bên trái để xem chi tiết.</div>
          ) : (
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                <div>
                  <b>ID:</b> {selected.id}
                </div>
                <div>
                  <b>Tuần:</b> {selected.weekKey || selected?.input?.weekKey || "unknown"}
                </div>
                <div>
                  <b>Tạo lúc:</b> {formatTs(selected.createdAt) || "unknown"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>Input (báo cáo gốc)</div>
                <pre style={{ margin: 0, padding: 12, background: "#f6f7f9", borderRadius: 12, overflow: "auto" }}>
{JSON.stringify(selected.input || {}, null, 2)}
                </pre>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 800 }}>Kết quả AI (text)</div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f6f7f9",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e9e9e9",
                    minHeight: 140,
                  }}
                >
                  {selected.analysis_text || "Chưa có analysis_text"}
                </div>
              </div>

              {selected.analysis_json ? (
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Xem analysis_json</summary>
                  <pre
                    style={{
                      marginTop: 10,
                      overflow: "auto",
                      background: "#0b1020",
                      color: "#d6e2ff",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    {JSON.stringify(selected.analysis_json, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
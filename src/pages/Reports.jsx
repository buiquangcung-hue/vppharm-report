import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { collection, onSnapshot, orderBy, query, limit, where } from "firebase/firestore";

function formatTs(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "";
    return d.toLocaleString("vi-VN");
  } catch {
    return "";
  }
}

export default function Reports({ isAdmin }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const base = collection(db, "weekly_reports");

    const qy = isAdmin
      ? query(base, orderBy("createdAt", "desc"), limit(50))
      : query(base, where("ownerUid", "==", uid || "__none__"), orderBy("createdAt", "desc"), limit(50));

    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Danh sách báo cáo</h2>
          <p>{isAdmin ? "Admin: xem tất cả" : "Chỉ báo cáo của bạn"} · 50 bản ghi gần nhất</p>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto" }}>
          {items.length === 0 ? (
            <div className="small">Chưa có báo cáo.</div>
          ) : (
            items.map((it) => {
              const active = it.id === selectedId;
              const weekKey = it.weekKey || it?.input?.weekKey || "unknown-week";
              return (
                <button
                  key={it.id}
                  className="btn secondary"
                  style={{
                    textAlign: "left",
                    background: active ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.10)",
                    width: "100%",
                  }}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div style={{ fontWeight: 900 }}>{weekKey}</div>
                  <div className="small">{formatTs(it.createdAt)}</div>
                  {isAdmin ? <div className="small">Owner: <span className="kbd">{it.ownerEmail || ""}</span></div> : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Chi tiết</h2>
          <p>Xem input + kết quả AI</p>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          {!selected ? (
            <div className="small">Chọn 1 báo cáo bên trái.</div>
          ) : (
            <>
              <div className="small">
                ID: <span className="kbd">{selected.id}</span> · Tuần:{" "}
                <span className="kbd">{selected.weekKey || selected?.input?.weekKey || "unknown"}</span>
                {isAdmin ? (
                  <>
                    {" "}· Owner: <span className="kbd">{selected.ownerEmail || ""}</span>
                  </>
                ) : null}
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Input</div>
                <pre style={{ margin: 0, padding: 12, background: "rgba(255,255,255,.06)", borderRadius: 14, overflow: "auto" }}>
{JSON.stringify(selected.input || {}, null, 2)}
                </pre>
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>AI (text)</div>
                <div style={{ whiteSpace: "pre-wrap", padding: 12, background: "rgba(255,255,255,.06)", borderRadius: 14 }}>
                  {selected.analysis_text || "(Chưa có)"}
                </div>
              </div>

              {selected.analysis_json ? (
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>Xem analysis_json</summary>
                  <pre style={{ marginTop: 10, padding: 12, background: "rgba(0,0,0,.25)", borderRadius: 14, overflow: "auto" }}>
{JSON.stringify(selected.analysis_json, null, 2)}
                  </pre>
                </details>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
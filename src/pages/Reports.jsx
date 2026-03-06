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
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN");
  } catch {
    return "";
  }
}

function formatVND(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
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

function getReportTitle(item) {
  return (
    item.reportDisplayName ||
    item.reportName ||
    item.weekKey ||
    item?.input?.reportDisplayName ||
    item?.input?.reportName ||
    item?.input?.weekKey ||
    "Báo cáo chưa đặt tên"
  );
}

export default function Reports({ isAdmin = false, isDirector = false }) {
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
  }, [isAdmin, isDirector, selectedId]);

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
              : "Bạn chỉ xem được các báo cáo do mình tạo"}
          </p>
        </div>
        <div className="card-body">
          {error ? <div className="small">{error}</div> : null}

          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill">
              <span className="small">Tổng</span>{" "}
              <span className="kbd">{items.length}</span>
            </span>
            <span className="pill">
              <span className="small">Quyền</span>{" "}
              <span className="kbd">{isAdmin ? "admin" : isDirector ? "director" : "user"}</span>
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
                const title = getReportTitle(it);
                const created = formatTs(it.createdAt) || "unknown-time";
                const preview =
                  safeText(it.analysis_text).slice(0, 100) || "(Chưa có analysis_text)";

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
                      <div style={{ fontWeight: 900 }}>{title}</div>
                      <div className="small">{created}</div>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      Nhân viên: <span className="kbd">{it.employeeName || it?.input?.employee?.name || "-"}</span>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      Địa bàn: <span className="kbd">{it.province || it?.input?.province || "-"}</span>
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
            <p>Thông tin chuyến đi + kết quả AI</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            {!selected ? (
              <div className="small">Chọn 1 báo cáo ở danh sách bên trái.</div>
            ) : (
              <>
                <div className="small" style={{ display: "grid", gap: 6 }}>
                  <div>
                    <b>ID:</b> <span className="kbd">{selected.id}</span>
                  </div>
                  <div>
                    <b>Tên báo cáo:</b>{" "}
                    <span className="kbd">{getReportTitle(selected)}</span>
                  </div>
                  <div>
                    <b>Tuần làm việc:</b>{" "}
                    <span className="kbd">
                      {selected.weekFrom || selected?.input?.weekFrom || "-"} →{" "}
                      {selected.weekTo || selected?.input?.weekTo || "-"}
                    </span>
                  </div>
                  <div>
                    <b>Nhân viên:</b>{" "}
                    <span className="kbd">
                      {selected.employeeName || selected?.input?.employee?.name || "-"}
                    </span>
                  </div>
                  <div>
                    <b>Địa bàn:</b>{" "}
                    <span className="kbd">{selected.province || selected?.input?.province || "-"}</span>
                  </div>
                  <div>
                    <b>Tạo lúc:</b>{" "}
                    <span className="kbd">{formatTs(selected.createdAt) || "unknown"}</span>
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

                <div className="grid two">
                  <InfoBox
                    title="Số khách hàng đến viếng thăm"
                    value={selected.visitCustomerCount ?? selected?.input?.visitCustomerCount ?? 0}
                  />
                  <InfoBox
                    title="Doanh số cả chuyến đi"
                    value={formatVND(selected.tripRevenue ?? selected?.input?.tripRevenue ?? 0)}
                  />
                </div>

                <div className="grid two">
                  <InfoBox
                    title="Tổng KH TDV phụ trách"
                    value={selected.assignedCustomerCount ?? selected?.input?.assignedCustomerCount ?? 0}
                  />
                  <InfoBox
                    title="KH chưa khai thác"
                    value={selected.unexploredCustomerCount ?? selected?.input?.unexploredCustomerCount ?? 0}
                  />
                </div>

                <InfoBox
                  title="Tổng KH toàn địa bàn"
                  value={selected.totalMarketCustomerCount ?? selected?.input?.totalMarketCustomerCount ?? 0}
                />

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Điểm mạnh của nhân viên
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      padding: 12,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                    {selected.employeeStrengths || selected?.input?.employeeStrengths || "-"}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Điểm yếu của nhân viên
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      padding: 12,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                    {selected.employeeWeaknesses || selected?.input?.employeeWeaknesses || "-"}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Doanh số mặt hàng
                  </div>
                  {(selected.productLines || selected?.input?.productLines || []).length === 0 ? (
                    <div className="small">Không có dữ liệu mặt hàng.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(selected.productLines || selected?.input?.productLines || []).map((item, index) => (
                        <div
                          key={`${item.productId || item.productName || "p"}-${index}`}
                          style={{
                            padding: 12,
                            background: "rgba(255,255,255,.06)",
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,.10)",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>{item.productName || "-"}</div>
                          <div className="small" style={{ marginTop: 6 }}>
                            ĐVT: <span className="kbd">{item.unit || "-"}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Giá bán: <span className="kbd">{formatVND(item.price || 0)}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Số lượng: <span className="kbd">{item.quantity || 0}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Doanh số dự kiến:{" "}
                            <span className="kbd">{formatVND(item.expectedRevenue || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pill" style={{ marginTop: 12 }}>
                    <span className="small">Tổng doanh số dự kiến:</span>{" "}
                    <span className="kbd">
                      {formatVND(selected.totalExpectedRevenue ?? selected?.input?.totalExpectedRevenue ?? 0)}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    File Excel đính kèm
                  </div>
                  {selected?.excelFile?.fileUrl ? (
                    <a
                      className="btn secondary"
                      href={selected.excelFile.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở file: {selected.excelFile.fileName || "Excel"}
                    </a>
                  ) : (
                    <div className="small">Không có file Excel đính kèm.</div>
                  )}
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

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Payload đã lưu
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

function InfoBox({ title, value }) {
  return (
    <div
      style={{
        padding: 12,
        background: "rgba(255,255,255,.06)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div className="small" style={{ marginTop: 8 }}>
        <span className="kbd">{String(value ?? "-")}</span>
      </div>
    </div>
  );
}
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

function formatVNDate(dateStr = "") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

function formatWeekLabel(weekCode = "") {
  const match = String(weekCode || "").match(/^(\d{4})-W(\d{2})$/);
  if (!match) return "";
  return `Tuần ${match[2]}/${match[1]}`;
}

function formatReportPeriod(item) {
  const weekCode = item?.weekCode || item?.input?.weekCode || "";
  const weekLabel = formatWeekLabel(weekCode);

  const from = item?.weekFrom || item?.input?.weekFrom || "";
  const to = item?.weekTo || item?.input?.weekTo || "";

  const fromText = formatVNDate(from);
  const toText = formatVNDate(to);

  if (weekLabel && fromText && toText) {
    return `${weekLabel} • ${fromText} → ${toText}`;
  }

  if (fromText && toText) {
    return `${fromText} → ${toText}`;
  }

  if (weekLabel) {
    return weekLabel;
  }

  return "-";
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

function removeVietnameseTones(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeText(value = "") {
  return removeVietnameseTones(String(value || ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function matchesManagerFallback(employee, profile, currentUser) {
  const employeeManagerName = normalizeText(employee?.managerName || "");
  const profileName = normalizeText(profile?.name || "");
  const userEmail = normalizeText(currentUser?.email || "");

  if (!employeeManagerName) return false;
  if (profileName && employeeManagerName === profileName) return true;
  if (userEmail && employeeManagerName === userEmail) return true;

  return false;
}

function normalizeArrayContent(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data === "string") return [data];
  if (typeof data === "object") return [data];
  return [];
}

function renderInsightItem(item, index) {
  if (typeof item === "string") {
    return (
      <div
        key={index}
        style={{
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.08)",
          lineHeight: 1.55,
        }}
      >
        {item}
      </div>
    );
  }

  if (item && typeof item === "object") {
    const title = item.title || item.name || item.staff || item.label || `Mục ${index + 1}`;
    const desc =
      item.reason ||
      item.rationale ||
      item.focus ||
      item.owner ||
      item.suggested_action ||
      item.description ||
      item.summary ||
      "";

    return (
      <div
        key={index}
        style={{
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>
        {desc ? (
          <div className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {desc}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function AnalysisSection({ title, data }) {
  const items = normalizeArrayContent(data);
  if (!items.length) return null;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => renderInsightItem(item, index))}
      </div>
    </div>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,.06)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div className="small">{title}</div>
      <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{value}</div>
      {sub ? (
        <div className="small" style={{ marginTop: 6 }}>
          {sub}
        </div>
      ) : null}
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

function mergeUniqueReports(...groups) {
  const map = new Map();

  groups.flat().forEach((item) => {
    if (!item?.id) return;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      return;
    }

    map.set(item.id, {
      ...existing,
      ...item,
    });
  });

  return [...map.values()].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function explainFirestoreError(err) {
  const code = err?.code || "";
  const message = err?.message || "";

  if (message.includes("requires an index") || code === "failed-precondition") {
    return "Thiếu Firestore index cho truy vấn báo cáo của giám đốc. Hãy mở Console trình duyệt và bấm link Create Index.";
  }

  if (code === "permission-denied" || message.includes("Missing or insufficient permissions")) {
    return "Firestore Rules vẫn đang chặn quyền đọc báo cáo của giám đốc.";
  }

  return "Không thể tải dữ liệu báo cáo. Vui lòng thử lại sau.";
}

export default function Reports({
  isAdmin = false,
  isDirector = false,
  profile = null,
}) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || "";

    if (!isAdmin && !isDirector) {
      setItems([]);
      setSelectedId("");
      setError("Bạn không có quyền xem dữ liệu báo cáo.");
      return;
    }

    const employeesQuery = query(collection(db, "employees"), limit(500));

    let employeesCache = [];
    let adminReportsCache = [];
    let ownReportsCache = [];
    let directorReportsCache = [];
    let directorUidReportsCache = [];

    function applyFilter() {
      try {
        const managedEmployeeIds = new Set(
          employeesCache
            .filter((emp) => emp.active !== false)
            .filter((emp) => {
              if (!isDirector) return false;

              const managerUid = String(emp.managerUid || "").trim();
              if (managerUid && currentUid && managerUid === currentUid) {
                return true;
              }

              return matchesManagerFallback(emp, profile, currentUser);
            })
            .map((emp) => emp.id)
        );

        const sourceRows = isAdmin
          ? adminReportsCache
          : mergeUniqueReports(
              ownReportsCache,
              directorReportsCache,
              directorUidReportsCache
            );

        const rows = sourceRows
          .filter((item) => {
            if (isAdmin) return true;

            if (isDirector) {
              const ownerUid = String(item.ownerUid || "").trim();
              const employeeUid = String(
                item.employeeUid || item?.input?.employee?.uid || ""
              ).trim();
              const directorUid = String(item?.director?.uid || "").trim();
              const flatDirectorUid = String(item?.directorUid || "").trim();

              if (ownerUid && currentUid && ownerUid === currentUid) return true;
              if (directorUid && currentUid && directorUid === currentUid) return true;
              if (flatDirectorUid && currentUid && flatDirectorUid === currentUid) return true;
              if (employeeUid && managedEmployeeIds.has(employeeUid)) return true;

              return false;
            }

            return false;
          })
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setItems(rows);

        setSelectedId((prev) => {
          if (!rows.length) return "";
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows[0].id;
        });
      } catch (err) {
        console.error("Reports filter error:", err);
        setItems([]);
        setSelectedId("");
        setError("Không thể xử lý dữ liệu báo cáo. Vui lòng thử lại sau.");
      }
    }

    const unsubscribers = [];

    const unsubEmployees = onSnapshot(
      employeesQuery,
      (snap) => {
        employeesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyFilter();
      },
      (err) => {
        console.error("Employees snapshot error:", err);
        employeesCache = [];
        applyFilter();
      }
    );
    unsubscribers.push(unsubEmployees);

    if (isAdmin) {
      const adminQuery = query(
        collection(db, "weekly_reports"),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const unsubAdmin = onSnapshot(
        adminQuery,
        (snap) => {
          adminReportsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          applyFilter();
        },
        (err) => {
          console.error("Admin reports snapshot error:", err);
          setItems([]);
          setSelectedId("");
          setError(explainFirestoreError(err));
        }
      );

      unsubscribers.push(unsubAdmin);
    }

    if (isDirector) {
      const ownReportsQuery = query(
        collection(db, "weekly_reports"),
        where("ownerUid", "==", currentUid),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const directorObjectQuery = query(
        collection(db, "weekly_reports"),
        where("director.uid", "==", currentUid),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const directorUidQuery = query(
        collection(db, "weekly_reports"),
        where("directorUid", "==", currentUid),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const unsubOwn = onSnapshot(
        ownReportsQuery,
        (snap) => {
          ownReportsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          applyFilter();
        },
        (err) => {
          console.error("Own reports snapshot error:", err);
          ownReportsCache = [];
          setError(explainFirestoreError(err));
          applyFilter();
        }
      );

      const unsubDirectorObject = onSnapshot(
        directorObjectQuery,
        (snap) => {
          directorReportsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          applyFilter();
        },
        (err) => {
          console.error("Director object snapshot error:", err);
          directorReportsCache = [];
          setError(explainFirestoreError(err));
          applyFilter();
        }
      );

      const unsubDirectorUid = onSnapshot(
        directorUidQuery,
        (snap) => {
          directorUidReportsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          applyFilter();
        },
        (err) => {
          console.error("Director UID snapshot error:", err);
          directorUidReportsCache = [];
          setError(explainFirestoreError(err));
          applyFilter();
        }
      );

      unsubscribers.push(unsubOwn, unsubDirectorObject, unsubDirectorUid);
    }

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          unsub?.();
        } catch {
          // ignore
        }
      });
    };
  }, [isAdmin, isDirector, profile?.name]);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  const selectedProductLines =
    selected?.productLines || selected?.input?.productLines || [];

  const selectedAnalysisJson = selected?.analysis_json || null;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-header" style={{ textAlign: "center" }}>
          <h2 style={{ letterSpacing: 0.6, textTransform: "uppercase" }}>
            BÁO CÁO ĐÃ LƯU
          </h2>
          <p>
            {isAdmin
              ? "Quản trị: xem tất cả báo cáo gần nhất trong hệ thống"
              : isDirector
              ? "Giám đốc kinh doanh: xem báo cáo do mình tạo và báo cáo của nhân viên thuộc đội phụ trách"
              : "Bạn không có quyền xem báo cáo"}
          </p>
        </div>
        <div className="card-body">
          {error ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,.35)",
                background: "rgba(239,68,68,.10)",
              }}
            >
              <div className="small" style={{ color: "#ffd5d5" }}>
                {error}
              </div>
            </div>
          ) : null}

          <div className="grid two">
            <StatCard
              title="Tổng báo cáo hiển thị"
              value={items.length}
              sub="Danh sách đã lọc theo quyền hiện tại"
            />
            <StatCard
              title="Quyền đang dùng"
              value={
                isAdmin
                  ? "Quản trị"
                  : isDirector
                  ? "Giám đốc kinh doanh"
                  : "Người dùng"
              }
              sub="Phân quyền đọc báo cáo của hệ thống"
            />
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
            <h2>Danh sách báo cáo</h2>
            <p>Chọn một báo cáo để xem chi tiết</p>
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
                const created = formatTs(it.createdAt) || "Chưa rõ thời gian";
                const preview =
                  safeText(it.analysis_text).slice(0, 110) || "(Chưa có nội dung phân tích)";
                const periodText = formatReportPeriod(it);

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
                      <div style={{ fontWeight: 900, lineHeight: 1.4 }}>{title}</div>
                      <div className="small">{created}</div>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      Kỳ báo cáo: <span className="kbd">{periodText}</span>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      Nhân viên:{" "}
                      <span className="kbd">
                        {it.employeeName || it?.input?.employee?.name || "-"}
                      </span>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      Địa bàn:{" "}
                      <span className="kbd">{it.province || it?.input?.province || "-"}</span>
                    </div>

                    {isAdmin ? (
                      <div className="small" style={{ marginTop: 6 }}>
                        Người tạo: <span className="kbd">{it.ownerEmail || ""}</span>
                      </div>
                    ) : null}

                    <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
                      {preview}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ textAlign: "center" }}>
            <h2 style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
              CHI TIẾT BÁO CÁO VÀ PHÂN TÍCH AI
            </h2>
            <p>Thông tin chuyến đi, dữ liệu kinh doanh và kết quả phân tích</p>
          </div>

          <div className="card-body" style={{ display: "grid", gap: 14 }}>
            {!selected ? (
              <div className="small">Chọn 1 báo cáo ở danh sách bên trái.</div>
            ) : (
              <>
                <div className="grid two">
                  <StatCard
                    title="Tên báo cáo"
                    value={getReportTitle(selected)}
                    sub={`Tạo lúc: ${formatTs(selected.createdAt) || "Chưa rõ thời gian"}`}
                  />
                  <StatCard
                    title="Doanh số dự kiến"
                    value={formatVND(
                      selected.totalExpectedRevenue ??
                        selected?.input?.totalExpectedRevenue ??
                        0
                    )}
                    sub="Tổng từ toàn bộ mặt hàng đã nhập"
                  />
                </div>

                <div className="small" style={{ display: "grid", gap: 8 }}>
                  <div>
                    <b>ID:</b> <span className="kbd">{selected.id}</span>
                  </div>
                  <div>
                    <b>Tuần làm việc:</b>{" "}
                    <span className="kbd">{formatReportPeriod(selected)}</span>
                  </div>
                  <div>
                    <b>Nhân viên:</b>{" "}
                    <span className="kbd">
                      {selected.employeeName || selected?.input?.employee?.name || "-"}
                    </span>
                  </div>
                  <div>
                    <b>Địa bàn:</b>{" "}
                    <span className="kbd">
                      {selected.province || selected?.input?.province || "-"}
                    </span>
                  </div>

                  {isAdmin ? (
                    <div>
                      <b>Người tạo:</b>{" "}
                      <span className="kbd">{selected.ownerEmail || ""}</span>{" "}
                      (<span className="kbd">{selected.ownerUid || ""}</span>)
                    </div>
                  ) : null}
                </div>

                <div className="hr" />

                <div className="grid two">
                  <InfoBox
                    title="Số khách hàng đến viếng thăm"
                    value={
                      selected.visitCustomerCount ??
                      selected?.input?.visitCustomerCount ??
                      0
                    }
                  />
                  <InfoBox
                    title="Doanh số cả chuyến đi"
                    value={formatVND(
                      selected.tripRevenue ?? selected?.input?.tripRevenue ?? 0
                    )}
                  />
                </div>

                <div className="grid two">
                  <InfoBox
                    title="Tổng khách hàng TDV phụ trách"
                    value={
                      selected.assignedCustomerCount ??
                      selected?.input?.assignedCustomerCount ??
                      0
                    }
                  />
                  <InfoBox
                    title="Tổng khách hàng toàn địa bàn"
                    value={
                      selected.totalMarketCustomerCount ??
                      selected?.input?.totalMarketCustomerCount ??
                      0
                    }
                  />
                </div>

                <div className="grid two">
                  <div
                    style={{
                      padding: 14,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>
                      Điểm mạnh của nhân viên
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {selected.employeeStrengths ||
                        selected?.input?.employeeStrengths ||
                        "-"}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 14,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>
                      Điểm yếu của nhân viên
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {selected.employeeWeaknesses ||
                        selected?.input?.employeeWeaknesses ||
                        "-"}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>
                    Cơ cấu doanh số mặt hàng
                  </div>

                  {selectedProductLines.length === 0 ? (
                    <div className="small">Không có dữ liệu mặt hàng.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {selectedProductLines.map((item, index) => (
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
                            Đơn vị tính: <span className="kbd">{item.unit || "-"}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Giá bán: <span className="kbd">{formatVND(item.price || 0)}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Số lượng: <span className="kbd">{item.quantity || 0}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Doanh số dự kiến:{" "}
                            <span className="kbd">
                              {formatVND(item.expectedRevenue || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

                <div className="hr" />

                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="card-header" style={{ textAlign: "center" }}>
                    <h2 style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
                      KẾT QUẢ PHÂN TÍCH BÁO CÁO BẰNG AI
                    </h2>
                    <p>Tổng hợp điều hành từ dữ liệu chuyến đi và file Excel</p>
                  </div>

                  <div className="card-body">
                    {selectedAnalysisJson ? (
                      <div style={{ display: "grid", gap: 14 }}>
                        <div className="grid two">
                          <AnalysisSection
                            title="Tóm tắt chuyến đi"
                            data={
                              selectedAnalysisJson.tripSummary ||
                              selectedAnalysisJson.executive_summary
                            }
                          />
                          <AnalysisSection
                            title="Đánh giá nhân viên"
                            data={
                              selectedAnalysisJson.employeeAssessment ||
                              selectedAnalysisJson.employeePerformance
                            }
                          />
                        </div>

                        <div className="grid two">
                          <AnalysisSection
                            title="Đánh giá thị trường"
                            data={
                              selectedAnalysisJson.coverageAssessment ||
                              selectedAnalysisJson.marketCoverage
                            }
                          />
                          <AnalysisSection
                            title="Đánh giá doanh số"
                            data={
                              selectedAnalysisJson.salesAssessment ||
                              selectedAnalysisJson.salesPotential
                            }
                          />
                        </div>

                        <div className="grid two">
                          <AnalysisSection
                            title="Điểm mạnh nổi bật"
                            data={selectedAnalysisJson.strengthHighlights}
                          />
                          <AnalysisSection
                            title="Điểm yếu cần cải thiện"
                            data={selectedAnalysisJson.weaknessHighlights}
                          />
                        </div>

                        <div className="grid two">
                          <AnalysisSection
                            title="Rủi ro"
                            data={selectedAnalysisJson.risks}
                          />
                          <AnalysisSection
                            title="Cơ hội"
                            data={selectedAnalysisJson.opportunities}
                          />
                        </div>

                        <div className="grid two">
                          <AnalysisSection
                            title="Khuyến nghị quản lý"
                            data={
                              selectedAnalysisJson.managerRecommendations ||
                              selectedAnalysisJson.managerRecommendation
                            }
                          />
                          <AnalysisSection
                            title="Kế hoạch tuần tới"
                            data={
                              selectedAnalysisJson.nextWeekActions ||
                              selectedAnalysisJson.action_plan
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          padding: 16,
                          background: "rgba(255,255,255,.06)",
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,.10)",
                          minHeight: 160,
                          lineHeight: 1.7,
                        }}
                      >
                        {selected.analysis_text || "(Chưa có nội dung phân tích)"}
                      </div>
                    )}

                    {selected.analysis_json ? (
                      <details style={{ marginTop: 14 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                          Xem dữ liệu JSON cấu trúc
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
                  </div>
                </div>

                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                    Xem dữ liệu đầu vào đã lưu
                  </summary>
                  <pre
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 14,
                      overflow: "auto",
                      border: "1px solid rgba(255,255,255,.10)",
                    }}
                  >
{JSON.stringify(selected.input || {}, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
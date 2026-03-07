import { useEffect, useMemo, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import Weekly from "./pages/Weekly.jsx";
import Reports from "./pages/Reports.jsx";
import Admin from "./pages/Admin.jsx";
import AuthModal from "./pages/Auth.jsx";
import NoticeModal from "./components/NoticeModal.jsx";

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/cnlb-4d714.firebasestorage.app/o/lOGO%20DOC.png?alt=media&token=ad7d71e2-aa27-4ed5-81d8-9f8ee9ace0ac";

const ADMIN_EMAIL = "buiquangcung@gmail.com";
const ADMIN_PHONE = "0946 429 099";

function normalizeRole(profile, email) {
  if ((email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) return "admin";
  return profile?.role || "pending";
}

function getBriefingScheduleKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 1 = thứ 2, 6 = thứ 7
  const hour = d.getHours();

  if ((day === 1 || day === 6) && hour >= 8) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const slot = day === 1 ? "mon" : "sat";
    return `vp-executive-briefing-dismissed:${yyyy}-${mm}-${dd}:${slot}`;
  }

  return "";
}

function priorityMeta(level = "watch") {
  if (level === "critical") {
    return {
      label: "Khẩn cấp",
      bg: "rgba(239,68,68,.12)",
      border: "rgba(239,68,68,.28)",
      color: "#ffd6d6",
    };
  }

  if (level === "important") {
    return {
      label: "Quan trọng",
      bg: "rgba(245,158,11,.12)",
      border: "rgba(245,158,11,.28)",
      color: "#ffe8be",
    };
  }

  return {
    label: "Theo dõi",
    bg: "rgba(59,130,246,.12)",
    border: "rgba(59,130,246,.28)",
    color: "#d9e8ff",
  };
}

function inferPriorityFromText(text = "") {
  const normalized = String(text || "").toLowerCase();

  if (
    normalized.includes("cảnh báo") ||
    normalized.includes("giảm mạnh") ||
    normalized.includes("rủi ro cao") ||
    normalized.includes("khẩn") ||
    normalized.includes("thấp") ||
    normalized.includes("suy giảm")
  ) {
    return "critical";
  }

  if (
    normalized.includes("cần") ||
    normalized.includes("nên") ||
    normalized.includes("quan trọng") ||
    normalized.includes("ưu tiên") ||
    normalized.includes("coaching") ||
    normalized.includes("đào tạo") ||
    normalized.includes("rà soát")
  ) {
    return "important";
  }

  return "watch";
}

function ExecutiveBriefingOverlay({
  open,
  data,
  onClose,
  onGoDashboard,
}) {
  if (!open || !data) return null;

  const tone =
    data.healthScore >= 80
      ? {
          bg: "rgba(34,197,94,.14)",
          border: "rgba(34,197,94,.35)",
          color: "#d9ffe6",
          badge: "TỐT",
        }
      : data.healthScore >= 60
      ? {
          bg: "rgba(245,158,11,.14)",
          border: "rgba(245,158,11,.35)",
          color: "#ffeab8",
          badge: "THEO DÕI",
        }
      : {
          bg: "rgba(239,68,68,.14)",
          border: "rgba(239,68,68,.35)",
          color: "#ffd5d5",
          badge: "CẢNH BÁO",
        };

  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const risks = Array.isArray(data.criticalRisks) ? data.criticalRisks : [];
  const opportunities = Array.isArray(data.topOpportunities) ? data.topOpportunities : [];
  const actions = Array.isArray(data.actionPlan) ? data.actionPlan : [];
  const alerts = Array.isArray(data.performanceAlerts) ? data.performanceAlerts : [];
  const trends = Array.isArray(data.notableTrends) ? data.notableTrends : [];

  const topHeadline =
    data.healthScore >= 80
      ? "Hệ thống đang duy trì trạng thái điều hành tích cực, phù hợp để thúc đẩy tăng trưởng có kiểm soát."
      : data.healthScore >= 60
      ? "Hệ thống đang ở vùng theo dõi, cần hành động có trọng tâm để củng cố hiệu suất và độ phủ."
      : "Hệ thống đang ở vùng cảnh báo, cần ưu tiên xử lý ngay các điểm nghẽn doanh số và vận hành thị trường.";

  function PriorityBadge({ level = "watch" }) {
    const meta = priorityMeta(level);
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 999,
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          color: meta.color,
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {meta.label}
      </span>
    );
  }

  function BriefColumn({ title, items, emptyText, icon, defaultPriority = "watch" }) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 22,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.10)",
          display: "grid",
          gap: 12,
          minHeight: 220,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            <span>{icon}</span>
            <span>{title}</span>
          </div>

          <PriorityBadge level={defaultPriority} />
        </div>

        {items.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item, index) => {
              const text = typeof item === "string" ? item : JSON.stringify(item);
              const level = inferPriorityFromText(text);
              const meta = priorityMeta(level);

              return (
                <div
                  key={`${title}-${index}`}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.08)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <PriorityBadge level={level} />
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: meta.border,
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div style={{ lineHeight: 1.65 }}>{text}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="small">{emptyText}</div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background:
          "linear-gradient(180deg, rgba(2,6,23,.97) 0%, rgba(3,9,24,.98) 100%)",
        overflowY: "auto",
        padding: 24,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="container"
        style={{
          maxWidth: 1480,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            borderRadius: 30,
            border: "1px solid rgba(255,255,255,.10)",
            background:
              "radial-gradient(circle at top right, rgba(59,130,246,.15), transparent 28%), radial-gradient(circle at top left, rgba(245,158,11,.10), transparent 20%), rgba(15,23,42,.95)",
            boxShadow: "0 24px 80px rgba(0,0,0,.45)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "28px 30px 22px",
              borderBottom: "1px solid rgba(255,255,255,.08)",
              background: "linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0))",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <img
                  src={LOGO_URL}
                  alt="VP-PHARM"
                  style={{
                    width: 70,
                    height: 70,
                    objectFit: "contain",
                    borderRadius: 20,
                    background: "rgba(255,255,255,.08)",
                    padding: 8,
                    border: "1px solid rgba(255,255,255,.10)",
                  }}
                />

                <div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      lineHeight: 1.15,
                    }}
                  >
                    Executive Briefing VP-PHARM
                  </div>

                  <div className="small" style={{ marginTop: 8, opacity: 0.92 }}>
                    Bản tóm tắt điều hành tự động dành cho Admin / Giám đốc kinh doanh
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <span className="pill">
                      <span className="small">Phạm vi</span>{" "}
                      <span className="kbd">{data.scopeLabel || "Toàn hệ thống"}</span>
                    </span>
                    <span className="pill">
                      <span className="small">Kỳ dữ liệu</span>{" "}
                      <span className="kbd">{data.periodLabel || "Hiện tại"}</span>
                    </span>
                    <span className="pill">
                      <span className="small">Chế độ</span>{" "}
                      <span className="kbd">CEO / Director View</span>
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 20,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                  minWidth: 260,
                }}
              >
                <div className="small" style={{ color: tone.color }}>
                  AI Health Score
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, marginTop: 6 }}>
                  {data.healthScore || 0}/100
                </div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>
                  Trạng thái: {data.healthStatus || tone.badge}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 30, display: "grid", gap: 22 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr .9fr",
                gap: 18,
              }}
            >
              <div
                style={{
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.10)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    Thông điệp điều hành trọng tâm
                  </div>
                  <PriorityBadge
                    level={
                      data.healthScore < 60
                        ? "critical"
                        : data.healthScore < 80
                        ? "important"
                        : "watch"
                    }
                  />
                </div>

                <div
                  style={{
                    fontSize: 17,
                    lineHeight: 1.75,
                    color: "#f8fafc",
                  }}
                >
                  {data.executiveSummary || "Chưa có tóm tắt điều hành."}
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(59,130,246,.10)",
                    border: "1px solid rgba(59,130,246,.22)",
                    lineHeight: 1.65,
                  }}
                >
                  <b>Nhận định nhanh:</b> {topHeadline}
                </div>
              </div>

              <div
                style={{
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.10)",
                  display: "grid",
                  gap: 14,
                  alignContent: "start",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Tín hiệu hành động hôm nay
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(239,68,68,.08)",
                    border: "1px solid rgba(239,68,68,.22)",
                  }}
                >
                  <div className="small" style={{ marginBottom: 6 }}>
                    Ưu tiên 1
                  </div>
                  <div style={{ lineHeight: 1.6 }}>
                    {risks[0] || alerts[0] || "Rà soát ngay các chỉ số doanh số và độ phủ thấp."}
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(245,158,11,.08)",
                    border: "1px solid rgba(245,158,11,.22)",
                  }}
                >
                  <div className="small" style={{ marginBottom: 6 }}>
                    Ưu tiên 2
                  </div>
                  <div style={{ lineHeight: 1.6 }}>
                    {actions[0] ||
                      opportunities[0] ||
                      "Triển khai hành động coaching / mở rộng tuyến theo tín hiệu AI."}
                  </div>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(59,130,246,.08)",
                    border: "1px solid rgba(59,130,246,.22)",
                  }}
                >
                  <div className="small" style={{ marginBottom: 6 }}>
                    Theo dõi
                  </div>
                  <div style={{ lineHeight: 1.6 }}>
                    {trends[0] || "Theo dõi biến động doanh số và chất lượng thực thi ở kỳ tới."}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              {metrics.map((item, index) => (
                <div
                  key={`metric-${index}`}
                  style={{
                    padding: 18,
                    borderRadius: 20,
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.10)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div className="small">{item.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{item.value}</div>
                  {item.sub ? <div className="small">{item.sub}</div> : null}
                </div>
              ))}
            </div>

            <div className="grid two" style={{ gap: 18 }}>
              <BriefColumn
                title="Rủi ro cốt lõi"
                icon="⚠️"
                items={risks}
                emptyText="Chưa ghi nhận rủi ro nổi bật."
                defaultPriority="critical"
              />
              <BriefColumn
                title="Cơ hội nổi bật"
                icon="💡"
                items={opportunities}
                emptyText="Chưa có cơ hội nổi bật."
                defaultPriority="important"
              />
            </div>

            <div className="grid two" style={{ gap: 18 }}>
              <BriefColumn
                title="Cảnh báo hiệu suất"
                icon="📉"
                items={alerts}
                emptyText="Chưa có cảnh báo hiệu suất."
                defaultPriority="critical"
              />
              <BriefColumn
                title="Xu hướng đáng chú ý"
                icon="📈"
                items={trends}
                emptyText="Chưa có xu hướng nổi bật."
                defaultPriority="watch"
              />
            </div>

            <div
              style={{
                padding: 22,
                borderRadius: 24,
                background: "linear-gradient(180deg, rgba(59,130,246,.10), rgba(59,130,246,.06))",
                border: "1px solid rgba(59,130,246,.22)",
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  Kế hoạch hành động đề xuất
                </div>
                <PriorityBadge level="important" />
              </div>

              {actions.length ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {actions.map((item, index) => (
                    <div
                      key={`action-${index}`}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid rgba(255,255,255,.10)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800 }}>Hành động {index + 1}</div>
                        <PriorityBadge
                          level={index === 0 ? "critical" : index <= 2 ? "important" : "watch"}
                        />
                      </div>
                      <div style={{ lineHeight: 1.65 }}>{item}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">Chưa có kế hoạch hành động cụ thể.</div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                flexWrap: "wrap",
                paddingTop: 4,
              }}
            >
              <button
                type="button"
                className="btn secondary"
                onClick={onGoDashboard}
                style={{
                  minWidth: 190,
                  fontWeight: 800,
                }}
              >
                Đi tới Tổng quan
              </button>

              <button
                type="button"
                className="btn"
                onClick={onClose}
                style={{
                  minWidth: 230,
                  fontWeight: 800,
                }}
              >
                Đã xem briefing điều hành
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [authOpen, setAuthOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState("Chưa đăng nhập");
  const [profile, setProfile] = useState(null);

  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [approval, setApproval] = useState({
    approved: false,
    blocked: false,
    role: "pending",
    status: "pending",
  });

  const [notice, setNotice] = useState({
    open: false,
    title: "",
    message: "",
    type: "info",
  });

  const [executiveBriefingData, setExecutiveBriefingData] = useState(null);
  const [briefingOpen, setBriefingOpen] = useState(false);

  function showNotice(title, message, type = "info") {
    setNotice({
      open: true,
      title,
      message,
      type,
    });
  }

  function closeNotice() {
    setNotice((prev) => ({ ...prev, open: false }));
  }

  const role = approval.role || "pending";
  const isDirector = role === "director";
  const canUseApp = authed && (isAdmin || approval.approved);

  const canAccessDashboard = isAdmin || isDirector;
  const canAccessWeekly = isAdmin || isDirector;
  const canAccessReports = isAdmin || isDirector;
  const canAccessAdmin = isAdmin;

  const roleLabel = useMemo(() => {
    if (isAdmin) return "Quản trị hệ thống";
    if (role === "director") return "Giám đốc kinh doanh";
    if (role === "user") return "Nhân viên";
    if (role === "pending") return "Chờ duyệt";
    return role || "Không xác định";
  }, [isAdmin, role]);

  function getDefaultTab(nextIsAdmin, nextRole) {
    if (nextIsAdmin || nextRole === "director") return "dashboard";
    return "weekly";
  }

  function getFallbackTab() {
    if (canAccessDashboard) return "dashboard";
    if (canAccessWeekly) return "weekly";
    if (canAccessReports) return "reports";
    return "weekly";
  }

  function goTab(nextTab) {
    if (!authed) {
      setAuthOpen(true);
      return;
    }

    if (!canUseApp) {
      setAuthOpen(true);
      return;
    }

    if (nextTab === "dashboard" && !canAccessDashboard) {
      showNotice(
        "Không có quyền truy cập",
        "Chức năng Tổng Quan chỉ dành cho Admin hoặc Giám đốc kinh doanh.",
        "warning"
      );
      return;
    }

    if (nextTab === "admin" && !canAccessAdmin) {
      setTab(getFallbackTab());
      return;
    }

    if (nextTab === "weekly" && !canAccessWeekly) {
      showNotice(
        "Không có quyền truy cập",
        "Chức năng Tạo Báo Cáo chỉ dành cho Admin hoặc Giám đốc kinh doanh.",
        "warning"
      );
      return;
    }

    if (nextTab === "reports" && !canAccessReports) {
      showNotice(
        "Không có quyền truy cập",
        "Chức năng Báo Cáo Đã Lưu chỉ dành cho Admin hoặc Giám đốc kinh doanh.",
        "warning"
      );
      return;
    }

    setTab(nextTab);
  }

  function handleCloseBriefing() {
    const scheduleKey = getBriefingScheduleKey(new Date());
    if (scheduleKey) {
      localStorage.setItem(scheduleKey, "1");
    }
    setBriefingOpen(false);
  }

  function handleGoDashboard() {
    setTab("dashboard");
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setReady(false);

        if (!u) {
          setAuthed(false);
          setUserEmail("Chưa đăng nhập");
          setIsAdmin(false);
          setProfile(null);
          setExecutiveBriefingData(null);
          setBriefingOpen(false);
          setApproval({
            approved: false,
            blocked: false,
            role: "pending",
            status: "pending",
          });
          setTab("dashboard");
          setAuthOpen(true);
          setReady(true);
          return;
        }

        setAuthed(true);
        setUserEmail(u.email || "(no email)");

        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            email: u.email || null,
            name: "",
            department: "",
            phone: "",
            role: "pending",
            status: "pending",
            approved: false,
            blocked: false,
            managerUid: "",
            managerName: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const snap2 = await getDoc(ref);
        const rawProfile = snap2.data() || {};

        if ((u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          const adminProfile = {
            ...rawProfile,
            email: u.email || null,
            role: "admin",
            status: "active",
            approved: true,
            blocked: false,
          };

          setIsAdmin(true);
          setProfile(adminProfile);
          setApproval({
            approved: true,
            blocked: false,
            role: "admin",
            status: "active",
          });

          await setDoc(
            ref,
            {
              email: u.email || null,
              role: "admin",
              status: "active",
              approved: true,
              blocked: false,
              approvedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          setTab(getDefaultTab(true, "admin"));
          setAuthOpen(false);
          setReady(true);
          return;
        }

        const approved = !!rawProfile.approved;
        const blocked = !!rawProfile.blocked;
        const normalizedRole = normalizeRole(rawProfile, u.email || "");
        const normalizedStatus =
          rawProfile.status || (approved ? "active" : "pending");

        const nextProfile = {
          ...rawProfile,
          email: rawProfile.email || u.email || null,
          role: normalizedRole,
          status: normalizedStatus,
          approved,
          blocked,
        };

        setIsAdmin(false);
        setProfile(nextProfile);
        setApproval({
          approved,
          blocked,
          role: normalizedRole,
          status: normalizedStatus,
        });

        if (blocked) {
          setTab("dashboard");
          setAuthOpen(false);
          showNotice(
            "Tài khoản bị chặn",
            "Tài khoản của bạn hiện đã bị chặn.\nVui lòng liên hệ Admin để được hỗ trợ.",
            "error"
          );
          await signOut(auth);
          setAuthOpen(true);
          setReady(true);
          return;
        }

        if (!approved) {
          setTab("dashboard");
          setAuthOpen(false);
          showNotice(
            "Đang chờ duyệt",
            `Tài khoản của bạn đang ở trạng thái chờ duyệt, gọi hoặc nhắn tin Zalo cho admin theo số điện thoại sau: ${ADMIN_PHONE}`,
            "warning"
          );
          await signOut(auth);
          setAuthOpen(true);
          setReady(true);
          return;
        }

        setTab(getDefaultTab(false, normalizedRole));
        setAuthOpen(false);
        setReady(true);
      } catch (e) {
        setTab("dashboard");
        showNotice("Có lỗi xảy ra", String(e?.message || e), "error");
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const scheduleKey = getBriefingScheduleKey(new Date());
    const isExecutive = isAdmin || isDirector;

    if (!ready || !authed || !canUseApp || !isExecutive) {
      setBriefingOpen(false);
      return;
    }

    if (!scheduleKey) {
      setBriefingOpen(false);
      return;
    }

    if (!executiveBriefingData) {
      setBriefingOpen(false);
      return;
    }

    const dismissed = localStorage.getItem(scheduleKey) === "1";
    if (!dismissed) {
      setBriefingOpen(true);
    } else {
      setBriefingOpen(false);
    }
  }, [
    ready,
    authed,
    canUseApp,
    isAdmin,
    isDirector,
    executiveBriefingData,
  ]);

  async function logout() {
    await signOut(auth);
    setExecutiveBriefingData(null);
    setBriefingOpen(false);
    setTab("dashboard");
    setAuthOpen(true);
    showNotice("Đăng xuất thành công", "Bạn đã đăng xuất khỏi hệ thống.", "success");
  }

  if (!ready) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card">
          <div className="card-body">
            <div className="small">Đang tải hệ thống VP-PHARM…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header>
        <div className="header-inner">
          <div className="brand">
            <img alt="VP-PHARM Logo" src={LOGO_URL} />
            <div className="title">
              <h1>Hệ thống báo cáo hiệu quả làm việc thông minh bằng AI</h1>
              <p>VP-PHARM · AI Weekly Sales Intelligence</p>
            </div>
          </div>

          <div className="row">
            <div className="pill">
              <span className="small">Người dùng:</span>{" "}
              <span className="kbd">{userEmail}</span>
            </div>

            {canUseApp ? (
              <>
                <div className="pill">
                  <span className="small">Vai trò:</span>{" "}
                  <span className="kbd">{roleLabel}</span>
                </div>

                {canAccessDashboard ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => goTab("dashboard")}
                    style={{
                      borderColor:
                        tab === "dashboard"
                          ? "rgba(20,184,166,.5)"
                          : "rgba(255,255,255,.15)",
                    }}
                  >
                    Tổng Quan
                  </button>
                ) : null}

                {(canAccessWeekly || canAccessReports) && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => goTab("weekly")}
                    style={{
                      borderColor:
                        tab === "weekly"
                          ? "rgba(20,184,166,.5)"
                          : "rgba(255,255,255,.15)",
                    }}
                  >
                    Tạo Báo Cáo
                  </button>
                )}

                {canAccessReports ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => goTab("reports")}
                    style={{
                      borderColor:
                        tab === "reports"
                          ? "rgba(20,184,166,.5)"
                          : "rgba(255,255,255,.15)",
                    }}
                  >
                    Báo Cáo Đã Lưu
                  </button>
                ) : null}

                {canAccessAdmin ? (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => goTab("admin")}
                    style={{
                      borderColor:
                        tab === "admin"
                          ? "rgba(20,184,166,.5)"
                          : "rgba(255,255,255,.15)",
                    }}
                  >
                    Quản Trị
                  </button>
                ) : null}

                <button className="btn secondary" type="button" onClick={logout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <button className="btn" type="button" onClick={() => setAuthOpen(true)}>
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {!canUseApp ? (
          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Chưa có quyền truy cập</h2>
              <p className="small">
                Vui lòng đăng nhập. Tài khoản mới cần Admin duyệt trước khi sử dụng.
              </p>
              <button className="btn" type="button" onClick={() => setAuthOpen(true)}>
                Mở đăng nhập
              </button>
              <div className="hr" />
              <div className="small">
                Admin: <span className="kbd">{ADMIN_EMAIL}</span>
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Số điện thoại / Zalo: <span className="kbd">{ADMIN_PHONE}</span>
              </div>
            </div>
          </div>
        ) : tab === "dashboard" ? (
          <Dashboard
            profile={profile}
            isAdmin={isAdmin}
            isDirector={isDirector}
            onExecutiveBriefingData={setExecutiveBriefingData}
          />
        ) : tab === "weekly" ? (
          <Weekly
            profile={profile}
            isAdmin={isAdmin}
            isDirector={isDirector}
            onNotify={(title, message, type) => showNotice(title, message, type)}
          />
        ) : tab === "reports" ? (
          <Reports
            profile={profile}
            isAdmin={isAdmin}
            isDirector={isDirector}
          />
        ) : tab === "admin" ? (
          isAdmin ? (
            <Admin
              adminEmail={ADMIN_EMAIL}
              isAdmin={isAdmin}
              profile={profile}
              onNotify={(title, message, type) => showNotice(title, message, type)}
            />
          ) : (
            <Dashboard
              profile={profile}
              isAdmin={isAdmin}
              isDirector={isDirector}
              onExecutiveBriefingData={setExecutiveBriefingData}
            />
          )
        ) : (
          <Dashboard
            profile={profile}
            isAdmin={isAdmin}
            isDirector={isDirector}
            onExecutiveBriefingData={setExecutiveBriefingData}
          />
        )}
      </div>

      <AuthModal open={authOpen} />
      <NoticeModal
        open={notice.open}
        title={notice.title}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <ExecutiveBriefingOverlay
        open={briefingOpen}
        data={executiveBriefingData}
        onClose={handleCloseBriefing}
        onGoDashboard={handleGoDashboard}
      />

      <footer>
        <div className="container">
          <div className="small">
            <b>CÔNG TY CỔ PHẦN DƯỢC VP-PHARM</b>
            <br />
            Địa chỉ: Lô B1.4-LK12 - KĐT Thanh Hà, Xã Bình Minh, TP Hà Nội
            <br />
            Điện thoại: 0975 498 284
          </div>
        </div>
      </footer>
    </div>
  );
}
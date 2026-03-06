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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setReady(false);

        if (!u) {
          setAuthed(false);
          setUserEmail("Chưa đăng nhập");
          setIsAdmin(false);
          setProfile(null);
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

  async function logout() {
    await signOut(auth);
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
            />
          )
        ) : (
          <Dashboard
            profile={profile}
            isAdmin={isAdmin}
            isDirector={isDirector}
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
import { useEffect, useState } from "react";
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

export default function App() {
  const [tab, setTab] = useState("weekly");
  const [authOpen, setAuthOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState("Chưa đăng nhập");

  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approval, setApproval] = useState({ approved: false, blocked: false, role: "pending" });

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setReady(false);

        if (!u) {
          setAuthed(false);
          setUserEmail("Chưa đăng nhập");
          setIsAdmin(false);
          setApproval({ approved: false, blocked: false, role: "pending" });
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
            role: "pending",
            approved: false,
            blocked: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const snap2 = snap.exists() ? snap : await getDoc(ref);
        const profile = snap2.data() || {};

        if ((u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
          setApproval({ approved: true, blocked: false, role: "admin" });

          await setDoc(
            ref,
            {
              email: u.email || null,
              role: "admin",
              approved: true,
              blocked: false,
              status: "active",
              approvedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          setAuthOpen(false);
          setReady(true);
          return;
        }

        const approved = !!profile.approved;
        const blocked = !!profile.blocked;

        setIsAdmin(false);
        setApproval({
          approved,
          blocked,
          role: profile.role || (approved ? "user" : "pending"),
        });

        if (blocked) {
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
          showNotice(
            "Đang chờ phê duyệt",
            "Tài khoản của bạn đã được tạo thành công nhưng đang chờ Admin duyệt.\nVui lòng quay lại sau.",
            "warning"
          );
          await signOut(auth);
          setAuthOpen(true);
          setReady(true);
          return;
        }

        setAuthOpen(false);
        setReady(true);
      } catch (e) {
        showNotice("Có lỗi xảy ra", String(e?.message || e), "error");
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  async function logout() {
    await signOut(auth);
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

  const showApp = authed && (isAdmin || approval.approved);

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
              <span className="small">User:</span> <span className="kbd">{userEmail}</span>
            </div>

            {showApp ? (
              <>
                <button className="btn secondary" onClick={() => setTab("weekly")}>
                  Weekly
                </button>
                <button className="btn secondary" onClick={() => setTab("reports")}>
                  Reports
                </button>
                {isAdmin ? (
                  <button className="btn secondary" onClick={() => setTab("admin")}>
                    Admin
                  </button>
                ) : null}
                <button className="btn secondary" onClick={logout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => setAuthOpen(true)}>
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {!showApp ? (
          <div className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>Chưa có quyền truy cập</h2>
              <p className="small">
                Vui lòng đăng nhập. Tài khoản mới cần Admin duyệt trước khi sử dụng.
              </p>
              <button className="btn" onClick={() => setAuthOpen(true)}>
                Mở đăng nhập
              </button>
              <div className="hr" />
              <div className="small">
                Admin: <span className="kbd">{ADMIN_EMAIL}</span>
              </div>
            </div>
          </div>
        ) : tab === "weekly" ? (
          <Weekly />
        ) : tab === "reports" ? (
          <Reports isAdmin={isAdmin} />
        ) : (
          <Admin adminEmail={ADMIN_EMAIL} />
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
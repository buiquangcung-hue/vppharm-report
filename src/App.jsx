import { useEffect, useState } from "react";
import Weekly from "./pages/Weekly.jsx";
import Reports from "./pages/Reports.jsx";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/cnlb-4d714.firebasestorage.app/o/lOGO%20DOC.png?alt=media&token=ad7d71e2-aa27-4ed5-81d8-9f8ee9ace0ac";

export default function App() {
  const [tab, setTab] = useState("weekly");
  const [userEmail, setUserEmail] = useState("Chưa đăng nhập");

  // App vẫn chạy dù anh chưa làm màn login.
  // Nếu có user (Firebase Auth) thì hiển thị email.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email || "Chưa đăng nhập");
    });
    return () => unsub();
  }, []);

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
              <span className="small">User:</span>{" "}
              <span className="kbd">{userEmail}</span>
            </div>

            <button
              className={"btn secondary"}
              onClick={() => setTab("weekly")}
              style={{
                borderColor: tab === "weekly" ? "rgba(20,184,166,.55)" : undefined,
              }}
            >
              Weekly
            </button>

            <button
              className={"btn secondary"}
              onClick={() => setTab("reports")}
              style={{
                borderColor: tab === "reports" ? "rgba(20,184,166,.55)" : undefined,
              }}
            >
              Reports
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        {tab === "weekly" ? <Weekly /> : <Reports />}
      </div>

      <footer>
        <div className="container">
          <div className="small">
            <b>CÔNG TY CỔ PHẦN DƯỢC VP-PHARM</b>
            <br />
            Địa chỉ: Lô B1.4-LK12 - KĐT Thanh Hà, Xã Bình Minh, TP Hà Nội
            <br />
            Điện thoại: 0975 498 284
            <br />
            <span style={{ opacity: 0.85 }}>
              Công nghệ giúp điều hành bán hàng hiệu quả hơn với AI.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
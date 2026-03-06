import { useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase.js";

export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const title = useMemo(() => {
    if (mode === "signup") return "Tạo tài khoản";
    if (mode === "forgot") return "Đặt lại mật khẩu";
    return "Đăng nhập";
  }, [mode]);

  const sub = useMemo(() => {
    if (mode === "signup") return "Tạo tài khoản để lưu và xem lại báo cáo tuần.";
    if (mode === "forgot") return "Nhập email để nhận link đặt lại mật khẩu.";
    return "Đăng nhập bằng email để vào Dashboard báo cáo.";
  }, [mode]);

  const show = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 3200);
  };

  async function submit() {
    try {
      setLoading(true);

      const e = email.trim();
      if (!e) {
        show("Vui lòng nhập email.");
        return;
      }

      if (mode === "forgot") {
        await sendPasswordResetEmail(auth, e);
        show("Đã gửi email đặt lại mật khẩu.");
        setMode("login");
        return;
      }

      if (!pass) {
        show("Vui lòng nhập mật khẩu.");
        return;
      }

      if (mode === "signup") {
        if (pass.length < 8) {
          show("Mật khẩu tối thiểu 8 ký tự.");
          return;
        }
        if (pass !== pass2) {
          show("Mật khẩu nhập lại không khớp.");
          return;
        }
        await createUserWithEmailAndPassword(auth, e, pass);
        show("Đăng ký thành công. Đang vào hệ thống…");
        onClose?.();
        return;
      }

      await signInWithEmailAndPassword(auth, e, pass);
      show("Đăng nhập thành công.");
      onClose?.();
    } catch (err) {
      show(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="overlay show" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <h3>{title}</h3>
            <p>{sub}</p>
          </div>
          <button className="btn secondary" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modal-content">
          <div className="card" style={{ boxShadow: "none" }}>
            <div className="card-body">
              <label>Email</label>
              <input
                type="email"
                placeholder="vd: gdkd@vppharm.vn"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {mode !== "forgot" ? (
                <>
                  <label>Mật khẩu</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </>
              ) : null}

              {mode === "signup" ? (
                <>
                  <label>Nhập lại mật khẩu</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                  />
                  <div className="hint">Khuyến nghị: dùng mật khẩu mạnh và bật MFA trong Firebase Console.</div>
                </>
              ) : null}

              <div style={{ height: 14 }} />

              <button className="btn" style={{ width: "100%" }} disabled={loading} onClick={submit}>
                {loading
                  ? "Đang xử lý..."
                  : mode === "signup"
                  ? "Tạo tài khoản"
                  : mode === "forgot"
                  ? "Gửi email đặt lại"
                  : "Đăng nhập"}
              </button>

              <div style={{ height: 12 }} />

              {mode === "login" ? (
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <button className="btn secondary" disabled={loading} onClick={() => setMode("forgot")}>
                    Quên mật khẩu
                  </button>
                  <button className="btn secondary" disabled={loading} onClick={() => setMode("signup")}>
                    Tạo tài khoản
                  </button>
                </div>
              ) : (
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <button className="btn secondary" disabled={loading} onClick={() => setMode("login")}>
                    Quay lại đăng nhập
                  </button>
                  {mode === "forgot" ? (
                    <button className="btn secondary" disabled={loading} onClick={() => setMode("signup")}>
                      Tạo tài khoản
                    </button>
                  ) : (
                    <button className="btn secondary" disabled={loading} onClick={() => setMode("forgot")}>
                      Quên mật khẩu
                    </button>
                  )}
                </div>
              )}

              {msg ? (
                <div style={{ marginTop: 12 }} className="tag">
                  {msg}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="small">
            Tip: Sau khi đăng nhập, bạn có thể tạo báo cáo tuần và xem lịch sử trong Reports.
          </div>
          <div className="small">
            <span className="kbd">VP-PHARM</span> · AI Weekly Sales Intelligence
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeAuthError(e) {
  const code = e?.code || "";
  if (code === "auth/invalid-credential") return "Sai email hoặc mật khẩu.";
  if (code === "auth/user-not-found") return "Không tìm thấy tài khoản.";
  if (code === "auth/wrong-password") return "Sai mật khẩu.";
  if (code === "auth/email-already-in-use") return "Email đã tồn tại.";
  if (code === "auth/weak-password") return "Mật khẩu quá yếu (tối thiểu 8 ký tự).";
  if (code === "auth/invalid-email") return "Email không hợp lệ.";
  if (code === "auth/too-many-requests") return "Thử lại sau (quá nhiều yêu cầu).";
  return e?.message || "Có lỗi xảy ra.";
}
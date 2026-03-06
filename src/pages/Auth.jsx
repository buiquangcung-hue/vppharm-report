import { useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebase.js";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AuthModal({ open }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const title = useMemo(() => {
    if (mode === "signup") return "Đăng ký tài khoản";
    if (mode === "forgot") return "Quên mật khẩu";
    return "Đăng nhập";
  }, [mode]);

  const show = (text) => {
    setMsg(text);
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
        if (!fullName.trim()) {
          show("Vui lòng nhập Họ và tên.");
          return;
        }
        if (!department.trim()) {
          show("Vui lòng nhập Bộ phận.");
          return;
        }
        if (!phone.trim()) {
          show("Vui lòng nhập Số điện thoại.");
          return;
        }
        if (pass.length < 8) {
          show("Mật khẩu tối thiểu 8 ký tự.");
          return;
        }
        if (pass !== pass2) {
          show("Mật khẩu nhập lại không khớp.");
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, e, pass);

        await setDoc(doc(db, "users", cred.user.uid), {
          name: fullName.trim(),
          email: cred.user.email,
          department: department.trim(),
          phone: phone.trim(),
          role: "pending",
          status: "pending",
          approved: false,
          blocked: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        show("Đăng ký thành công. Tài khoản đang chờ Admin duyệt.");
        return;
      }

      await signInWithEmailAndPassword(auth, e, pass);
    } catch (err) {
      show(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-top" style={{ justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
        </div>

        <div className="modal-content">
          {mode === "signup" ? (
            <>
              <label>Họ và tên</label>
              <input
                type="text"
                placeholder="Nhập họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <label>Bộ phận</label>
              <input
                type="text"
                placeholder="Ví dụ: Kinh doanh, Marketing, Kho..."
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />

              <label>Số điện thoại</label>
              <input
                type="text"
                placeholder="Nhập số điện thoại"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          ) : null}

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
            </>
          ) : null}

          <div style={{ height: 16 }} />

          <button
            className="btn"
            style={{ width: "100%" }}
            disabled={loading}
            onClick={submit}
          >
            {loading
              ? "Đang xử lý..."
              : mode === "signup"
              ? "Tạo tài khoản"
              : mode === "forgot"
              ? "Gửi email"
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
            <button
              className="btn secondary"
              style={{ width: "100%" }}
              disabled={loading}
              onClick={() => setMode("login")}
            >
              Quay lại đăng nhập
            </button>
          )}

          {msg ? (
            <div className="small" style={{ marginTop: 12 }}>
              {msg}
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <div className="small" style={{ textAlign: "center", width: "100%" }}>
            VP-PHARM - CÔNG NGHỆ BÁO CÁO BẰNG AI
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
  if (code === "auth/weak-password") return "Mật khẩu quá yếu.";
  if (code === "auth/invalid-email") return "Email không hợp lệ.";
  if (code === "auth/too-many-requests") return "Quá nhiều yêu cầu, vui lòng thử lại sau.";
  return e?.message || "Có lỗi xảy ra.";
}
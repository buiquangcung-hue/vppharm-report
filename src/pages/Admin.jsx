import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function Admin({ adminEmail, isAdmin, onNotify }) {
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isAdmin) return;

    setErr("");
    const col = collection(db, "users");

    const unsubUsers = onSnapshot(
      col,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(rows);
      },
      (e) => setErr(String(e?.message || e))
    );

    return () => {
      unsubUsers();
    };
  }, [isAdmin]);

  const pending = useMemo(() => {
    return users
      .filter((u) => u.approved === false && u.blocked === false)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [users]);

  const approved = useMemo(() => {
    return users
      .filter((u) => u.approved === true && u.blocked !== true)
      .sort((a, b) => toMillis(b.approvedAt) - toMillis(a.approvedAt));
  }, [users]);

  const blocked = useMemo(() => {
    return users
      .filter((u) => u.blocked === true)
      .sort((a, b) => toMillis(b.blockedAt) - toMillis(a.blockedAt));
  }, [users]);

  const counts = useMemo(
    () => ({
      pending: pending.length,
      approved: approved.length,
      blocked: blocked.length,
    }),
    [pending, approved, blocked]
  );

  async function approveUser(u) {
    if (!isAdmin) return;

    try {
      await setDoc(
        doc(db, "users", u.id),
        {
          approved: true,
          blocked: false,
          status: "active",
          role:
            (u.email || "").toLowerCase() === (adminEmail || "").toLowerCase()
              ? "admin"
              : "user",
          approvedAt: serverTimestamp(),
          blockedAt: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      onNotify?.(
        "Duyệt tài khoản thành công",
        `Đã cấp quyền truy cập cho ${u.name || u.email || "user"}.`,
        "success"
      );
    } catch (e) {
      console.error("approveUser error:", e);
      onNotify?.(
        "Duyệt tài khoản thất bại",
        String(e?.message || e),
        "error"
      );
    }
  }

  async function blockUser(u) {
    if (!isAdmin) return;

    try {
      await setDoc(
        doc(db, "users", u.id),
        {
          approved: false,
          blocked: true,
          status: "blocked",
          role: "blocked",
          blockedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      onNotify?.(
        "Đã chặn tài khoản",
        `${u.name || u.email || "User"} đã bị chặn.`,
        "warning"
      );
    } catch (e) {
      console.error("blockUser error:", e);
      onNotify?.(
        "Chặn tài khoản thất bại",
        String(e?.message || e),
        "error"
      );
    }
  }

  async function unblockUser(u) {
    if (!isAdmin) return;

    try {
      await setDoc(
        doc(db, "users", u.id),
        {
          approved: false,
          blocked: false,
          status: "pending",
          role: "pending",
          blockedAt: null,
          approvedAt: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      onNotify?.(
        "Đã mở lại tài khoản",
        `${u.name || u.email || "User"} đã được chuyển về trạng thái chờ duyệt.`,
        "info"
      );
    } catch (e) {
      console.error("unblockUser error:", e);
      onNotify?.(
        "Mở lại tài khoản thất bại",
        String(e?.message || e),
        "error"
      );
    }
  }

  if (!isAdmin) {
    return null;
  }

  const UserCard = ({ u, actions }) => (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-body">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {u.name || "(Chưa có tên)"}
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              Email: <span className="kbd">{u.email || ""}</span>
            </div>

            <div className="small" style={{ marginTop: 4 }}>
              Bộ phận: <span className="kbd">{u.department || ""}</span>
            </div>

            <div className="small" style={{ marginTop: 4 }}>
              Số điện thoại: <span className="kbd">{u.phone || ""}</span>
            </div>

            <div className="small" style={{ marginTop: 4 }}>
              UID: <span className="kbd">{u.id}</span>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              role: <span className="kbd">{u.role || "pending"}</span> · status:{" "}
              <span className="kbd">{u.status || ""}</span>
            </div>
          </div>

          <div className="row">{actions}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Admin Approval</h2>
          <p>Duyệt user đăng ký mới trước khi truy cập hệ thống.</p>
        </div>
        <div className="card-body">
          <div className="row">
            <span className="pill">
              <span className="small">Pending</span>{" "}
              <span className="kbd">{counts.pending}</span>
            </span>
            <span className="pill">
              <span className="small">Approved</span>{" "}
              <span className="kbd">{counts.approved}</span>
            </span>
            <span className="pill">
              <span className="small">Blocked</span>{" "}
              <span className="kbd">{counts.blocked}</span>
            </span>
          </div>

          {err ? (
            <div className="small" style={{ marginTop: 10 }}>
              Lỗi: {err}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-header">
            <h2>Pending Users</h2>
            <p>Tài khoản đang chờ duyệt</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {pending.length === 0 ? (
              <div className="small">Không có user pending.</div>
            ) : (
              pending.map((u) => (
                <UserCard
                  key={u.id}
                  u={u}
                  actions={
                    <>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => approveUser(u)}
                      >
                        Approve
                      </button>

                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => blockUser(u)}
                      >
                        Block
                      </button>
                    </>
                  }
                />
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Approved Users</h2>
            <p>Đã được cấp quyền truy cập</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {approved.length === 0 ? (
              <div className="small">Chưa có user approved.</div>
            ) : (
              approved.map((u) => (
                <UserCard
                  key={u.id}
                  u={u}
                  actions={
                    (u.email || "").toLowerCase() ===
                    (adminEmail || "").toLowerCase() ? (
                      <span className="pill">
                        <span className="small">ADMIN</span>
                      </span>
                    ) : (
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => blockUser(u)}
                      >
                        Block
                      </button>
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Blocked Users</h2>
          <p>Tài khoản bị chặn</p>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 10 }}>
          {blocked.length === 0 ? (
            <div className="small">Không có user bị chặn.</div>
          ) : (
            blocked.map((u) => (
              <UserCard
                key={u.id}
                u={u}
                actions={
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => unblockUser(u)}
                  >
                    Unblock → Pending
                  </button>
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}
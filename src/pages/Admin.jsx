import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function Admin({ adminEmail }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    const col = collection(db, "users");

    const unsubPending = onSnapshot(
      query(col, where("approved", "==", false), where("blocked", "==", false), orderBy("createdAt", "desc")),
      (snap) => setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(String(e?.message || e))
    );

    const unsubApproved = onSnapshot(
      query(col, where("approved", "==", true), orderBy("approvedAt", "desc")),
      (snap) => setApproved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(String(e?.message || e))
    );

    const unsubBlocked = onSnapshot(
      query(col, where("blocked", "==", true), orderBy("blockedAt", "desc")),
      (snap) => setBlocked(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(String(e?.message || e))
    );

    return () => {
      unsubPending();
      unsubApproved();
      unsubBlocked();
    };
  }, []);

  const counts = useMemo(
    () => ({
      pending: pending.length,
      approved: approved.length,
      blocked: blocked.length,
    }),
    [pending, approved, blocked]
  );

  async function approveUser(u) {
    await updateDoc(doc(db, "users", u.id), {
      approved: true,
      blocked: false,
      status: "active",
      role: u.email === adminEmail ? "admin" : "user",
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function blockUser(u) {
    await updateDoc(doc(db, "users", u.id), {
      approved: false,
      blocked: true,
      status: "blocked",
      role: "blocked",
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function unblockUser(u) {
    await updateDoc(doc(db, "users", u.id), {
      approved: false,
      blocked: false,
      status: "pending",
      role: "pending",
      updatedAt: serverTimestamp(),
    });
  }

  const UserCard = ({ u, actions }) => (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-body">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
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
            <span className="pill"><span className="small">Pending</span> <span className="kbd">{counts.pending}</span></span>
            <span className="pill"><span className="small">Approved</span> <span className="kbd">{counts.approved}</span></span>
            <span className="pill"><span className="small">Blocked</span> <span className="kbd">{counts.blocked}</span></span>
          </div>
          {err ? <div className="small" style={{ marginTop: 10 }}>Lỗi: {err}</div> : null}
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
                      <button className="btn secondary" onClick={() => approveUser(u)}>
                        Approve
                      </button>
                      <button className="btn secondary" onClick={() => blockUser(u)}>
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
                    u.email === adminEmail ? (
                      <span className="pill"><span className="small">ADMIN</span></span>
                    ) : (
                      <button className="btn secondary" onClick={() => blockUser(u)}>
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
                  <button className="btn secondary" onClick={() => unblockUser(u)}>
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
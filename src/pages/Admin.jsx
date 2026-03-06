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
      role: u.email === adminEmail ? "admin" : "user",
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function blockUser(u) {
    await updateDoc(doc(db, "users", u.id), {
      approved: false,
      blocked: true,
      role: "blocked",
      blockedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function unblockUser(u) {
    await updateDoc(doc(db, "users", u.id), {
      approved: false,
      blocked: false,
      role: "pending",
      updatedAt: serverTimestamp(),
    });
  }

  const Row = ({ u, actions }) => (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-body">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 900 }}>{u.email || "(no email)"}</div>
            <div className="small">
              uid: <span className="kbd">{u.id}</span>
            </div>
          </div>
          <div className="row">{actions}</div>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          role: <span className="kbd">{u.role || "pending"}</span> · approved:{" "}
          <span className="kbd">{String(!!u.approved)}</span> · blocked:{" "}
          <span className="kbd">{String(!!u.blocked)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Admin Approval</h2>
          <p>Admin duyệt user đăng ký mới trước khi truy cập hệ thống báo cáo.</p>
        </div>
        <div className="card-body">
          <div className="row">
            <span className="pill">
              <span className="small">Pending</span> <span className="kbd">{counts.pending}</span>
            </span>
            <span className="pill">
              <span className="small">Approved</span> <span className="kbd">{counts.approved}</span>
            </span>
            <span className="pill">
              <span className="small">Blocked</span> <span className="kbd">{counts.blocked}</span>
            </span>
          </div>
          {err ? <div style={{ marginTop: 10 }} className="small">Lỗi: {err}</div> : null}
          <div className="hr" />
          <div className="small">
            Admin email: <span className="kbd">{adminEmail}</span>
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-header">
            <h2>Pending users</h2>
            <p>Các tài khoản vừa đăng ký, chờ duyệt.</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {pending.length === 0 ? (
              <div className="small">Không có user pending.</div>
            ) : (
              pending.map((u) => (
                <Row
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
            <h2>Approved users</h2>
            <p>Danh sách đã được duyệt.</p>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {approved.length === 0 ? (
              <div className="small">Chưa có user approved.</div>
            ) : (
              approved.map((u) => (
                <Row
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
          <h2>Blocked users</h2>
          <p>Đã bị chặn (có thể mở lại về pending).</p>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 10 }}>
          {blocked.length === 0 ? (
            <div className="small">Không có user bị chặn.</div>
          ) : (
            blocked.map((u) => (
              <Row
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
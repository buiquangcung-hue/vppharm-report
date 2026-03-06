import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase.js";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(value) {
  try {
    const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN");
  } catch {
    return "";
  }
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "director") return "Giám đốc";
  return "Người dùng";
}

export default function Admin({ adminEmail, isAdmin, onNotify }) {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [err, setErr] = useState("");

  const [employeeForm, setEmployeeForm] = useState({
    code: "",
    name: "",
    department: "",
    phone: "",
    managerUid: "",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    unit: "",
    price: "",
  });

  const [provinceForm, setProvinceForm] = useState({
    name: "",
    code: "",
  });

  useEffect(() => {
    if (!isAdmin) return;

    setErr("");

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const byCreated = toMillis(b.createdAt) - toMillis(a.createdAt);
            if (byCreated !== 0) return byCreated;
            return String(a.name || a.email || "").localeCompare(
              String(b.name || b.email || ""),
              "vi"
            );
          });
        setUsers(rows);
      },
      (e) => setErr(String(e?.message || e))
    );

    const unsubEmployees = onSnapshot(
      query(collection(db, "employees"), orderBy("name", "asc")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEmployees(rows);
      },
      (e) => setErr(String(e?.message || e))
    );

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(rows);
      },
      (e) => setErr(String(e?.message || e))
    );

    const unsubProvinces = onSnapshot(
      query(collection(db, "provinces"), orderBy("name", "asc")),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProvinces(rows);
      },
      (e) => setErr(String(e?.message || e))
    );

    return () => {
      unsubUsers();
      unsubEmployees();
      unsubProducts();
      unsubProvinces();
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
      .sort(
        (a, b) =>
          toMillis(b.approvedAt || b.updatedAt) -
          toMillis(a.approvedAt || a.updatedAt)
      );
  }, [users]);

  const blocked = useMemo(() => {
    return users
      .filter((u) => u.blocked === true)
      .sort(
        (a, b) =>
          toMillis(b.blockedAt || b.updatedAt) -
          toMillis(a.blockedAt || a.updatedAt)
      );
  }, [users]);

  const managers = useMemo(() => {
    return approved
      .filter((u) => ["director", "admin"].includes(u.role))
      .sort((a, b) =>
        String(a.name || a.email || "").localeCompare(
          String(b.name || b.email || ""),
          "vi"
        )
      );
  }, [approved]);

  const activeEmployees = useMemo(() => {
    return employees
      .filter((e) => e.active !== false)
      .sort((a, b) =>
        String(a.name || a.code || "").localeCompare(
          String(b.name || b.code || ""),
          "vi"
        )
      );
  }, [employees]);

  const counts = useMemo(
    () => ({
      pending: pending.length,
      approved: approved.length,
      blocked: blocked.length,
      managers: managers.length,
      employees: activeEmployees.length,
      products: products.length,
      provinces: provinces.length,
    }),
    [pending, approved, blocked, managers, activeEmployees, products, provinces]
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
              : u.role === "director"
              ? "director"
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
      onNotify?.("Duyệt tài khoản thất bại", String(e?.message || e), "error");
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
          role:
            (u.email || "").toLowerCase() === (adminEmail || "").toLowerCase()
              ? "admin"
              : u.role || "user",
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
      onNotify?.("Chặn tài khoản thất bại", String(e?.message || e), "error");
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
          role:
            (u.email || "").toLowerCase() === (adminEmail || "").toLowerCase()
              ? "admin"
              : u.role === "director"
              ? "director"
              : "user",
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
      onNotify?.("Mở lại tài khoản thất bại", String(e?.message || e), "error");
    }
  }

  async function saveUserRole(userId, nextRole) {
    try {
      await updateDoc(doc(db, "users", userId), {
        role: nextRole,
        status: "active",
        approved: true,
        blocked: false,
        updatedAt: serverTimestamp(),
      });

      onNotify?.("Cập nhật thành công", "Đã lưu vai trò tài khoản.", "success");
    } catch (e) {
      onNotify?.("Cập nhật thất bại", String(e?.message || e), "error");
    }
  }

  async function createEmployee(e) {
    e.preventDefault();

    try {
      const code = String(employeeForm.code || "").trim().toUpperCase();
      const name = String(employeeForm.name || "").trim();
      const department = String(employeeForm.department || "").trim();
      const phone = String(employeeForm.phone || "").trim();
      const manager = managers.find((d) => d.id === employeeForm.managerUid) || null;

      if (!code) throw new Error("Vui lòng nhập mã nhân viên.");
      if (!name) throw new Error("Vui lòng nhập họ và tên.");
      if (!department) throw new Error("Vui lòng nhập bộ phận.");
      if (!phone) throw new Error("Vui lòng nhập số điện thoại.");
      if (!employeeForm.managerUid) {
        throw new Error("Vui lòng chọn người phụ trách.");
      }

      const codeExists = employees.some(
        (x) => String(x.code || "").trim().toUpperCase() === code
      );
      if (codeExists) {
        throw new Error("Mã nhân viên này đã tồn tại trong danh mục employees.");
      }

      await addDoc(collection(db, "employees"), {
        code,
        name,
        department,
        phone,
        managerUid: manager?.id || "",
        managerName: manager?.name || manager?.email || "",
        managerRole: manager?.role || "",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setEmployeeForm({
        code: "",
        name: "",
        department: "",
        phone: "",
        managerUid: "",
      });

      onNotify?.(
        "Tạo nhân viên thành công",
        "Đã tạo nhân viên trong danh mục báo cáo.",
        "success"
      );
    } catch (e2) {
      onNotify?.("Tạo nhân viên thất bại", String(e2?.message || e2), "error");
    }
  }

  async function toggleEmployeeActive(item) {
    try {
      await updateDoc(doc(db, "employees", item.id), {
        active: !(item.active === true),
        updatedAt: serverTimestamp(),
      });
      onNotify?.(
        "Đã cập nhật nhân viên",
        "Trạng thái nhân viên đã được thay đổi.",
        "success"
      );
    } catch (e) {
      onNotify?.("Cập nhật nhân viên thất bại", String(e?.message || e), "error");
    }
  }

  async function createProduct(e) {
    e.preventDefault();

    try {
      const payload = {
        name: String(productForm.name || "").trim(),
        unit: String(productForm.unit || "").trim(),
        price: Number(productForm.price || 0),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!payload.name) throw new Error("Vui lòng nhập tên sản phẩm.");
      if (!payload.unit) throw new Error("Vui lòng nhập đơn vị tính.");
      if (!(payload.price > 0)) throw new Error("Vui lòng nhập giá bán hợp lệ.");

      await addDoc(collection(db, "products"), payload);

      setProductForm({ name: "", unit: "", price: "" });
      onNotify?.(
        "Thêm sản phẩm thành công",
        "Danh mục sản phẩm đã được cập nhật.",
        "success"
      );
    } catch (e2) {
      onNotify?.("Thêm sản phẩm thất bại", String(e2?.message || e2), "error");
    }
  }

  async function toggleProductActive(item) {
    try {
      await updateDoc(doc(db, "products", item.id), {
        active: !(item.active === true),
        updatedAt: serverTimestamp(),
      });
      onNotify?.(
        "Đã cập nhật sản phẩm",
        "Trạng thái sản phẩm đã được thay đổi.",
        "success"
      );
    } catch (e) {
      onNotify?.("Cập nhật sản phẩm thất bại", String(e?.message || e), "error");
    }
  }

  async function createProvince(e) {
    e.preventDefault();

    try {
      const payload = {
        name: String(provinceForm.name || "").trim(),
        code: String(provinceForm.code || "").trim().toUpperCase(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!payload.name) throw new Error("Vui lòng nhập tên tỉnh/thành.");
      if (!payload.code) throw new Error("Vui lòng nhập mã tỉnh/thành.");

      await addDoc(collection(db, "provinces"), payload);

      setProvinceForm({ name: "", code: "" });
      onNotify?.(
        "Thêm tỉnh/thành thành công",
        "Danh mục tỉnh/thành đã được cập nhật.",
        "success"
      );
    } catch (e2) {
      onNotify?.(
        "Thêm tỉnh/thành thất bại",
        String(e2?.message || e2),
        "error"
      );
    }
  }

  async function toggleProvinceActive(item) {
    try {
      await updateDoc(doc(db, "provinces", item.id), {
        active: !(item.active === true),
        updatedAt: serverTimestamp(),
      });
      onNotify?.(
        "Đã cập nhật tỉnh/thành",
        "Trạng thái tỉnh/thành đã được thay đổi.",
        "success"
      );
    } catch (e) {
      onNotify?.(
        "Cập nhật tỉnh/thành thất bại",
        String(e?.message || e),
        "error"
      );
    }
  }

  if (!isAdmin) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Admin Center</h2>
          <p>Quản trị tài khoản đăng nhập, danh mục nhân viên, sản phẩm và tỉnh/thành.</p>
        </div>
        <div className="card-body">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <span className="pill">
              <span className="small">Pending</span> <span className="kbd">{counts.pending}</span>
            </span>
            <span className="pill">
              <span className="small">Approved</span> <span className="kbd">{counts.approved}</span>
            </span>
            <span className="pill">
              <span className="small">Blocked</span> <span className="kbd">{counts.blocked}</span>
            </span>
            <span className="pill">
              <span className="small">Managers</span> <span className="kbd">{counts.managers}</span>
            </span>
            <span className="pill">
              <span className="small">Employees</span> <span className="kbd">{counts.employees}</span>
            </span>
            <span className="pill">
              <span className="small">Products</span> <span className="kbd">{counts.products}</span>
            </span>
            <span className="pill">
              <span className="small">Provinces</span> <span className="kbd">{counts.provinces}</span>
            </span>
          </div>

          {err ? (
            <div className="small" style={{ marginTop: 10 }}>
              Lỗi: {err}
            </div>
          ) : null}

          <div className="hr" />

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setTab("users")}
              style={{ opacity: tab === "users" ? 1 : 0.8 }}
            >
              Users
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setTab("employees")}
              style={{ opacity: tab === "employees" ? 1 : 0.8 }}
            >
              Employees
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setTab("products")}
              style={{ opacity: tab === "products" ? 1 : 0.8 }}
            >
              Products
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setTab("provinces")}
              style={{ opacity: tab === "provinces" ? 1 : 0.8 }}
            >
              Provinces
            </button>
          </div>
        </div>
      </div>

      {tab === "users" ? (
        <>
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
                      right={
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
                      right={
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

          <div className="card">
            <div className="card-header">
              <h2>Approved Users / Account Roles</h2>
              <p>Đổi vai trò tài khoản đăng nhập của hệ thống</p>
            </div>
            <div className="card-body" style={{ display: "grid", gap: 12 }}>
              {approved.length === 0 ? (
                <div className="small">Chưa có user approved.</div>
              ) : (
                approved.map((u) => (
                  <ApprovedUserRoleRow
                    key={u.id}
                    u={u}
                    adminEmail={adminEmail}
                    onSave={saveUserRole}
                    onBlock={() => blockUser(u)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === "employees" ? (
        <div className="grid two">
          <div className="card">
            <div className="card-header">
              <h2>Tạo nhân viên</h2>
              <p>Danh mục nhân viên chỉ dùng để gắn vào báo cáo, không phải tài khoản đăng nhập</p>
            </div>
            <div className="card-body">
              <form onSubmit={createEmployee} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label>Mã nhân viên</label>
                  <input
                    value={employeeForm.code}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="Ví dụ: TDV001"
                  />
                </div>

                <div>
                  <label>Họ và tên</label>
                  <input
                    value={employeeForm.name}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ví dụ: Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label>Bộ phận</label>
                  <input
                    value={employeeForm.department}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({ ...prev, department: e.target.value }))
                    }
                    placeholder="Ví dụ: Sales Miền Trung"
                  />
                </div>

                <div>
                  <label>Số điện thoại</label>
                  <input
                    value={employeeForm.phone}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Ví dụ: 0905123456"
                  />
                </div>

                <div>
                  <label>Người phụ trách</label>
                  <select
                    value={employeeForm.managerUid}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({
                        ...prev,
                        managerUid: e.target.value,
                      }))
                    }
                  >
                    <option value="">-- Chọn người phụ trách --</option>
                    {managers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.email || d.id} ({roleLabel(d.role)})
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn" type="submit">
                  Tạo nhân viên
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Danh sách nhân viên hoạt động</h2>
              <p>Danh mục nhân viên dùng cho dropdown của báo cáo tuần</p>
            </div>
            <div
              className="card-body"
              style={{ display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto" }}
            >
              {activeEmployees.length === 0 ? (
                <div className="small">Chưa có nhân viên nào.</div>
              ) : (
                activeEmployees.map((u) => (
                  <div key={u.id} className="card" style={{ boxShadow: "none" }}>
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
                            Mã NV: <span className="kbd">{u.code || ""}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Bộ phận: <span className="kbd">{u.department || ""}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Số điện thoại: <span className="kbd">{u.phone || ""}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Người phụ trách: <span className="kbd">{u.managerName || "-"}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Vai trò phụ trách:{" "}
                            <span className="kbd">{roleLabel(u.managerRole || "user")}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Trạng thái:{" "}
                            <span className="kbd">{u.active === true ? "active" : "inactive"}</span>
                          </div>

                          <div className="small" style={{ marginTop: 4 }}>
                            Tạo lúc: <span className="kbd">{formatDate(u.createdAt) || "-"}</span>
                          </div>
                        </div>

                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => toggleEmployeeActive(u)}
                        >
                          {u.active === true ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="grid two">
          <div className="card">
            <div className="card-header">
              <h2>Thêm sản phẩm</h2>
              <p>Danh mục dùng cho form báo cáo tuần</p>
            </div>
            <div className="card-body">
              <form onSubmit={createProduct} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label>Tên sản phẩm</label>
                  <input
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ví dụ: Moniplus"
                  />
                </div>

                <div>
                  <label>Đơn vị tính</label>
                  <input
                    value={productForm.unit}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    placeholder="Ví dụ: Hộp"
                  />
                </div>

                <div>
                  <label>Giá bán</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="Ví dụ: 125000"
                  />
                </div>

                <button className="btn" type="submit">
                  Thêm sản phẩm
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Danh sách sản phẩm</h2>
              <p>Bật / tắt sản phẩm dùng trong báo cáo</p>
            </div>
            <div
              className="card-body"
              style={{ display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto" }}
            >
              {products.length === 0 ? (
                <div className="small">Chưa có sản phẩm nào.</div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="card" style={{ boxShadow: "none" }}>
                    <div className="card-body">
                      <div
                        className="row"
                        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>
                            {p.name || "(Không tên)"}
                          </div>
                          <div className="small" style={{ marginTop: 6 }}>
                            Đơn vị tính: <span className="kbd">{p.unit || ""}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Giá bán: <span className="kbd">{formatCurrency(p.price || 0)}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Trạng thái:{" "}
                            <span className="kbd">
                              {p.active === true ? "active" : "inactive"}
                            </span>
                          </div>
                        </div>

                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => toggleProductActive(p)}
                        >
                          {p.active === true ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "provinces" ? (
        <div className="grid two">
          <div className="card">
            <div className="card-header">
              <h2>Thêm tỉnh / thành</h2>
              <p>Danh mục địa bàn cho báo cáo tuần</p>
            </div>
            <div className="card-body">
              <form onSubmit={createProvince} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label>Tên tỉnh / thành</label>
                  <input
                    value={provinceForm.name}
                    onChange={(e) =>
                      setProvinceForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ví dụ: Huế"
                  />
                </div>

                <div>
                  <label>Mã</label>
                  <input
                    value={provinceForm.code}
                    onChange={(e) =>
                      setProvinceForm((prev) => ({
                        ...prev,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ví dụ: HUE"
                  />
                </div>

                <button className="btn" type="submit">
                  Thêm tỉnh / thành
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Danh sách tỉnh / thành</h2>
              <p>Bật / tắt tỉnh / thành dùng trong báo cáo</p>
            </div>
            <div
              className="card-body"
              style={{ display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto" }}
            >
              {provinces.length === 0 ? (
                <div className="small">Chưa có tỉnh / thành nào.</div>
              ) : (
                provinces.map((p) => (
                  <div key={p.id} className="card" style={{ boxShadow: "none" }}>
                    <div className="card-body">
                      <div
                        className="row"
                        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>
                            {p.name || "(Không tên)"}
                          </div>
                          <div className="small" style={{ marginTop: 6 }}>
                            Mã: <span className="kbd">{p.code || ""}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Trạng thái:{" "}
                            <span className="kbd">
                              {p.active === true ? "active" : "inactive"}
                            </span>
                          </div>
                        </div>

                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => toggleProvinceActive(p)}
                        >
                          {p.active === true ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserCard({ u, right }) {
  return (
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
              role: <span className="kbd">{u.role || "user"}</span> · status:{" "}
              <span className="kbd">{u.status || ""}</span>
            </div>

            <div className="small" style={{ marginTop: 4 }}>
              Tạo lúc: <span className="kbd">{formatDate(u.createdAt) || "-"}</span>
            </div>
          </div>

          <div className="row" style={{ flexWrap: "wrap" }}>
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovedUserRoleRow({ u, adminEmail, onSave, onBlock }) {
  const isRootAdmin =
    (u.email || "").toLowerCase() === (adminEmail || "").toLowerCase();

  const [role, setRole] = useState(u.role || "user");

  useEffect(() => {
    setRole(u.role || "user");
  }, [u.id, u.role]);

  return (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-body">
        <div className="grid two" style={{ gap: 14 }}>
          <div>
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
              Vai trò hiện tại: <span className="kbd">{roleLabel(u.role || "user")}</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label>Vai trò</label>
              <select
                value={role}
                disabled={isRootAdmin}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">Người dùng</option>
                <option value="director">Giám đốc</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="row" style={{ flexWrap: "wrap" }}>
              {isRootAdmin ? (
                <span className="pill">
                  <span className="small">ADMIN GỐC</span>
                </span>
              ) : (
                <>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => onSave(u.id, role)}
                  >
                    Lưu thay đổi
                  </button>

                  <button
                    className="btn secondary"
                    type="button"
                    onClick={onBlock}
                  >
                    Block
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
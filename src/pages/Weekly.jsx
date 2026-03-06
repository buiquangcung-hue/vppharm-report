import { useEffect, useMemo, useState } from "react";
import { db, auth, storage } from "../firebase.js";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

function removeVietnameseTones(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function slugifyVietnamese(text = "") {
  return removeVietnameseTones(text)
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function buildWeeklyReportName(weekFrom, employeeName) {
  if (!weekFrom) return "";
  const d = new Date(weekFrom);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `BC_Tuan_${dd}-${mm}-${yy}_${slugifyVietnamese(employeeName || "Nhan-Vien")}`;
}

function buildWeeklyReportDisplayName(weekFrom, employeeName) {
  if (!weekFrom) return "";
  const d = new Date(weekFrom);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `BC_Tuan_${dd}/${mm}/${yy}_${employeeName || "Nhân viên"}`;
}

function formatVND(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value = "") {
  return removeVietnameseTones(String(value || ""))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function matchesManagerFallback(employee, profile, currentUser) {
  const employeeManagerName = normalizeText(employee?.managerName || "");
  const profileName = normalizeText(profile?.name || "");
  const userEmail = normalizeText(currentUser?.email || "");

  if (!employeeManagerName) return false;
  if (profileName && employeeManagerName === profileName) return true;
  if (userEmail && employeeManagerName === userEmail) return true;

  return false;
}

function toPlainTextAnalysis(analysisJson, fallbackText) {
  if (!analysisJson || typeof analysisJson !== "object") return fallbackText || "";

  const lines = [];

  const pushSection = (title, items) => {
    if (!items) return;
    lines.push(title);

    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string") {
          lines.push(`- ${it}`);
        } else if (it && typeof it === "object") {
          const t = it.title || it.name || it.staff || it.label || "Mục";
          const r =
            it.reason ||
            it.rationale ||
            it.focus ||
            it.owner ||
            it.suggested_action ||
            it.description ||
            "";
          lines.push(`- ${t}${r ? `: ${r}` : ""}`);
        }
      }
    } else if (typeof items === "string") {
      lines.push(items);
    } else {
      lines.push(JSON.stringify(items));
    }

    lines.push("");
  };

  pushSection(
    "Tóm tắt chuyến đi",
    analysisJson.tripSummary || analysisJson.executive_summary
  );
  pushSection(
    "Đánh giá nhân viên",
    analysisJson.employeeAssessment || analysisJson.employeePerformance
  );
  pushSection(
    "Đánh giá độ phủ thị trường",
    analysisJson.coverageAssessment || analysisJson.marketCoverage
  );
  pushSection(
    "Đánh giá doanh số",
    analysisJson.salesAssessment || analysisJson.salesPotential
  );
  pushSection("Điểm mạnh nổi bật", analysisJson.strengthHighlights);
  pushSection("Điểm yếu cần cải thiện", analysisJson.weaknessHighlights);
  pushSection("Rủi ro", analysisJson.risks);
  pushSection("Cơ hội", analysisJson.opportunities);
  pushSection(
    "Khuyến nghị quản lý",
    analysisJson.managerRecommendations || analysisJson.managerRecommendation
  );
  pushSection(
    "Kế hoạch tuần tới",
    analysisJson.nextWeekActions || analysisJson.action_plan
  );

  return lines.join("\n").trim();
}

async function uploadWeeklyExcel(file, ownerUid, reportName) {
  const safeName = String(file?.name || "report.xlsx").replace(/\s+/g, "-");
  const path = `weekly-reports/${ownerUid}/${reportName}/${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  return {
    fileName: file.name,
    fileUrl,
    storagePath: path,
    contentType: file.type || "",
    size: file.size || 0,
  };
}

function RequiredMark() {
  return <span style={{ color: "#ff6b6b", marginLeft: 4 }}>*</span>;
}

function FieldLabel({ children, required = false }) {
  return (
    <label>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

const initialForm = {
  weekFrom: "",
  weekTo: "",
  employeeUid: "",
  employeeCode: "",
  employeeName: "",
  province: "",

  visitCustomerCount: "",
  tripRevenue: "",

  employeeStrengths: "",
  employeeWeaknesses: "",

  assignedCustomerCount: "",
  unexploredCustomerCount: "",
  totalMarketCustomerCount: "",

  productLines: [],
  excelFile: null,
};

export default function Weekly({
  profile,
  isAdmin = false,
  isDirector = false,
  onNotify,
}) {
  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisJson, setAnalysisJson] = useState(null);
  const [savedId, setSavedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMasterData() {
      try {
        setLoadingMaster(true);
        setError("");

        const currentUser = auth.currentUser;

        const [employeesSnap, productsSnap, provincesSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "provinces")),
        ]);

        const allEmployees = employeesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const allProducts = productsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((x) => x.active === true)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "vi")
          );

        const allProvinces = provincesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((x) => x.active === true)
          .sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""), "vi")
          );

        const visibleEmployees = allEmployees
          .filter((u) => u.active === true)
          .filter((u) => {
            if (isAdmin) return true;

            if (isDirector) {
              const managerUid = String(u.managerUid || "").trim();
              const currentUid = String(currentUser?.uid || "").trim();

              if (managerUid && currentUid && managerUid === currentUid) {
                return true;
              }

              return matchesManagerFallback(u, profile, currentUser);
            }

            return false;
          })
          .sort((a, b) =>
            String(a.name || a.code || "").localeCompare(
              String(b.name || b.code || ""),
              "vi"
            )
          );

        if (!mounted) return;

        setEmployees(visibleEmployees);
        setProducts(allProducts);
        setProvinces(allProvinces);
      } catch (e) {
        if (!mounted) return;
        setError(String(e?.message || e));
      } finally {
        if (mounted) setLoadingMaster(false);
      }
    }

    loadMasterData();

    return () => {
      mounted = false;
    };
  }, [isAdmin, isDirector, profile?.name]);

  const reportName = useMemo(
    () => buildWeeklyReportName(form.weekFrom, form.employeeName),
    [form.weekFrom, form.employeeName]
  );

  const reportDisplayName = useMemo(
    () => buildWeeklyReportDisplayName(form.weekFrom, form.employeeName),
    [form.weekFrom, form.employeeName]
  );

  const totalExpectedRevenue = useMemo(() => {
    return form.productLines.reduce(
      (sum, item) => sum + Number(item.expectedRevenue || 0),
      0
    );
  }, [form.productLines]);

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleEmployeeChange(employeeUid) {
    const selected = employees.find((e) => e.id === employeeUid) || null;

    setForm((prev) => ({
      ...prev,
      employeeUid: selected?.id || "",
      employeeCode: selected?.code || "",
      employeeName: selected?.name || "",
    }));
  }

  function addSelectedProduct() {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const existed = form.productLines.some((x) => x.productId === product.id);
    if (existed) {
      onNotify?.(
        "Sản phẩm đã tồn tại",
        "Sản phẩm này đã được thêm vào báo cáo.",
        "warning"
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      productLines: [
        ...prev.productLines,
        {
          productId: product.id,
          productName: product.name || "",
          unit: product.unit || "",
          price: Number(product.price || 0),
          quantity: 0,
          expectedRevenue: 0,
        },
      ],
    }));

    setSelectedProductId("");
  }

  function updateProductLineQuantity(index, value) {
    setForm((prev) => {
      const next = [...prev.productLines];
      const qty = toNumber(value);
      next[index] = {
        ...next[index],
        quantity: qty,
        expectedRevenue: qty * Number(next[index].price || 0),
      };
      return { ...prev, productLines: next };
    });
  }

  function removeProductLine(index) {
    setForm((prev) => ({
      ...prev,
      productLines: prev.productLines.filter((_, i) => i !== index),
    }));
  }

  async function submitReport(event) {
    event?.preventDefault?.();

    try {
      setLoading(true);
      setSavedId("");
      setError("");
      setAnalysisText("");
      setAnalysisJson(null);

      const user = auth.currentUser;
      if (!user) throw new Error("Bạn chưa đăng nhập.");

      if (!isAdmin && !isDirector) {
        throw new Error("Chỉ Admin hoặc Giám đốc kinh doanh mới được tạo báo cáo này.");
      }

      if (!form.weekFrom) throw new Error("Vui lòng chọn từ ngày.");
      if (!form.weekTo) throw new Error("Vui lòng chọn đến ngày.");

      if (new Date(form.weekTo).getTime() < new Date(form.weekFrom).getTime()) {
        throw new Error("Đến ngày không thể nhỏ hơn từ ngày.");
      }

      if (!form.employeeUid) throw new Error("Vui lòng chọn nhân viên đi cùng.");
      if (!form.province) throw new Error("Vui lòng chọn địa bàn.");

      if (String(form.visitCustomerCount).trim() === "") {
        throw new Error("Vui lòng nhập số khách hàng đến viếng thăm.");
      }

      if (String(form.tripRevenue).trim() === "") {
        throw new Error("Vui lòng nhập doanh số của cả chuyến đi.");
      }

      if (String(form.assignedCustomerCount).trim() === "") {
        throw new Error("Vui lòng nhập tổng số khách hàng TDV phụ trách.");
      }

      if (String(form.unexploredCustomerCount).trim() === "") {
        throw new Error("Vui lòng nhập số khách hàng chưa khai thác.");
      }

      if (String(form.totalMarketCustomerCount).trim() === "") {
        throw new Error("Vui lòng nhập tổng số khách hàng trên toàn địa bàn.");
      }

      if (!String(form.employeeStrengths || "").trim()) {
        throw new Error("Vui lòng nhập điểm mạnh của nhân viên trong chuyến đi.");
      }

      if (!String(form.employeeWeaknesses || "").trim()) {
        throw new Error("Vui lòng nhập điểm yếu của nhân viên trong chuyến đi.");
      }

      const assignedCustomerCount = toNumber(form.assignedCustomerCount);
      const unexploredCustomerCount = toNumber(form.unexploredCustomerCount);
      const totalMarketCustomerCount = toNumber(form.totalMarketCustomerCount);

      if (unexploredCustomerCount > assignedCustomerCount) {
        throw new Error(
          "Số khách hàng chưa khai thác không thể lớn hơn tổng số khách hàng TDV phụ trách."
        );
      }

      if (assignedCustomerCount > totalMarketCustomerCount) {
        throw new Error(
          "Tổng số khách hàng TDV phụ trách không thể lớn hơn tổng số khách hàng trên toàn địa bàn."
        );
      }

      if (form.productLines.length === 0) {
        throw new Error("Vui lòng thêm ít nhất 1 mặt hàng.");
      }

      for (const line of form.productLines) {
        if (!line.quantity || Number(line.quantity) <= 0) {
          throw new Error(
            `Vui lòng nhập số lượng hợp lệ cho sản phẩm ${line.productName}.`
          );
        }
      }

      if (!form.excelFile) {
        throw new Error("Vui lòng tải lên file báo cáo doanh số tuần.");
      }

      const excelFileMeta = await uploadWeeklyExcel(
        form.excelFile,
        user.uid,
        reportName
      );

      const reportPayload = {
        reportName,
        reportDisplayName,
        weekFrom: form.weekFrom,
        weekTo: form.weekTo,

        director: {
          uid: user.uid,
          name: profile?.name || user.email || "Director",
          email: user.email || "",
        },

        employee: {
          uid: form.employeeUid,
          code: form.employeeCode,
          name: form.employeeName,
        },

        province: form.province,

        visitCustomerCount: toNumber(form.visitCustomerCount),
        tripRevenue: toNumber(form.tripRevenue),

        employeeStrengths: String(form.employeeStrengths || "").trim(),
        employeeWeaknesses: String(form.employeeWeaknesses || "").trim(),

        assignedCustomerCount,
        unexploredCustomerCount,
        totalMarketCustomerCount,

        productLines: form.productLines.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unit: item.unit,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          expectedRevenue: Number(item.expectedRevenue || 0),
        })),

        totalExpectedRevenue,
        excelFile: excelFileMeta,
      };

      const res = await fetch("/api/analyzeWeeklyReport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: reportPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "API error");
      }

      const aJson = data.analysis_json || null;
      const aText = data.analysis_text || data.analysis || "";
      const prettyText = toPlainTextAnalysis(aJson, aText);

      setAnalysisJson(aJson);
      setAnalysisText(prettyText);

      const docRef = await addDoc(collection(db, "weekly_reports"), {
        reportName,
        reportDisplayName,

        weekFrom: form.weekFrom,
        weekTo: form.weekTo,

        ownerUid: user.uid,
        ownerEmail: user.email || null,
        ownerName: profile?.name || user.email || null,
        ownerRole: isAdmin ? "admin" : "director",

        employeeUid: form.employeeUid,
        employeeCode: form.employeeCode,
        employeeName: form.employeeName,

        province: form.province,

        visitCustomerCount: toNumber(form.visitCustomerCount),
        tripRevenue: toNumber(form.tripRevenue),

        employeeStrengths: String(form.employeeStrengths || "").trim(),
        employeeWeaknesses: String(form.employeeWeaknesses || "").trim(),

        assignedCustomerCount,
        unexploredCustomerCount,
        totalMarketCustomerCount,

        productLines: reportPayload.productLines,
        totalExpectedRevenue,

        excelFile: excelFileMeta,

        input: reportPayload,
        analysis_text: prettyText,
        analysis_json: aJson,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSavedId(docRef.id);
      onNotify?.(
        "Đã lưu báo cáo",
        "Báo cáo tuần đã được phân tích và lưu trữ thành công.",
        "success"
      );
    } catch (e) {
      const msg = String(e?.message || e);
      setError(msg);
      setAnalysisText(`Lỗi: ${msg}`);
      onNotify?.("Lưu báo cáo thất bại", msg, "error");
    } finally {
      setLoading(false);
    }
  }

  if (loadingMaster) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="small">Đang tải danh mục báo cáo tuần…</div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isDirector) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Không có quyền tạo báo cáo này</h2>
          <p className="small">
            Chức năng này dành cho Admin hoặc Giám đốc kinh doanh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>Báo cáo đi thị trường tuần</h2>
          <p>Nhập dữ liệu chuyến đi, AI phân tích và lưu trữ báo cáo.</p>
        </div>

        <div className="card-body">
          {error ? (
            <div className="small" style={{ marginBottom: 12 }}>
              Lỗi: {error}
            </div>
          ) : null}

          <form onSubmit={submitReport} style={{ display: "grid", gap: 0 }}>
            <div className="grid two">
              <div>
                <FieldLabel required>Từ ngày</FieldLabel>
                <input
                  type="date"
                  required
                  value={form.weekFrom}
                  onChange={(e) => updateField("weekFrom", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel required>Đến ngày</FieldLabel>
                <input
                  type="date"
                  required
                  value={form.weekTo}
                  onChange={(e) => updateField("weekTo", e.target.value)}
                />
              </div>
            </div>

            <div className="grid two" style={{ marginTop: 12 }}>
              <div>
                <FieldLabel required>Đi với nhân viên</FieldLabel>
                <select
                  required
                  value={form.employeeUid}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.code ? `${emp.code} - ${emp.name}` : emp.name || emp.id}
                    </option>
                  ))}
                </select>
                {!isAdmin && isDirector && employees.length === 0 ? (
                  <div className="small" style={{ marginTop: 6 }}>
                    Hiện chưa có nhân viên nào được gán cho tài khoản giám đốc này.
                  </div>
                ) : null}
              </div>

              <div>
                <FieldLabel required>Đi địa bàn nào</FieldLabel>
                <select
                  required
                  value={form.province}
                  onChange={(e) => updateField("province", e.target.value)}
                >
                  <option value="">-- Chọn tỉnh / thành --</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid two" style={{ marginTop: 12 }}>
              <div>
                <FieldLabel>Tên báo cáo</FieldLabel>
                <input value={reportDisplayName || ""} disabled />
              </div>

              <div>
                <FieldLabel>Trạng thái lưu</FieldLabel>
                <div className="pill" style={{ marginTop: 2 }}>
                  {savedId ? (
                    <>
                      <span className="small">Đã lưu:</span>
                      <span className="kbd">{savedId}</span>
                    </>
                  ) : (
                    <span className="small">Chưa lưu</span>
                  )}
                </div>
              </div>
            </div>

            <div className="hr" />

            <div className="grid two">
              <div>
                <FieldLabel required>Số khách hàng đến viếng thăm</FieldLabel>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.visitCustomerCount}
                  onChange={(e) => updateField("visitCustomerCount", e.target.value)}
                />
              </div>

              <div>
                <FieldLabel required>Doanh số của cả chuyến đi cùng TDV (VND)</FieldLabel>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.tripRevenue}
                  onChange={(e) => updateField("tripRevenue", e.target.value)}
                />
                <div className="small" style={{ marginTop: 6 }}>
                  {formatVND(form.tripRevenue || 0)}
                </div>
              </div>
            </div>

            <div className="grid two" style={{ marginTop: 12 }}>
              <div>
                <FieldLabel required>Tổng số khách hàng TDV phụ trách</FieldLabel>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.assignedCustomerCount}
                  onChange={(e) =>
                    updateField("assignedCustomerCount", e.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel required>Số khách hàng chưa khai thác</FieldLabel>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.unexploredCustomerCount}
                  onChange={(e) =>
                    updateField("unexploredCustomerCount", e.target.value)
                  }
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <FieldLabel required>Tổng số khách hàng trên toàn địa bàn</FieldLabel>
              <input
                type="number"
                min="0"
                required
                value={form.totalMarketCustomerCount}
                onChange={(e) =>
                  updateField("totalMarketCustomerCount", e.target.value)
                }
              />
            </div>

            <div className="hr" />

            <FieldLabel required>Điểm mạnh của nhân viên trong chuyến đi</FieldLabel>
            <textarea
              required
              rows={4}
              value={form.employeeStrengths}
              onChange={(e) => updateField("employeeStrengths", e.target.value)}
            />

            <FieldLabel required>Điểm yếu của nhân viên trong chuyến đi</FieldLabel>
            <textarea
              required
              rows={4}
              value={form.employeeWeaknesses}
              onChange={(e) => updateField("employeeWeaknesses", e.target.value)}
            />

            <div className="hr" />

            <div className="grid two">
              <div>
                <FieldLabel>Doanh số mặt hàng</FieldLabel>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">-- Chọn mặt hàng --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.unit} · {formatVND(p.price || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={addSelectedProduct}
                >
                  Thêm mặt hàng
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {form.productLines.length === 0 ? (
                <div className="small">Chưa có mặt hàng nào được thêm.</div>
              ) : (
                form.productLines.map((item, index) => (
                  <div
                    key={item.productId}
                    className="card"
                    style={{ boxShadow: "none" }}
                  >
                    <div className="card-body">
                      <div className="grid two" style={{ gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>
                            {item.productName}
                          </div>
                          <div className="small" style={{ marginTop: 6 }}>
                            Đơn vị tính: <span className="kbd">{item.unit}</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>
                            Giá bán: <span className="kbd">{formatVND(item.price)}</span>
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          <div>
                            <FieldLabel required>Số lượng</FieldLabel>
                            <input
                              type="number"
                              min="0"
                              required
                              value={item.quantity}
                              onChange={(e) =>
                                updateProductLineQuantity(index, e.target.value)
                              }
                            />
                          </div>

                          <div className="small">
                            Doanh số dự kiến:{" "}
                            <span className="kbd">
                              {formatVND(item.expectedRevenue || 0)}
                            </span>
                          </div>

                          <div>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => removeProductLine(index)}
                            >
                              Xóa mặt hàng
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pill" style={{ marginTop: 12 }}>
              <span className="small">Tổng doanh số dự kiến:</span>{" "}
              <span className="kbd">{formatVND(totalExpectedRevenue)}</span>
            </div>

            <div className="hr" />

            <div>
              <FieldLabel required>
                Nhập file báo cáo doanh số tuần làm việc (Excel từ ERP VP-PHARM)
              </FieldLabel>
              <input
                required
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => updateField("excelFile", e.target.files?.[0] || null)}
              />
              <div className="small" style={{ marginTop: 8 }}>
                {form.excelFile
                  ? `Đã chọn file: ${form.excelFile.name}`
                  : "Chưa chọn file Excel."}
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="row">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "AI đang phân tích..." : "PHÂN TÍCH BÁO CÁO VÀ LƯU TRỮ"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Kết quả phân tích AI</h2>
        </div>

        <div className="card-body">
          <div
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(255,255,255,.06)",
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.10)",
              minHeight: 180,
            }}
          >
            {analysisText || "Chưa có kết quả."}
          </div>

          {analysisJson ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                Xem JSON cấu trúc
              </summary>
              <pre
                style={{
                  overflow: "auto",
                  background: "rgba(0,0,0,.25)",
                  color: "#d6e2ff",
                  padding: 12,
                  borderRadius: 12,
                  marginTop: 10,
                }}
              >
                {JSON.stringify(analysisJson, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
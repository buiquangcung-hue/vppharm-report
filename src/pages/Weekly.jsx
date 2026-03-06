import { useEffect, useMemo, useRef, useState } from "react";
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
    "TÓM TẮT CHUYẾN ĐI",
    analysisJson.tripSummary || analysisJson.executive_summary
  );
  pushSection(
    "ĐÁNH GIÁ NHÂN VIÊN",
    analysisJson.employeeAssessment || analysisJson.employeePerformance
  );
  pushSection(
    "ĐÁNH GIÁ ĐỘ PHỦ THỊ TRƯỜNG",
    analysisJson.coverageAssessment || analysisJson.marketCoverage
  );
  pushSection(
    "ĐÁNH GIÁ DOANH SỐ",
    analysisJson.salesAssessment || analysisJson.salesPotential
  );
  pushSection("ĐIỂM MẠNH NỔI BẬT", analysisJson.strengthHighlights);
  pushSection("ĐIỂM YẾU CẦN CẢI THIỆN", analysisJson.weaknessHighlights);
  pushSection("RỦI RO", analysisJson.risks);
  pushSection("CƠ HỘI", analysisJson.opportunities);
  pushSection(
    "KHUYẾN NGHỊ QUẢN LÝ",
    analysisJson.managerRecommendations || analysisJson.managerRecommendation
  );
  pushSection(
    "KẾ HOẠCH TUẦN TỚI",
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
    <label style={{ fontWeight: 700, letterSpacing: 0.2 }}>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontWeight: 900,
          fontSize: 16,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div className="small" style={{ marginTop: 4 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,.06)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div className="small">{title}</div>
      <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{value}</div>
      {sub ? (
        <div className="small" style={{ marginTop: 6 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function normalizeArrayContent(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data === "string") return [data];
  if (typeof data === "object") return [data];
  return [];
}

function renderInsightItem(item, index) {
  if (typeof item === "string") {
    return (
      <div
        key={index}
        style={{
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        {item}
      </div>
    );
  }

  if (item && typeof item === "object") {
    const title = item.title || item.name || item.staff || item.label || `Mục ${index + 1}`;
    const desc =
      item.reason ||
      item.rationale ||
      item.focus ||
      item.owner ||
      item.suggested_action ||
      item.description ||
      item.summary ||
      "";

    return (
      <div
        key={index}
        style={{
          padding: 12,
          borderRadius: 12,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>
        {desc ? (
          <div className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {desc}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function AnalysisSection({ title, data }) {
  const items = normalizeArrayContent(data);

  if (!items.length) return null;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => renderInsightItem(item, index))}
      </div>
    </div>
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

  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  const progressIntervalRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

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

  function startFakeProgress() {
    const progressSteps = [
      { text: "Đang tải file Excel lên hệ thống...", percent: 12 },
      { text: "Đang chuẩn hóa dữ liệu chuyến đi...", percent: 22 },
      { text: "Đang gửi dữ liệu sang AI phân tích...", percent: 36 },
      { text: "Đang đọc dữ liệu báo cáo tuần...", percent: 48 },
      { text: "Đang đánh giá độ phủ thị trường...", percent: 60 },
      { text: "Đang phân tích doanh số và cơ hội...", percent: 72 },
      { text: "Đang tổng hợp nhận định quản lý...", percent: 84 },
      { text: "Đang hoàn thiện kết quả AI...", percent: 92 },
    ];

    let step = 0;
    setProgressText(progressSteps[0].text);
    setProgressPercent(progressSteps[0].percent);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      step += 1;
      const currentStep = progressSteps[Math.min(step, progressSteps.length - 1)];
      setProgressText(currentStep.text);
      setProgressPercent(currentStep.percent);
    }, 2500);
  }

  function stopFakeProgress() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  async function submitReport(event) {
    event?.preventDefault?.();

    if (loading) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      setLoading(true);
      setSavedId("");
      setError("");
      setAnalysisText("");
      setAnalysisJson(null);
      setProgressText("");
      setProgressPercent(0);

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

      setProgressText("Đang tải file Excel lên hệ thống...");
      setProgressPercent(10);

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

      startFakeProgress();

      console.time("analyzeWeeklyReport");

      const res = await fetch("/api/analyzeWeeklyReport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: reportPayload,
        }),
        signal: controller.signal,
      });

      console.timeEnd("analyzeWeeklyReport");

      stopFakeProgress();
      setProgressText("Đang xử lý kết quả AI...");
      setProgressPercent(96);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || data?.message || "API error");
      }

      const aJson = data.analysis_json || null;
      const aText = data.analysis_text || data.analysis || "";
      const prettyText = toPlainTextAnalysis(aJson, aText);

      setAnalysisJson(aJson);
      setAnalysisText(prettyText);

      setProgressText("Đang lưu báo cáo vào hệ thống...");
      setProgressPercent(98);

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

      setProgressText("Hoàn tất phân tích và lưu trữ báo cáo.");
      setProgressPercent(100);

      setSavedId(docRef.id);
      onNotify?.(
        "Đã lưu báo cáo",
        "Báo cáo tuần đã được phân tích và lưu trữ thành công.",
        "success"
      );
    } catch (e) {
      stopFakeProgress();

      const msg =
        e?.name === "AbortError"
          ? "AI xử lý quá lâu, hệ thống đã tự dừng sau 45 giây. Có thể API đang treo, prompt quá dài hoặc server đang chậm."
          : String(e?.message || e);

      setError(msg);
      setAnalysisText(`Lỗi: ${msg}`);
      setProgressText("");
      setProgressPercent(0);

      onNotify?.("Lưu báo cáo thất bại", msg, "error");
    } finally {
      clearTimeout(timeoutId);
      stopFakeProgress();

      setLoading(false);

      setTimeout(() => {
        setProgressText("");
        setProgressPercent(0);
      }, 1200);
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
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-header" style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.06)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <span>VP-PHARM</span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span>{isAdmin ? "ADMIN" : "DIRECTOR"}</span>
          </div>

          <h2
            style={{
              fontSize: 24,
              marginBottom: 6,
              letterSpacing: 0.4,
            }}
          >
            BÁO CÁO ĐI THỊ TRƯỜNG TUẦN
          </h2>
          <p>Nhập dữ liệu chuyến đi, AI phân tích và lưu trữ báo cáo điều hành.</p>
        </div>

        <div className="card-body">
          {error ? (
            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,.35)",
                background: "rgba(239,68,68,.10)",
              }}
            >
              <div className="small" style={{ color: "#ffd5d5" }}>
                Lỗi: {error}
              </div>
            </div>
          ) : null}

          <div className="grid two" style={{ marginBottom: 16 }}>
            <StatCard
              title="Nhân viên khả dụng"
              value={employees.length}
              sub={isAdmin ? "Admin thấy toàn bộ nhân viên active" : "Giám đốc chỉ thấy nhân viên thuộc team mình"}
            />
            <StatCard
              title="Sản phẩm đang hoạt động"
              value={products.length}
              sub="Danh mục dùng cho báo cáo tuần"
            />
          </div>

          <form onSubmit={submitReport} style={{ display: "grid", gap: 16 }}>
            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-body">
                <SectionTitle
                  title="Thông tin chuyến đi"
                  subtitle="Thiết lập tuần làm việc, nhân viên đi cùng và địa bàn phụ trách."
                />

                <div className="grid two">
                  <div>
                    <FieldLabel required>Từ ngày</FieldLabel>
                    <input
                      type="date"
                      required
                      value={form.weekFrom}
                      onChange={(e) => updateField("weekFrom", e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <FieldLabel required>Đến ngày</FieldLabel>
                    <input
                      type="date"
                      required
                      value={form.weekTo}
                      onChange={(e) => updateField("weekTo", e.target.value)}
                      disabled={loading}
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
                      disabled={loading}
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
                      disabled={loading}
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
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-body">
                <SectionTitle
                  title="Hiệu quả chuyến đi"
                  subtitle="Ghi nhận độ phủ khách hàng, doanh số và quy mô thị trường."
                />

                <div className="grid two">
                  <div>
                    <FieldLabel required>Số khách hàng đến viếng thăm</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      required
                      value={form.visitCustomerCount}
                      onChange={(e) => updateField("visitCustomerCount", e.target.value)}
                      disabled={loading}
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
                      disabled={loading}
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
                      disabled={loading}
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
                      disabled={loading}
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
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-body">
                <SectionTitle
                  title="Đánh giá nhân viên"
                  subtitle="Nhập nhận xét thực tế để AI đưa ra đánh giá sâu hơn."
                />

                <FieldLabel required>Điểm mạnh của nhân viên trong chuyến đi</FieldLabel>
                <textarea
                  required
                  rows={5}
                  value={form.employeeStrengths}
                  onChange={(e) => updateField("employeeStrengths", e.target.value)}
                  placeholder="Ví dụ: chủ động mở rộng điểm bán, giao tiếp khách hàng tốt, nắm sản phẩm tốt..."
                  disabled={loading}
                />

                <FieldLabel required>Điểm yếu của nhân viên trong chuyến đi</FieldLabel>
                <textarea
                  required
                  rows={5}
                  value={form.employeeWeaknesses}
                  onChange={(e) => updateField("employeeWeaknesses", e.target.value)}
                  placeholder="Ví dụ: theo dõi sau bán chưa sát, chưa chốt được nhóm khách hàng mới..."
                  disabled={loading}
                />
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-body">
                <SectionTitle
                  title="Cơ cấu doanh số mặt hàng"
                  subtitle="Thêm các sản phẩm trọng tâm và nhập số lượng để tính doanh số dự kiến."
                />

                <div className="grid two">
                  <div>
                    <FieldLabel>Chọn mặt hàng</FieldLabel>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      disabled={loading}
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
                      style={{ minWidth: 180 }}
                      disabled={loading}
                    >
                      Thêm mặt hàng
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {form.productLines.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        border: "1px dashed rgba(255,255,255,.16)",
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      <div className="small">Chưa có mặt hàng nào được thêm.</div>
                    </div>
                  ) : (
                    form.productLines.map((item, index) => (
                      <div
                        key={item.productId}
                        className="card"
                        style={{
                          boxShadow: "none",
                          background: "rgba(255,255,255,.05)",
                        }}
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
                                  disabled={loading}
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
                                  disabled={loading}
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

                <div
                  className="pill"
                  style={{
                    marginTop: 14,
                    justifyContent: "center",
                    display: "inline-flex",
                    padding: "10px 14px",
                  }}
                >
                  <span className="small">Tổng doanh số dự kiến:</span>{" "}
                  <span className="kbd">{formatVND(totalExpectedRevenue)}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card-body">
                <SectionTitle
                  title="File Excel đối soát"
                  subtitle="Tải lên file Excel báo cáo tuần từ ERP VP-PHARM để lưu cùng báo cáo AI."
                />

                <FieldLabel required>
                  Nhập file báo cáo doanh số tuần làm việc (Excel từ ERP VP-PHARM)
                </FieldLabel>
                <input
                  required
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => updateField("excelFile", e.target.files?.[0] || null)}
                  disabled={loading}
                />
                <div className="small" style={{ marginTop: 8 }}>
                  {form.excelFile
                    ? `Đã chọn file: ${form.excelFile.name}`
                    : "Chưa chọn file Excel."}
                </div>
              </div>
            </div>

            <div
              className="row"
              style={{
                justifyContent: "center",
                marginTop: 6,
              }}
            >
              <button
                className="btn"
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px 28px",
                  fontSize: 15,
                  minWidth: 320,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  opacity: loading ? 0.85 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "AI ĐANG PHÂN TÍCH..." : "PHÂN TÍCH BÁO CÁO VÀ LƯU TRỮ"}
              </button>
            </div>

            {loading ? (
              <div
                style={{
                  marginTop: 6,
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>AI đang xử lý báo cáo</div>
                  <div className="small">{progressPercent}%</div>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: 10,
                    background: "rgba(255,255,255,.08)",
                    borderRadius: 999,
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(6, progressPercent)}%`,
                      height: "100%",
                      borderRadius: 999,
                      transition: "width .6s ease",
                      background:
                        "linear-gradient(90deg, rgba(59,130,246,0.95), rgba(16,185,129,0.95))",
                    }}
                  />
                </div>

                <div className="small" style={{ lineHeight: 1.6 }}>
                  {progressText || "Hệ thống đang xử lý..."}
                </div>

                <div className="small" style={{ marginTop: 8, opacity: 0.8 }}>
                  Hệ thống sẽ tự dừng nếu xử lý quá 45 giây để tránh treo vô hạn.
                </div>
              </div>
            ) : null}
          </form>
        </div>
      </div>

      <div className="card">
        <div
          className="card-header"
          style={{
            textAlign: "center",
            paddingBottom: 8,
          }}
        >
          <h2
            style={{
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            KẾT QUẢ PHÂN TÍCH BÁO CÁO BẰNG AI
          </h2>
          <p>Tổng hợp đánh giá điều hành từ dữ liệu báo cáo tuần và file Excel đính kèm.</p>
        </div>

        <div className="card-body">
          <div className="grid two" style={{ marginBottom: 14 }}>
            <StatCard
              title="Tên báo cáo"
              value={reportDisplayName || "-"}
              sub="Sinh tự động theo tuần làm việc và nhân viên"
            />
            <StatCard
              title="Doanh số dự kiến"
              value={formatVND(totalExpectedRevenue)}
              sub="Tổng từ toàn bộ mặt hàng đã nhập"
            />
          </div>

          {analysisJson ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="grid two">
                <AnalysisSection
                  title="Tóm tắt chuyến đi"
                  data={analysisJson.tripSummary || analysisJson.executive_summary}
                />
                <AnalysisSection
                  title="Đánh giá nhân viên"
                  data={analysisJson.employeeAssessment || analysisJson.employeePerformance}
                />
              </div>

              <div className="grid two">
                <AnalysisSection
                  title="Đánh giá độ phủ thị trường"
                  data={analysisJson.coverageAssessment || analysisJson.marketCoverage}
                />
                <AnalysisSection
                  title="Đánh giá doanh số"
                  data={analysisJson.salesAssessment || analysisJson.salesPotential}
                />
              </div>

              <div className="grid two">
                <AnalysisSection
                  title="Điểm mạnh nổi bật"
                  data={analysisJson.strengthHighlights}
                />
                <AnalysisSection
                  title="Điểm yếu cần cải thiện"
                  data={analysisJson.weaknessHighlights}
                />
              </div>

              <div className="grid two">
                <AnalysisSection title="Rủi ro" data={analysisJson.risks} />
                <AnalysisSection title="Cơ hội" data={analysisJson.opportunities} />
              </div>

              <div className="grid two">
                <AnalysisSection
                  title="Khuyến nghị quản lý"
                  data={
                    analysisJson.managerRecommendations ||
                    analysisJson.managerRecommendation
                  }
                />
                <AnalysisSection
                  title="Kế hoạch tuần tới"
                  data={analysisJson.nextWeekActions || analysisJson.action_plan}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                whiteSpace: "pre-wrap",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04))",
                padding: 18,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,.10)",
                minHeight: 220,
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              {analysisText || "Chưa có kết quả."}
            </div>
          )}

          {analysisJson ? (
            <details style={{ marginTop: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                Xem JSON cấu trúc
              </summary>
              <pre
                style={{
                  overflow: "auto",
                  background: "rgba(0,0,0,.25)",
                  color: "#d6e2ff",
                  padding: 14,
                  borderRadius: 14,
                  marginTop: 10,
                  border: "1px solid rgba(255,255,255,.10)",
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
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import {
  BarChart3,
  MapPinned,
  TrendingUp,
  TriangleAlert,
  Lightbulb,
  Users,
  FileText,
  HandCoins,
  CalendarRange,
  Activity,
  Target,
  BriefcaseBusiness,
  ShieldAlert,
  CircleCheckBig,
  Clock3,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { exportDashboardPDF } from "../utils/exportDashboardPDF";

const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/cnlb-4d714.firebasestorage.app/o/lOGO%20DOC.png?alt=media&token=ad7d71e2-aa27-4ed5-81d8-9f8ee9ace0ac";

function formatVND(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(value) {
  const num = Number(value || 0);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatVNDate(value) {
  if (!value) return "";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatVNDateTime(value) {
  if (!value) return "";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN");
}

function formatWeekLabel(weekCode = "") {
  const match = String(weekCode || "").match(/^(\d{4})-W(\d{2})$/);
  if (!match) return "";
  return `Tuần ${match[2]}/${match[1]}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function removeVietnameseTones(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
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

function safeShortName(text = "", max = 18) {
  const str = String(text || "");
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDaysInclusive(from, to) {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function fmtDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseReportDate(item) {
  const raw =
    item.weekFrom ||
    item?.input?.weekFrom ||
    item.createdAt?.toDate?.() ||
    item.createdAt ||
    null;

  const d = raw instanceof Date ? raw : raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function calcChange(current, previous) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev === 0) {
    if (cur === 0) return 0;
    return 100;
  }
  return ((cur - prev) / prev) * 100;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function sumBy(items, selector) {
  return items.reduce((sum, item) => sum + Number(selector(item) || 0), 0);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + Number(v || 0), 0) / values.length;
}

function scoreColor(score) {
  if (score >= 80) return "Tốt";
  if (score >= 60) return "Theo dõi";
  return "Cảnh báo";
}

function scoreTone(score) {
  if (score >= 80) {
    return {
      bg: "rgba(34,197,94,.14)",
      border: "rgba(34,197,94,.35)",
      text: "#c9ffd9",
      label: "XANH",
    };
  }
  if (score >= 60) {
    return {
      bg: "rgba(245,158,11,.14)",
      border: "rgba(245,158,11,.35)",
      text: "#ffe8b3",
      label: "VÀNG",
    };
  }
  return {
    bg: "rgba(239,68,68,.14)",
    border: "rgba(239,68,68,.35)",
    text: "#ffd0d0",
    label: "ĐỎ",
  };
}

function statusPill(level) {
  if (level === "good") {
    return {
      text: "Tốt",
      bg: "rgba(34,197,94,.14)",
      border: "rgba(34,197,94,.35)",
      color: "#c9ffd9",
    };
  }
  if (level === "watch") {
    return {
      text: "Theo dõi",
      bg: "rgba(245,158,11,.14)",
      border: "rgba(245,158,11,.35)",
      color: "#ffe8b3",
    };
  }
  return {
    text: "Cảnh báo",
    bg: "rgba(239,68,68,.14)",
    border: "rgba(239,68,68,.35)",
    color: "#ffd0d0",
  };
}

function classifyMetric(value, goodThreshold, watchThreshold) {
  if (value >= goodThreshold) return "good";
  if (value >= watchThreshold) return "watch";
  return "alert";
}

function KpiCard({ icon, title, value, sub, change }) {
  const hasChange = typeof change === "number" && Number.isFinite(change);
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,.06)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.10)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.10)",
          }}
        >
          {icon}
        </div>
        <div className="small">{title}</div>
      </div>

      <div style={{ fontWeight: 900, fontSize: 24 }}>{value}</div>

      <div className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sub ? <span>{sub}</span> : null}
        {hasChange ? <span className="kbd">{formatPct(change)}</span> : null}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon, children }) {
  return (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          {icon ? (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.10)",
              }}
            >
              {icon}
            </div>
          ) : null}
          <h2 style={{ textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>
            {title}
          </h2>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function RankList({ items, emptyText, valueFormatter = (x) => x }) {
  if (!items.length) return <div className="small">{emptyText}</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          style={{
            padding: 12,
            background: "rgba(255,255,255,.06)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,.10)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>
              #{index + 1} · {item.label}
            </div>
            {item.sub ? (
              <div className="small" style={{ marginTop: 4 }}>
                {item.sub}
              </div>
            ) : null}
          </div>
          <div className="kbd">{valueFormatter(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function InsightList({ items, emptyText }) {
  if (!items.length) return <div className="small">{emptyText}</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item, index) => (
        <div
          key={`${index}-${String(item).slice(0, 20)}`}
          style={{
            padding: 12,
            background: "rgba(255,255,255,.06)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,.10)",
            lineHeight: 1.6,
          }}
        >
          {typeof item === "string"
            ? item
            : item?.title
            ? `${item.title}${item?.reason ? `: ${item.reason}` : ""}`
            : JSON.stringify(item)}
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, data, dataKey = "value", valueFormatter }) {
  if (!data.length) {
    return (
      <SectionCard title={title} subtitle={subtitle} icon={<BarChart3 size={18} />}>
        <div className="small">Chưa có dữ liệu để hiển thị biểu đồ.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={title} subtitle={subtitle} icon={<BarChart3 size={18} />}>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="shortLabel" stroke="rgba(255,255,255,.65)" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="rgba(255,255,255,.65)"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => (typeof valueFormatter === "function" ? valueFormatter(v) : v)}
              width={90}
            />
            <Tooltip
              formatter={(value) =>
                typeof valueFormatter === "function" ? valueFormatter(value) : value
              }
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                color: "#fff",
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Bar dataKey={dataKey} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function TrendCard({ data }) {
  if (!data.length) {
    return (
      <SectionCard
        title="Xu hướng doanh số theo tuần"
        subtitle="Theo tuần làm việc của báo cáo"
        icon={<TrendingUp size={18} />}
      >
        <div className="small">Chưa có dữ liệu xu hướng.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Xu hướng doanh số theo tuần"
      subtitle="Theo tuần làm việc của báo cáo"
      icon={<TrendingUp size={18} />}
    >
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="label" stroke="rgba(255,255,255,.65)" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="rgba(255,255,255,.65)"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => formatVND(v)}
              width={90}
            />
            <Tooltip
              formatter={(value) => formatVND(value)}
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                color: "#fff",
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Line type="monotone" dataKey="value" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      className="btn secondary"
      onClick={onClick}
      style={{
        opacity: active ? 1 : 0.82,
        borderColor: active ? "rgba(20,184,166,.5)" : "rgba(255,255,255,.15)",
      }}
    >
      {children}
    </button>
  );
}

function StatusPill({ level }) {
  const tone = statusPill(level);
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {tone.text}
    </span>
  );
}

function ExecutiveItem({ title, value, level, sub }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.10)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div className="small">{title}</div>
        <StatusPill level={level} />
      </div>
      <div style={{ fontWeight: 900, fontSize: 22 }}>{value}</div>
      {sub ? <div className="small">{sub}</div> : null}
    </div>
  );
}

function BriefList({ title, items, icon }) {
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
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {icon}
        <span>{title}</span>
      </div>

      {items.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.08)",
                lineHeight: 1.6,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="small">Chưa có dữ liệu.</div>
      )}
    </div>
  );
}

function normalizeInsightItem(item) {
  if (typeof item === "string") return item;
  if (item?.title) return `${item.title}${item?.reason ? `: ${item.reason}` : ""}`;
  if (item?.action) return item.action;
  if (item?.name) return item.name;
  if (item?.label) return item.label;
  return item ? JSON.stringify(item) : "";
}

export default function Dashboard({
  isAdmin = false,
  isDirector = false,
  profile = null,
}) {
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("30d");
  const [isExporting, setIsExporting] = useState(false);

  const today = useMemo(() => endOfDay(new Date()), []);
  const initialFrom = useMemo(() => fmtDateInput(addDays(today, -29)), [today]);
  const initialTo = useMemo(() => fmtDateInput(today), [today]);

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  useEffect(() => {
    if (preset === "7d") {
      setFromDate(fmtDateInput(addDays(today, -6)));
      setToDate(fmtDateInput(today));
    } else if (preset === "30d") {
      setFromDate(fmtDateInput(addDays(today, -29)));
      setToDate(fmtDateInput(today));
    } else if (preset === "90d") {
      setFromDate(fmtDateInput(addDays(today, -89)));
      setToDate(fmtDateInput(today));
    }
  }, [preset, today]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || "";

    const reportsQuery = query(
      collection(db, "weekly_reports"),
      orderBy("createdAt", "desc"),
      limit(500)
    );

    const employeesQuery = query(collection(db, "employees"), limit(500));

    let reportsCache = [];
    let employeesCache = [];

    function applyFilter() {
      try {
        const managedEmployeeIds = new Set(
          employeesCache
            .filter((emp) => emp.active !== false)
            .filter((emp) => {
              if (!isDirector) return false;

              const managerUid = String(emp.managerUid || "").trim();
              if (managerUid && currentUid && managerUid === currentUid) {
                return true;
              }

              return matchesManagerFallback(emp, profile, currentUser);
            })
            .map((emp) => emp.id)
        );

        const visibleReports = reportsCache
          .filter((item) => {
            if (isAdmin) return true;

            if (isDirector) {
              const ownerUid = String(item.ownerUid || "").trim();
              const employeeUid =
                String(item.employeeUid || item?.input?.employee?.uid || "").trim();

              if (ownerUid && currentUid && ownerUid === currentUid) return true;
              if (employeeUid && managedEmployeeIds.has(employeeUid)) return true;

              return false;
            }

            return false;
          })
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setReports(visibleReports);
        setEmployees(employeesCache);
        setError("");
      } catch (e) {
        console.error(e);
        setError("Không thể tải tổng quan.");
      }
    }

    const unsubReports = onSnapshot(
      reportsQuery,
      (snap) => {
        reportsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyFilter();
      },
      () => setError("Không thể tải dữ liệu báo cáo.")
    );

    const unsubEmployees = onSnapshot(
      employeesQuery,
      (snap) => {
        employeesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        applyFilter();
      },
      () => setError("Không thể tải danh mục nhân viên.")
    );

    return () => {
      unsubReports();
      unsubEmployees();
    };
  }, [isAdmin, isDirector, profile?.name]);

  const analytics = useMemo(() => {
    const from = fromDate ? startOfDay(new Date(fromDate)) : addDays(today, -29);
    const to = toDate ? endOfDay(new Date(toDate)) : today;

    const safeFrom = from.getTime() <= to.getTime() ? from : startOfDay(to);
    const safeTo = to;

    const days = diffDaysInclusive(safeFrom, safeTo);
    const prevTo = endOfDay(addDays(safeFrom, -1));
    const prevFrom = startOfDay(addDays(prevTo, -(days - 1)));

    const currentReports = reports.filter((r) => {
      const d = parseReportDate(r);
      if (!d) return false;
      const ts = d.getTime();
      return ts >= safeFrom.getTime() && ts <= safeTo.getTime();
    });

    const previousReports = reports.filter((r) => {
      const d = parseReportDate(r);
      if (!d) return false;
      const ts = d.getTime();
      return ts >= prevFrom.getTime() && ts <= prevTo.getTime();
    });

    const buildTopMap = (list, getLabel) => {
      const map = new Map();
      for (const r of list) {
        const label = getLabel(r);
        map.set(label, (map.get(label) || 0) + Number(r.tripRevenue || 0));
      }
      return [...map.entries()]
        .map(([label, value]) => ({
          label,
          shortLabel: safeShortName(label, 14),
          value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    };

    const currentTripRevenue = sumBy(currentReports, (r) => r.tripRevenue);
    const prevTripRevenue = sumBy(previousReports, (r) => r.tripRevenue);

    const currentExpectedRevenue = sumBy(currentReports, (r) => r.totalExpectedRevenue);
    const prevExpectedRevenue = sumBy(previousReports, (r) => r.totalExpectedRevenue);

    const currentVisits = sumBy(currentReports, (r) => r.visitCustomerCount);
    const prevVisits = sumBy(previousReports, (r) => r.visitCustomerCount);

    const activityRates = currentReports.map((r) => {
      const visits = Number(r.visitCustomerCount || 0);
      const assigned = Number(r.assignedCustomerCount || 0);
      if (assigned <= 0) return 0;
      return (visits / assigned) * 100;
    });

    const productivityRates = currentReports.map((r) => {
      const trip = Number(r.tripRevenue || 0);
      const expected = Number(r.totalExpectedRevenue || 0);
      if (expected <= 0) return 0;
      return (trip / expected) * 100;
    });

    const marketControlRates = currentReports.map((r) => {
      const assigned = Number(r.assignedCustomerCount || 0);
      const total = Number(r.totalMarketCustomerCount || 0);
      if (total <= 0) return 0;
      return (assigned / total) * 100;
    });

    const coverageScore = clamp(average(activityRates), 0, 100);
    const salesQualityScore = clamp(average(productivityRates), 0, 100);
    const marketExecutionScore = clamp(average(marketControlRates), 0, 100);
    const healthScore = Math.round(
      clamp(
        coverageScore * 0.35 + salesQualityScore * 0.4 + marketExecutionScore * 0.25,
        0,
        100
      )
    );

    const risks = [];
    const opportunities = [];
    const actions = [];

    for (const r of currentReports) {
      const riskItems = Array.isArray(r.analysis_json?.risks)
        ? r.analysis_json.risks
        : r.analysis_json?.risks
        ? [r.analysis_json.risks]
        : [];

      const opportunityItems = Array.isArray(r.analysis_json?.opportunities)
        ? r.analysis_json.opportunities
        : r.analysis_json?.opportunities
        ? [r.analysis_json.opportunities]
        : [];

      const actionSource =
        r.analysis_json?.nextWeekActions || r.analysis_json?.action_plan || [];

      const actionItems = Array.isArray(actionSource)
        ? actionSource
        : actionSource
        ? [actionSource]
        : [];

      risks.push(...riskItems);
      opportunities.push(...opportunityItems);
      actions.push(...actionItems);
    }

    const weekMap = new Map();
    for (const r of currentReports) {
      const weekCode = r.weekCode || r?.input?.weekCode || "";
      const weekLabel = formatWeekLabel(weekCode);
      const reportDate = parseReportDate(r);
      const fallbackLabel = reportDate ? formatVNDate(reportDate) : "N/A";
      const key = weekLabel || fallbackLabel;
      const sortKey = reportDate ? reportDate.getTime() : 0;

      if (!weekMap.has(key)) {
        weekMap.set(key, { label: key, value: 0, sortKey });
      }

      const existing = weekMap.get(key);
      existing.value += Number(r.tripRevenue || 0);
      existing.sortKey = Math.max(existing.sortKey || 0, sortKey);
    }

    const trendData = [...weekMap.values()]
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ label, value }) => ({ label, value }));

    const reportStatus = classifyMetric(currentReports.length, 6, 3);
    const coverageStatus = classifyMetric(coverageScore, 75, 55);
    const salesStatus = classifyMetric(salesQualityScore, 75, 55);
    const marketStatus = classifyMetric(marketExecutionScore, 65, 45);

    const topEmployee = buildTopMap(
      currentReports,
      (r) => r.employeeName || r?.input?.employee?.name || "Chưa rõ nhân viên"
    )[0];

    const topProvince = buildTopMap(
      currentReports,
      (r) => r.province || r?.input?.province || "Chưa rõ địa bàn"
    )[0];

    const executiveWins = [];
    const executiveWarnings = [];
    const executiveActions = [];

    if (healthScore >= 80) {
      executiveWins.push(`Sức khỏe điều hành đang ở mức tốt với chỉ số AI ${healthScore}/100.`);
    } else if (healthScore >= 60) {
      executiveWarnings.push(`Chỉ số sức khỏe điều hành AI đang ở mức theo dõi: ${healthScore}/100.`);
    } else {
      executiveWarnings.push(`Chỉ số sức khỏe điều hành AI đang ở mức cảnh báo: ${healthScore}/100.`);
    }

    if (currentTripRevenue >= prevTripRevenue) {
      executiveWins.push(
        `Doanh số chuyến đi đang ${
          currentTripRevenue > prevTripRevenue ? "tăng" : "giữ ổn định"
        } so với kỳ trước (${formatPct(calcChange(currentTripRevenue, prevTripRevenue))}).`
      );
    } else {
      executiveWarnings.push(
        `Doanh số chuyến đi giảm so với kỳ trước (${formatPct(
          calcChange(currentTripRevenue, prevTripRevenue)
        )}).`
      );
    }

    if (topEmployee) {
      executiveWins.push(
        `Nhân viên nổi bật nhất hiện tại là ${topEmployee.label} với doanh số ${formatVND(
          topEmployee.value
        )}.`
      );
    }

    if (topProvince) {
      executiveWins.push(
        `Địa bàn dẫn đầu hiện tại là ${topProvince.label} với doanh số ${formatVND(
          topProvince.value
        )}.`
      );
    }

    if (coverageScore < 70) {
      executiveActions.push(
        "Cần nâng mật độ viếng thăm trên tệp khách hàng đang phụ trách để tăng hiệu quả hoạt động."
      );
    }

    if (salesQualityScore < 70) {
      executiveActions.push(
        "Rà soát chênh lệch giữa doanh số chuyến đi và doanh số dự kiến để tối ưu chốt đơn."
      );
    }

    if (marketExecutionScore < 60) {
      executiveActions.push(
        "Đánh giá lại mức độ bao phủ khách hàng phụ trách so với tổng quy mô khách hàng toàn địa bàn."
      );
    }

    const normalizedActions = actions
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return (
            item.action ||
            item.title ||
            item.name ||
            item.label ||
            item.suggested_action ||
            item.description ||
            JSON.stringify(item)
          );
        }
        return "";
      })
      .filter(Boolean);

    const suggestedActions = [...executiveActions, ...normalizedActions].slice(0, 5);

    return {
      from: safeFrom,
      to: safeTo,
      prevFrom,
      prevTo,
      days,
      currentReports,
      previousReports,
      totalReports: currentReports.length,
      tripRevenue: currentTripRevenue,
      expectedRevenue: currentExpectedRevenue,
      visits: currentVisits,
      reportChange: calcChange(currentReports.length, previousReports.length),
      tripRevenueChange: calcChange(currentTripRevenue, prevTripRevenue),
      expectedRevenueChange: calcChange(currentExpectedRevenue, prevExpectedRevenue),
      visitsChange: calcChange(currentVisits, prevVisits),
      employeeCount: employees.filter((x) => x.active !== false).length,
      coverageScore: Math.round(coverageScore),
      salesQualityScore: Math.round(salesQualityScore),
      marketExecutionScore: Math.round(marketExecutionScore),
      healthScore,
      reportStatus,
      coverageStatus,
      salesStatus,
      marketStatus,
      topEmployees: buildTopMap(
        currentReports,
        (r) => r.employeeName || r?.input?.employee?.name || "Chưa rõ nhân viên"
      ),
      topProvinces: buildTopMap(
        currentReports,
        (r) => r.province || r?.input?.province || "Chưa rõ địa bàn"
      ),
      risks: risks.slice(0, 6),
      opportunities: opportunities.slice(0, 6),
      trendData,
      executiveWins: executiveWins.slice(0, 4),
      executiveWarnings: executiveWarnings.slice(0, 4),
      suggestedActions,
      lastUpdatedAt:
        currentReports.length > 0
          ? currentReports
              .map((r) => toMillis(r.createdAt))
              .sort((a, b) => b - a)[0]
          : 0,
    };
  }, [reports, employees, fromDate, toDate, today]);

  const healthTone = scoreTone(analytics.healthScore);

  async function handleExportPDF() {
    if (isExporting) return;

    if (!analytics.totalReports) {
      window.alert("Không có dữ liệu trong kỳ hiện tại để xuất báo cáo PDF.");
      return;
    }

    const ceoBrief = [
      `Báo cáo điều hành trong kỳ ${formatVNDate(analytics.from)} đến ${formatVNDate(
        analytics.to
      )} ghi nhận ${analytics.totalReports} báo cáo tuần từ ${
        analytics.employeeCount
      } nhân sự hoạt động.`,
      `Tổng lượt viếng thăm khách hàng đạt ${analytics.visits}, doanh số chuyến đi đạt ${formatVND(
        analytics.tripRevenue
      )}, doanh số dự kiến đạt ${formatVND(analytics.expectedRevenue)}.`,
      `Chỉ số sức khỏe điều hành AI hiện ở mức ${analytics.healthScore}/100, phản ánh trạng thái điều hành ${scoreColor(
        analytics.healthScore
      ).toLowerCase()}.`,
      analytics.executiveWins[0] || analytics.executiveWarnings[0] || "",
    ]
      .filter(Boolean)
      .join(" ");

    const aiInsights = [
      `Kỳ báo cáo: ${formatVNDate(analytics.from)} → ${formatVNDate(analytics.to)}.`,
      `Kỳ so sánh trước đó: ${formatVNDate(analytics.prevFrom)} → ${formatVNDate(
        analytics.prevTo
      )}.`,
      `Biến động số báo cáo: ${formatPct(analytics.reportChange)}.`,
      `Biến động doanh số chuyến đi: ${formatPct(analytics.tripRevenueChange)}.`,
      `Biến động doanh số dự kiến: ${formatPct(analytics.expectedRevenueChange)}.`,
      `Biến động lượt viếng thăm: ${formatPct(analytics.visitsChange)}.`,
      analytics.topEmployees[0]
        ? `Nhân viên dẫn đầu: ${analytics.topEmployees[0].label} với doanh số ${formatVND(
            analytics.topEmployees[0].value
          )}.`
        : "",
      analytics.topProvinces[0]
        ? `Địa bàn dẫn đầu: ${analytics.topProvinces[0].label} với doanh số ${formatVND(
            analytics.topProvinces[0].value
          )}.`
        : "",
    ].filter(Boolean);

    try {
      setIsExporting(true);

      await exportDashboardPDF({
        reportDate: analytics.to || new Date(),
        logoUrl: LOGO_URL,

        metrics: {
          totalReports: analytics.totalReports,
          totalVisits: analytics.visits,
          totalTripRevenue: analytics.tripRevenue,
          totalExpectedRevenue: analytics.expectedRevenue,
          activeEmployees: analytics.employeeCount,
          healthScore: analytics.healthScore,
          coverageScore: analytics.coverageScore,
          salesQualityScore: analytics.salesQualityScore,
          marketExecutionScore: analytics.marketExecutionScore,
        },

        ai: {
          ceoBrief,
          executiveWins: analytics.executiveWins,
          executiveWarnings: analytics.executiveWarnings,
          suggestedActions: analytics.suggestedActions,
          insights: aiInsights,
          risks: analytics.risks.map(normalizeInsightItem).filter(Boolean),
          opportunities: analytics.opportunities.map(normalizeInsightItem).filter(Boolean),
        },

        ranking: {
          topEmployees: analytics.topEmployees.map((item) => ({
            name: item.label,
            tripRevenue: item.value,
            revenue: item.value,
            value: item.value,
            visitCustomerCount: 0,
            visits: 0,
          })),
          topProvinces: analytics.topProvinces.map((item) => ({
            name: item.label,
            province: item.label,
            value: item.value,
            revenue: item.value,
            note: "Top doanh số trong kỳ",
          })),
        },

        weeklyReports: analytics.currentReports,
      });
    } catch (err) {
      console.error(err);
      window.alert("Xuất báo cáo PDF thất bại. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!isAdmin && !isDirector) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Không có quyền xem tổng quan</h2>
          <p className="small">Chức năng này dành cho Admin hoặc Giám đốc kinh doanh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-header" style={{ textAlign: "center" }}>
          <h2 style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
            TỔNG QUAN ĐIỀU HÀNH BÁO CÁO TUẦN
          </h2>
          <p>
            {isAdmin
              ? "Tổng hợp toàn bộ dữ liệu báo cáo và phân tích AI trong hệ thống"
              : "Tổng hợp dữ liệu báo cáo và phân tích AI của đội phụ trách"}
          </p>
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
                {error}
              </div>
            </div>
          ) : null}

          <SectionCard
            title="Bộ lọc thời gian"
            subtitle="Lọc tổng quan theo giai đoạn và tự động so sánh với kỳ trước"
            icon={<CalendarRange size={18} />}
          >
            <div className="row" style={{ marginBottom: 12 }}>
              <FilterButton active={preset === "7d"} onClick={() => setPreset("7d")}>
                7 ngày
              </FilterButton>
              <FilterButton active={preset === "30d"} onClick={() => setPreset("30d")}>
                30 ngày
              </FilterButton>
              <FilterButton active={preset === "90d"} onClick={() => setPreset("90d")}>
                90 ngày
              </FilterButton>
              <FilterButton active={preset === "custom"} onClick={() => setPreset("custom")}>
                Tùy chọn
              </FilterButton>
            </div>

            <div className="grid two">
              <div>
                <label>Từ ngày</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setPreset("custom");
                    setFromDate(e.target.value);
                  }}
                />
                <div className="small" style={{ marginTop: 6 }}>
                  Hiển thị: <span className="kbd">{formatVNDate(fromDate)}</span>
                </div>
              </div>
              <div>
                <label>Đến ngày</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setPreset("custom");
                    setToDate(e.target.value);
                  }}
                />
                <div className="small" style={{ marginTop: 6 }}>
                  Hiển thị: <span className="kbd">{formatVNDate(toDate)}</span>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <span className="pill">
                <span className="small">Kỳ hiện tại</span>{" "}
                <span className="kbd">
                  {formatVNDate(analytics.from)} → {formatVNDate(analytics.to)}
                </span>
              </span>
              <span className="pill">
                <span className="small">Kỳ trước</span>{" "}
                <span className="kbd">
                  {formatVNDate(analytics.prevFrom)} → {formatVNDate(analytics.prevTo)}
                </span>
              </span>
              <span className="pill">
                <span className="small">Độ dài kỳ</span>{" "}
                <span className="kbd">{analytics.days} ngày</span>
              </span>
              {analytics.lastUpdatedAt ? (
                <span className="pill">
                  <span className="small">Cập nhật cuối</span>{" "}
                  <span className="kbd">{formatVNDateTime(analytics.lastUpdatedAt)}</span>
                </span>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -4 }}>
        <button
          className="btn"
          type="button"
          onClick={handleExportPDF}
          disabled={isExporting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: isExporting ? 0.75 : 1,
            cursor: isExporting ? "wait" : "pointer",
          }}
        >
          <Download size={16} />
          {isExporting ? "Đang chuẩn bị PDF..." : "Xuất báo cáo PDF"}
        </button>
      </div>

      <div id="ceo-brief">
        <SectionCard
          title="Tóm Tắt Điều Hành"
          subtitle={`Tóm tắt nhanh trong kỳ ${formatVNDate(analytics.from)} → ${formatVNDate(
            analytics.to
          )}`}
          icon={<BriefcaseBusiness size={18} />}
        >
          <div className="grid two" style={{ marginBottom: 14 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 20,
                background: healthTone.bg,
                border: `1px solid ${healthTone.border}`,
                color: healthTone.text,
              }}
            >
              <div className="small" style={{ color: healthTone.text }}>
                Chỉ số sức khỏe điều hành AI
              </div>
              <div style={{ fontWeight: 900, fontSize: 34, marginTop: 8 }}>
                {analytics.healthScore}/100
              </div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                Trạng thái điều hành: {scoreColor(analytics.healthScore)}
              </div>
            </div>

            <div className="grid two" style={{ gap: 12 }}>
              <ExecutiveItem
                title="Cường độ báo cáo"
                value={analytics.totalReports}
                level={analytics.reportStatus}
                sub={`Biến động ${formatPct(analytics.reportChange)} so với kỳ trước`}
              />
              <ExecutiveItem
                title="Mức độ hoạt động"
                value={`${analytics.coverageScore}/100`}
                level={analytics.coverageStatus}
                sub="Đánh giá từ số lượt viếng thăm trên tệp khách hàng phụ trách"
              />
              <ExecutiveItem
                title="Chất lượng doanh số"
                value={`${analytics.salesQualityScore}/100`}
                level={analytics.salesStatus}
                sub="So sánh doanh số chuyến đi với doanh số dự kiến"
              />
              <ExecutiveItem
                title="Kiểm soát thị trường"
                value={`${analytics.marketExecutionScore}/100`}
                level={analytics.marketStatus}
                sub="Tỷ lệ khách hàng phụ trách trên tổng khách hàng toàn địa bàn"
              />
            </div>
          </div>

          <div className="grid two">
            <BriefList
              title="Điểm tốt nổi bật"
              items={analytics.executiveWins}
              icon={<CircleCheckBig size={16} />}
            />
            <BriefList
              title="Cảnh báo điều hành"
              items={analytics.executiveWarnings}
              icon={<ShieldAlert size={16} />}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <BriefList
              title="Top 5 hành động đề xuất tuần tới"
              items={analytics.suggestedActions}
              icon={<Clock3 size={16} />}
            />
          </div>
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          icon={<FileText size={18} />}
          title="Tổng số báo cáo"
          value={analytics.totalReports}
          sub="Theo bộ lọc hiện tại"
          change={analytics.reportChange}
        />
        <KpiCard
          icon={<Users size={18} />}
          title="Tổng khách viếng thăm"
          value={analytics.visits}
          sub="Từ các báo cáo trong kỳ"
          change={analytics.visitsChange}
        />
        <KpiCard
          icon={<HandCoins size={18} />}
          title="Doanh số chuyến đi"
          value={formatVND(analytics.tripRevenue)}
          sub="Cộng từ doanh số thực hiện"
          change={analytics.tripRevenueChange}
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          title="Doanh số dự kiến"
          value={formatVND(analytics.expectedRevenue)}
          sub="Cộng từ cơ cấu mặt hàng"
          change={analytics.expectedRevenueChange}
        />
        <KpiCard
          icon={<Users size={18} />}
          title="Nhân viên hoạt động"
          value={analytics.employeeCount}
          sub="Danh mục nhân viên đang hoạt động"
        />
      </div>

      <div className="grid two">
        <SectionCard
          title="Chỉ Số Sức Khỏe Điều Hành AI"
          subtitle="Điểm tổng hợp từ mức độ hoạt động, chất lượng doanh số và kiểm soát thị trường"
          icon={<Activity size={18} />}
        >
          <div className="grid two">
            <KpiCard
              icon={<Target size={18} />}
              title="Điểm sức khỏe"
              value={`${analytics.healthScore}/100`}
              sub={scoreColor(analytics.healthScore)}
            />
            <div
              style={{
                padding: 16,
                background: "rgba(255,255,255,.06)",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,.10)",
                display: "grid",
                gap: 10,
              }}
            >
              <div className="small">Chi tiết điểm</div>
              <div className="row">
                <span className="pill">
                  <span className="small">Mức độ hoạt động</span>{" "}
                  <span className="kbd">{analytics.coverageScore}/100</span>
                </span>
                <span className="pill">
                  <span className="small">Chất lượng doanh số</span>{" "}
                  <span className="kbd">{analytics.salesQualityScore}/100</span>
                </span>
                <span className="pill">
                  <span className="small">Kiểm soát thị trường</span>{" "}
                  <span className="kbd">{analytics.marketExecutionScore}/100</span>
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        <TrendCard data={analytics.trendData} />
      </div>

      <div className="grid two">
        <ChartCard
          title="Biểu đồ doanh số theo nhân viên"
          subtitle="Top 5 nhân viên có doanh số chuyến đi cao nhất trong kỳ"
          data={analytics.topEmployees}
          valueFormatter={(v) => formatVND(v)}
        />

        <ChartCard
          title="Biểu đồ doanh số theo địa bàn"
          subtitle="Top 5 địa bàn có doanh số chuyến đi cao nhất trong kỳ"
          data={analytics.topProvinces}
          valueFormatter={(v) => formatVND(v)}
        />
      </div>

      <div className="grid two">
        <SectionCard
          title="Top nhân viên theo doanh số"
          subtitle="Xếp hạng trong kỳ hiện tại"
          icon={<Users size={18} />}
        >
          <RankList
            items={analytics.topEmployees}
            emptyText="Chưa có dữ liệu nhân viên."
            valueFormatter={formatVND}
          />
        </SectionCard>

        <SectionCard
          title="Top địa bàn theo doanh số"
          subtitle="Xếp hạng trong kỳ hiện tại"
          icon={<MapPinned size={18} />}
        >
          <RankList
            items={analytics.topProvinces}
            emptyText="Chưa có dữ liệu địa bàn."
            valueFormatter={formatVND}
          />
        </SectionCard>
      </div>

      <div className="grid two">
        <SectionCard
          title="Cảnh báo rủi ro từ AI"
          subtitle="Các rủi ro nổi bật trong kỳ hiện tại"
          icon={<TriangleAlert size={18} />}
        >
          <InsightList items={analytics.risks} emptyText="Chưa có cảnh báo rủi ro nào." />
        </SectionCard>

        <SectionCard
          title="Cơ hội nổi bật từ AI"
          subtitle="Các cơ hội nổi bật trong kỳ hiện tại"
          icon={<Lightbulb size={18} />}
        >
          <InsightList
            items={analytics.opportunities}
            emptyText="Chưa có cơ hội nổi bật nào."
          />
        </SectionCard>
      </div>
    </div>
  );
}
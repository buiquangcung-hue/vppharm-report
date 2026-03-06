import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

function formatVND(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
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

function StatCard({ title, value, sub }) {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,.06)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div className="small">{title}</div>
      <div style={{ fontWeight: 900, fontSize: 22, marginTop: 8 }}>{value}</div>
      {sub ? (
        <div className="small" style={{ marginTop: 6 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="card" style={{ boxShadow: "none" }}>
      <div className="card-header">
        <h2 style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</h2>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function RankList({ items, emptyText, valueFormatter = (x) => x }) {
  if (!items.length) {
    return <div className="small">{emptyText}</div>;
  }

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
  if (!items.length) {
    return <div className="small">{emptyText}</div>;
  }

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
          {typeof item === "string" ? item : JSON.stringify(item)}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({
  isAdmin = false,
  isDirector = false,
  profile = null,
}) {
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || "";

    const reportsQuery = query(
      collection(db, "weekly_reports"),
      orderBy("createdAt", "desc"),
      limit(300)
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
      } catch (e) {
        console.error(e);
        setError("Không thể tải dashboard.");
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

  const summary = useMemo(() => {
    const totalReports = reports.length;
    const totalTripRevenue = reports.reduce(
      (sum, r) => sum + Number(r.tripRevenue || 0),
      0
    );
    const totalExpectedRevenue = reports.reduce(
      (sum, r) => sum + Number(r.totalExpectedRevenue || 0),
      0
    );
    const totalVisits = reports.reduce(
      (sum, r) => sum + Number(r.visitCustomerCount || 0),
      0
    );

    const employeeMap = new Map();
    const provinceMap = new Map();
    const risks = [];
    const opportunities = [];

    for (const r of reports) {
      const employeeName =
        r.employeeName || r?.input?.employee?.name || "Chưa rõ nhân viên";
      const province = r.province || r?.input?.province || "Chưa rõ địa bàn";

      employeeMap.set(employeeName, (employeeMap.get(employeeName) || 0) + Number(r.tripRevenue || 0));
      provinceMap.set(province, (provinceMap.get(province) || 0) + Number(r.tripRevenue || 0));

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

      risks.push(...riskItems);
      opportunities.push(...opportunityItems);
    }

    const topEmployees = [...employeeMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topProvinces = [...provinceMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalReports,
      totalTripRevenue,
      totalExpectedRevenue,
      totalVisits,
      topEmployees,
      topProvinces,
      risks: risks.slice(0, 6),
      opportunities: opportunities.slice(0, 6),
    };
  }, [reports]);

  if (!isAdmin && !isDirector) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Không có quyền xem Dashboard</h2>
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
            DASHBOARD ĐIỀU HÀNH BÁO CÁO TUẦN
          </h2>
          <p>
            {isAdmin
              ? "Tổng hợp toàn bộ dữ liệu báo cáo và phân tích AI trong hệ thống"
              : "Tổng hợp dữ liệu báo cáo và phân tích AI của team phụ trách"}
          </p>
        </div>
        <div className="card-body">
          {error ? <div className="small">{error}</div> : null}

          <div className="grid two">
            <StatCard
              title="Tổng số báo cáo"
              value={summary.totalReports}
              sub="Số báo cáo đang hiển thị theo quyền"
            />
            <StatCard
              title="Tổng khách viếng thăm"
              value={summary.totalVisits}
              sub="Tổng lượt khách hàng từ các báo cáo"
            />
          </div>

          <div className="grid two" style={{ marginTop: 16 }}>
            <StatCard
              title="Tổng doanh số chuyến đi"
              value={formatVND(summary.totalTripRevenue)}
              sub="Cộng từ tripRevenue"
            />
            <StatCard
              title="Tổng doanh số dự kiến"
              value={formatVND(summary.totalExpectedRevenue)}
              sub="Cộng từ totalExpectedRevenue"
            />
          </div>
        </div>
      </div>

      <div className="grid two">
        <SectionCard title="Top nhân viên theo doanh số">
          <RankList
            items={summary.topEmployees}
            emptyText="Chưa có dữ liệu nhân viên."
            valueFormatter={formatVND}
          />
        </SectionCard>

        <SectionCard title="Top địa bàn theo doanh số">
          <RankList
            items={summary.topProvinces}
            emptyText="Chưa có dữ liệu địa bàn."
            valueFormatter={formatVND}
          />
        </SectionCard>
      </div>

      <div className="grid two">
        <SectionCard title="Cảnh báo rủi ro từ AI">
          <InsightList
            items={summary.risks}
            emptyText="Chưa có cảnh báo rủi ro nào."
          />
        </SectionCard>

        <SectionCard title="Cơ hội nổi bật từ AI">
          <InsightList
            items={summary.opportunities}
            emptyText="Chưa có cơ hội nổi bật nào."
          />
        </SectionCard>
      </div>
    </div>
  );
}
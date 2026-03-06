const BRAND = {
  primary: "#0F4C81",
  secondary: "#1F7AE0",
  accent: "#E8F1FB",
  success: "#0F9D58",
  warning: "#F59E0B",
  danger: "#DC2626",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  bg: "#F8FAFC",
  white: "#FFFFFF",
};

const DEFAULT_LOGO =
  "https://firebasestorage.googleapis.com/v0/b/cnlb-4d714.firebasestorage.app/o/lOGO%20DOC.png?alt=media&token=ad7d71e2-aa27-4ed5-81d8-9f8ee9ace0ac";

function formatNumber(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("vi-VN").format(n);
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat("vi-VN").format(n)} đ`;
}

function formatPercent(value) {
  const n = Number(value || 0);
  return `${Math.round(n)}%`;
}

function formatDate(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "Chưa có dữ liệu") {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function getHealthScore(metrics = {}) {
  const coverage = Number(metrics.coverageScore ?? metrics.coverage ?? 0);
  const salesQuality = Number(
    metrics.salesQualityScore ?? metrics.salesQuality ?? 0
  );
  const marketExecution = Number(
    metrics.marketExecutionScore ?? metrics.marketExecution ?? 0
  );

  const values = [coverage, salesQuality, marketExecution].filter(
    (v) => !Number.isNaN(v) && v >= 0
  );

  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getScoreLabel(score) {
  if (score >= 85) return { label: "Rất tốt", color: BRAND.success };
  if (score >= 70) return { label: "Tốt", color: BRAND.secondary };
  if (score >= 50) return { label: "Cần chú ý", color: BRAND.warning };
  return { label: "Rủi ro", color: BRAND.danger };
}

function buildExecutiveSummary({
  totalReports = 0,
  totalVisits = 0,
  totalTripRevenue = 0,
  totalExpectedRevenue = 0,
  activeEmployees = 0,
  score = 0,
}) {
  const state =
    score >= 85
      ? "tích cực"
      : score >= 70
      ? "ổn định"
      : score >= 50
      ? "cần theo dõi sát"
      : "có dấu hiệu rủi ro";

  return `Trong kỳ báo cáo này, hệ thống ghi nhận ${formatNumber(
    totalReports
  )} báo cáo tuần từ ${formatNumber(
    activeEmployees
  )} nhân sự hoạt động, với ${formatNumber(
    totalVisits
  )} lượt viếng thăm khách hàng. Doanh số chuyến đi đạt ${formatCurrency(
    totalTripRevenue
  )}, doanh số dự kiến đạt ${formatCurrency(
    totalExpectedRevenue
  )}. AI Health Score hiện ở mức ${score}/100, phản ánh bức tranh điều hành ${state}.`;
}

function cardKPI(label, value, sub = "") {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
      <div class="kpi-sub">${escapeHtml(sub)}</div>
    </div>
  `;
}

function listBlock(title, items = [], type = "default") {
  const cls =
    type === "danger"
      ? "list danger"
      : type === "success"
      ? "list success"
      : "list";

  const content = items.length
    ? items
        .map(
          (item) => `
            <li>
              <span class="bullet"></span>
              <span>${escapeHtml(item)}</span>
            </li>
          `
        )
        .join("")
    : `<li><span class="bullet"></span><span>Chưa có dữ liệu</span></li>`;

  return `
    <div class="${cls}">
      <div class="list-title">${escapeHtml(title)}</div>
      <ul>${content}</ul>
    </div>
  `;
}

function rankingTable(title, rows = [], mode = "employee") {
  const headers =
    mode === "province"
      ? `<tr><th>#</th><th>Địa bàn</th><th>Doanh số</th><th>Ghi chú</th></tr>`
      : `<tr><th>#</th><th>Nhân viên</th><th>Doanh số</th><th>Viếng thăm</th></tr>`;

  const body = rows.length
    ? rows
        .slice(0, 8)
        .map((row, index) => {
          if (mode === "province") {
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.name ?? row.province ?? "Chưa rõ")}</td>
                <td>${escapeHtml(
                  formatCurrency(row.value ?? row.tripRevenue ?? row.revenue ?? 0)
                )}</td>
                <td>${escapeHtml(row.note ?? "—")}</td>
              </tr>
            `;
          }

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.name ?? row.employee ?? "Chưa rõ")}</td>
              <td>${escapeHtml(
                formatCurrency(row.tripRevenue ?? row.revenue ?? row.value ?? 0)
              )}</td>
              <td>${escapeHtml(
                formatNumber(row.visitCustomerCount ?? row.visits ?? 0)
              )}</td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="4" class="table-empty">Chưa có dữ liệu xếp hạng</td>
      </tr>
    `;

  return `
    <div class="table-card">
      <div class="section-title">${escapeHtml(title)}</div>
      <table class="ranking-table">
        <thead>${headers}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function extractDashboardData(raw = {}) {
  const metrics = raw.metrics || raw.kpi || {};
  const charts = raw.charts || {};
  const ai = raw.ai || raw.analysis || {};
  const ranking = raw.ranking || {};
  const weeklyReports = normalizeArray(raw.weeklyReports || raw.reports);

  const totalReports =
    raw.totalReports ?? metrics.totalReports ?? weeklyReports.length ?? 0;

  const totalVisits =
    raw.totalVisits ??
    metrics.totalVisits ??
    weeklyReports.reduce(
      (sum, item) => sum + Number(item.visitCustomerCount || 0),
      0
    );

  const totalTripRevenue =
    raw.totalTripRevenue ??
    metrics.totalTripRevenue ??
    weeklyReports.reduce((sum, item) => sum + Number(item.tripRevenue || 0), 0);

  const totalExpectedRevenue =
    raw.totalExpectedRevenue ??
    metrics.totalExpectedRevenue ??
    weeklyReports.reduce(
      (sum, item) => sum + Number(item.expectedRevenue || 0),
      0
    );

  const activeEmployees =
    raw.activeEmployees ??
    metrics.activeEmployees ??
    new Set(weeklyReports.map((x) => x.employee).filter(Boolean)).size;

  const healthScore =
    raw.healthScore ?? metrics.healthScore ?? getHealthScore(metrics);

  return {
    companyName: raw.companyName || "VP-PHARM",
    reportDate: formatDate(raw.reportDate || new Date()),
    logoUrl: raw.logoUrl || DEFAULT_LOGO,

    totalReports,
    totalVisits,
    totalTripRevenue,
    totalExpectedRevenue,
    activeEmployees,

    healthScore,
    coverageScore: Number(metrics.coverageScore ?? metrics.coverage ?? 0),
    salesQualityScore: Number(
      metrics.salesQualityScore ?? metrics.salesQuality ?? 0
    ),
    marketExecutionScore: Number(
      metrics.marketExecutionScore ?? metrics.marketExecution ?? 0
    ),

    ceoBrief:
      ai.ceoBrief ||
      raw.ceoBrief ||
      buildExecutiveSummary({
        totalReports,
        totalVisits,
        totalTripRevenue,
        totalExpectedRevenue,
        activeEmployees,
        score: healthScore,
      }),

    executiveWins: normalizeArray(
      ai.executiveWins || raw.executiveWins || raw.wins
    ),
    executiveWarnings: normalizeArray(
      ai.executiveWarnings || raw.executiveWarnings || raw.warnings
    ),
    suggestedActions: normalizeArray(
      ai.suggestedActions || raw.suggestedActions || raw.actions
    ),
    insights: normalizeArray(ai.insights || raw.insights),
    risks: normalizeArray(ai.risks || raw.risks),
    opportunities: normalizeArray(ai.opportunities || raw.opportunities),

    topEmployees: normalizeArray(
      ranking.topEmployees || charts.topEmployees || raw.topEmployees
    ),
    topProvinces: normalizeArray(
      ranking.topProvinces || charts.topProvinces || raw.topProvinces
    ),
  };
}

function buildStyles() {
  return `
    <style>
      @page {
        size: A4;
        margin: 14mm 12mm 14mm 12mm;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: #eef3f8;
        color: ${BRAND.text};
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        padding: 24px;
      }

      .report-root {
        max-width: 1120px;
        margin: 0 auto;
      }

      .pdf-page {
        background: ${BRAND.white};
        border-radius: 18px;
        padding: 28px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        margin-bottom: 20px;
        page-break-after: always;
        break-after: page;
      }

      .pdf-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 22px;
        padding-bottom: 16px;
        border-bottom: 1px solid ${BRAND.border};
      }

      .brand-left {
        display: flex;
        align-items: center;
        gap: 14px;
        max-width: 70%;
      }

      .brand-logo {
        width: 56px;
        height: 56px;
        object-fit: contain;
        border-radius: 14px;
        background: #fff;
        flex: 0 0 auto;
      }

      .brand-name {
        font-size: 24px;
        font-weight: 800;
        color: ${BRAND.primary};
        letter-spacing: 0.4px;
      }

      .brand-sub {
        font-size: 13px;
        color: ${BRAND.muted};
        margin-top: 4px;
      }

      .header-right {
        min-width: 220px;
        background: ${BRAND.bg};
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        padding: 12px 14px;
      }

      .header-page-title {
        font-size: 14px;
        font-weight: 800;
        color: ${BRAND.primary};
        margin-bottom: 6px;
      }

      .header-date {
        font-size: 12px;
        color: ${BRAND.muted};
        line-height: 1.6;
      }

      .hero {
        background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.secondary} 100%);
        color: white;
        border-radius: 22px;
        padding: 28px;
        margin-bottom: 20px;
      }

      .hero-label {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.95;
        margin-bottom: 10px;
      }

      .hero-title {
        font-size: 32px;
        font-weight: 800;
        line-height: 1.2;
        margin-bottom: 10px;
      }

      .hero-desc {
        font-size: 14px;
        line-height: 1.75;
        opacity: 0.98;
      }

      .score-box {
        margin-top: 18px;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 16px;
        padding: 12px 16px;
      }

      .score-number {
        font-size: 28px;
        font-weight: 800;
      }

      .score-meta {
        font-size: 12px;
        line-height: 1.5;
      }

      .summary-card {
        background: ${BRAND.bg};
        border: 1px solid ${BRAND.border};
        border-radius: 18px;
        padding: 18px;
        margin-bottom: 18px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .section-title {
        font-size: 16px;
        font-weight: 800;
        color: ${BRAND.primary};
        margin-bottom: 12px;
      }

      .section-text {
        font-size: 14px;
        line-height: 1.75;
        color: ${BRAND.text};
      }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .grid-4 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .kpi-card {
        background: ${BRAND.white};
        border: 1px solid ${BRAND.border};
        border-radius: 18px;
        padding: 16px;
        min-height: 110px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .kpi-label {
        font-size: 12px;
        font-weight: 700;
        color: ${BRAND.muted};
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .kpi-value {
        font-size: 28px;
        font-weight: 800;
        line-height: 1.15;
        color: ${BRAND.text};
        margin-bottom: 8px;
        word-break: break-word;
      }

      .kpi-sub {
        font-size: 12px;
        color: ${BRAND.muted};
        line-height: 1.5;
      }

      .metric-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin-top: 8px;
      }

      .metric-mini {
        background: ${BRAND.white};
        border: 1px solid ${BRAND.border};
        border-radius: 16px;
        padding: 16px;
      }

      .metric-mini .name {
        font-size: 12px;
        color: ${BRAND.muted};
        font-weight: 700;
        margin-bottom: 8px;
      }

      .metric-mini .val {
        font-size: 26px;
        font-weight: 800;
      }

      .list {
        background: ${BRAND.white};
        border: 1px solid ${BRAND.border};
        border-radius: 18px;
        padding: 16px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .list.success {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      .list.danger {
        background: #fef2f2;
        border-color: #fecaca;
      }

      .list-title {
        font-size: 14px;
        font-weight: 800;
        margin-bottom: 12px;
        color: ${BRAND.text};
      }

      .list ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .list li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13px;
        line-height: 1.65;
        margin-bottom: 10px;
      }

      .list li:last-child {
        margin-bottom: 0;
      }

      .bullet {
        width: 8px;
        height: 8px;
        min-width: 8px;
        border-radius: 999px;
        background: ${BRAND.secondary};
        margin-top: 7px;
      }

      .table-card {
        background: ${BRAND.white};
        border: 1px solid ${BRAND.border};
        border-radius: 18px;
        padding: 16px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .ranking-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
        table-layout: fixed;
      }

      .ranking-table th {
        text-align: left;
        padding: 12px 10px;
        background: ${BRAND.bg};
        color: ${BRAND.primary};
        font-size: 12px;
        border-bottom: 1px solid ${BRAND.border};
      }

      .ranking-table td {
        padding: 11px 10px;
        border-bottom: 1px solid ${BRAND.border};
        color: ${BRAND.text};
        vertical-align: top;
        word-wrap: break-word;
      }

      .ranking-table tr:last-child td {
        border-bottom: none;
      }

      .table-empty {
        text-align: center;
        color: ${BRAND.muted};
      }

      .action-card {
        border: 1px solid ${BRAND.border};
        border-radius: 18px;
        padding: 16px;
        background: ${BRAND.white};
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .action-card .action-title {
        font-size: 14px;
        font-weight: 800;
        color: ${BRAND.primary};
        margin-bottom: 10px;
      }

      .action-card .action-body {
        font-size: 13px;
        line-height: 1.7;
        color: ${BRAND.text};
      }

      .page-footer {
        margin-top: 18px;
        display: flex;
        justify-content: space-between;
        color: ${BRAND.muted};
        font-size: 11px;
        border-top: 1px solid ${BRAND.border};
        padding-top: 10px;
      }

      @media print {
        html, body {
          background: #ffffff;
        }

        body {
          padding: 0;
        }

        .report-root {
          max-width: none;
        }

        .pdf-page {
          box-shadow: none;
          border-radius: 0;
          margin: 0;
          padding: 0;
        }
      }
    </style>
  `;
}

function createPageShell(content, { pageTitle, pageNumber, reportDate, logoUrl }) {
  return `
    <section class="pdf-page">
      <div class="page-header">
        <div class="brand-left">
          <img src="${logoUrl}" alt="VP-PHARM Logo" class="brand-logo" />
          <div>
            <div class="brand-name">VP-PHARM</div>
            <div class="brand-sub">AI Weekly Sales Intelligence</div>
          </div>
        </div>
        <div class="header-right">
          <div class="header-page-title">${escapeHtml(pageTitle)}</div>
          <div class="header-date">Ngày xuất: ${escapeHtml(reportDate)}</div>
        </div>
      </div>

      ${content}

      <div class="page-footer">
        <span>VP-PHARM Executive Report</span>
        <span>Trang ${pageNumber}/5</span>
      </div>
    </section>
  `;
}

function buildPages(data) {
  const scoreTag = getScoreLabel(data.healthScore);

  const page1 = createPageShell(
    `
      <div class="hero">
        <div class="hero-label">CEO Brief</div>
        <div class="hero-title">Báo cáo điều hành tuần</div>
        <div class="hero-desc">${escapeHtml(data.ceoBrief)}</div>
        <div class="score-box">
          <div class="score-number">${data.healthScore}/100</div>
          <div class="score-meta">
            <div><strong>AI Health Score</strong></div>
            <div>${escapeHtml(scoreTag.label)}</div>
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="section-title">Executive Summary</div>
        <div class="section-text">
          ${escapeHtml(
            buildExecutiveSummary({
              totalReports: data.totalReports,
              totalVisits: data.totalVisits,
              totalTripRevenue: data.totalTripRevenue,
              totalExpectedRevenue: data.totalExpectedRevenue,
              activeEmployees: data.activeEmployees,
              score: data.healthScore,
            })
          )}
        </div>
      </div>

      <div class="grid-2">
        ${listBlock("Executive Wins", data.executiveWins, "success")}
        ${listBlock("Executive Warnings", data.executiveWarnings, "danger")}
      </div>
    `,
    {
      pageTitle: "Trang 1 · CEO Brief",
      pageNumber: 1,
      reportDate: data.reportDate,
      logoUrl: data.logoUrl,
    }
  );

  const page2 = createPageShell(
    `
      <div class="section-title">KPI Overview</div>

      <div class="grid-4" style="margin-bottom:16px;">
        ${cardKPI("Tổng báo cáo", formatNumber(data.totalReports), "Số báo cáo tuần đã ghi nhận")}
        ${cardKPI("Tổng khách viếng thăm", formatNumber(data.totalVisits), "Lượt tiếp cận khách hàng")}
        ${cardKPI("Doanh số chuyến đi", formatCurrency(data.totalTripRevenue), "Doanh số đã thực hiện")}
        ${cardKPI("Doanh số dự kiến", formatCurrency(data.totalExpectedRevenue), "Pipeline kỳ tới")}
        ${cardKPI("Nhân viên hoạt động", formatNumber(data.activeEmployees), "Có báo cáo trong kỳ")}
        ${cardKPI("AI Health Score", `${data.healthScore}/100`, scoreTag.label)}
      </div>

      <div class="summary-card">
        <div class="section-title">Health Score Composition</div>
        <div class="metric-strip">
          <div class="metric-mini">
            <div class="name">Coverage</div>
            <div class="val">${formatPercent(data.coverageScore)}</div>
          </div>
          <div class="metric-mini">
            <div class="name">Sales Quality</div>
            <div class="val">${formatPercent(data.salesQualityScore)}</div>
          </div>
          <div class="metric-mini">
            <div class="name">Market Execution</div>
            <div class="val">${formatPercent(data.marketExecutionScore)}</div>
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="section-title">Executive Interpretation</div>
        <div class="section-text">
          AI Health Score hiện đạt <strong>${data.healthScore}/100</strong>, trong đó Coverage = ${formatPercent(
      data.coverageScore
    )}, Sales Quality = ${formatPercent(
      data.salesQualityScore
    )}, Market Execution = ${formatPercent(
      data.marketExecutionScore
    )}. Đây là chỉ báo tổng hợp để Ban điều hành theo dõi độ phủ, chất lượng bán hàng và khả năng triển khai thị trường.
        </div>
      </div>
    `,
    {
      pageTitle: "Trang 2 · KPI Overview",
      pageNumber: 2,
      reportDate: data.reportDate,
      logoUrl: data.logoUrl,
    }
  );

  const page3 = createPageShell(
    `
      <div class="section-title">AI Insight</div>

      <div class="grid-2" style="margin-bottom:16px;">
        ${listBlock("Key Insights", data.insights)}
        ${listBlock("Opportunities", data.opportunities, "success")}
      </div>

      <div class="grid-2">
        ${listBlock("Risks", data.risks, "danger")}
        ${listBlock("Suggested Actions", data.suggestedActions)}
      </div>
    `,
    {
      pageTitle: "Trang 3 · AI Insight",
      pageNumber: 3,
      reportDate: data.reportDate,
      logoUrl: data.logoUrl,
    }
  );

  const page4 = createPageShell(
    `
      <div class="section-title">Top Ranking</div>

      <div class="grid-2">
        ${rankingTable("Top nhân viên", data.topEmployees, "employee")}
        ${rankingTable("Top địa bàn", data.topProvinces, "province")}
      </div>
    `,
    {
      pageTitle: "Trang 4 · Top Ranking",
      pageNumber: 4,
      reportDate: data.reportDate,
      logoUrl: data.logoUrl,
    }
  );

  const page5 = createPageShell(
    `
      <div class="section-title">Action Plan</div>

      <div class="grid-2" style="margin-bottom:16px;">
        <div class="action-card">
          <div class="action-title">Ưu tiên 1 · Củng cố độ phủ</div>
          <div class="action-body">
            Tập trung rà soát nhân sự có số lượt viếng thăm thấp, tăng mật độ thăm khách hàng tại các địa bàn còn bỏ trống, và theo dõi sát số lượng khách hàng chưa khai thác.
          </div>
        </div>

        <div class="action-card">
          <div class="action-title">Ưu tiên 2 · Nâng chất lượng doanh số</div>
          <div class="action-body">
            Đối chiếu doanh số chuyến đi và doanh số dự kiến để xác định điểm nghẽn chuyển đổi, đồng thời coaching nhóm có doanh số cao nhưng chất lượng pipeline chưa ổn định.
          </div>
        </div>

        <div class="action-card">
          <div class="action-title">Ưu tiên 3 · Tối ưu thực thi thị trường</div>
          <div class="action-body">
            Kiểm tra lại tính đều của hoạt động theo tỉnh/thành, tránh tập trung quá mạnh vào một vài địa bàn trong khi các khu vực khác chưa được chăm sóc đúng mức.
          </div>
        </div>

        <div class="action-card">
          <div class="action-title">Ưu tiên 4 · Theo dõi điều hành hàng tuần</div>
          <div class="action-body">
            Duy trì cơ chế CEO Brief mỗi tuần, so sánh xu hướng Health Score theo chu kỳ, và xác nhận các hành động sau họp đã được triển khai thực tế hay chưa.
          </div>
        </div>
      </div>

      <div class="summary-card">
        <div class="section-title">Khuyến nghị điều hành</div>
        <div class="section-text">
          ${escapeHtml(
            data.suggestedActions.length
              ? data.suggestedActions.join(" ")
              : "Ban điều hành nên sử dụng đồng thời KPI, AI Insight và Top Ranking để ưu tiên hành động trong tuần kế tiếp."
          )}
        </div>
      </div>
    `,
    {
      pageTitle: "Trang 5 · Action Plan",
      pageNumber: 5,
      reportDate: data.reportDate,
      logoUrl: data.logoUrl,
    }
  );

  return [page1, page2, page3, page4, page5];
}

function buildDocumentHtml(data) {
  const pages = buildPages(data);

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>VP-PHARM Executive Report</title>
        ${buildStyles()}
      </head>
      <body>
        <div class="report-root">
          ${pages.join("")}
        </div>
      </body>
    </html>
  `;
}

async function waitForWindowReady(printWindow) {
  await new Promise((resolve) => {
    const onReady = () => resolve();

    if (printWindow.document.readyState === "complete") {
      resolve();
      return;
    }

    printWindow.onload = onReady;
    setTimeout(resolve, 1200);
  });

  const images = Array.from(printWindow.document.images || []);
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

export async function exportDashboardPDF(rawData = {}) {
  const data = extractDashboardData(rawData);
  const html = buildDocumentHtml(data);

  const printWindow = window.open("", "_blank", "width=1400,height=900");

  if (!printWindow) {
    window.alert("Trình duyệt đang chặn popup. Vui lòng cho phép popup để xuất PDF.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  await waitForWindowReady(printWindow);

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 300);
}

export default exportDashboardPDF;
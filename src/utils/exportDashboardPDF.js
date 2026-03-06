import jsPDF from "jspdf";

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN").format(num) + " đ";
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
};

const formatPercent = (value) => {
  return `${Math.round(Number(value || 0))}%`;
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
};

const stripMarkdown = (text = "") => {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#+\s/g, "")
    .trim();
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

export async function exportDashboardPDF({
  periodLabel = "",
  dateRange = {},
  summary = {},
  healthScore = {},
  executiveBrief = {},
  aiExecutiveBrief = {},
  topEmployees = [],
  topAreas = [],
  risks = [],
  opportunities = [],
  generatedBy = "VP-PHARM AI Weekly Sales Intelligence",
}) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPageIfNeeded = (neededHeight = 10) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const addTitle = (text, size = 20) => {
    addPageIfNeeded(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += 9;
  };

  const addSubTitle = (text) => {
    addPageIfNeeded(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, margin, y);
    y += 7;
  };

  const addParagraph = (text = "", fontSize = 11, spacing = 6) => {
    const clean = stripMarkdown(text || "");
    if (!clean) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(clean, contentWidth);
    const blockHeight = lines.length * 5.2;
    addPageIfNeeded(blockHeight + 2);
    doc.text(lines, margin, y);
    y += blockHeight + spacing;
  };

  const addBulletList = (items = [], fontSize = 11) => {
    const list = safeArray(items).filter(Boolean);
    if (!list.length) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    list.forEach((item) => {
      const clean = stripMarkdown(item);
      const lines = doc.splitTextToSize(`• ${clean}`, contentWidth - 2);
      const blockHeight = lines.length * 5.2;
      addPageIfNeeded(blockHeight + 1);
      doc.text(lines, margin + 1, y);
      y += blockHeight + 2;
    });

    y += 2;
  };

  const addDivider = () => {
    addPageIfNeeded(4);
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addKpiGrid = (items = []) => {
    const list = safeArray(items);
    if (!list.length) return;

    const colGap = 6;
    const colWidth = (contentWidth - colGap) / 2;
    const boxHeight = 20;

    for (let i = 0; i < list.length; i += 2) {
      addPageIfNeeded(boxHeight + 4);

      const left = list[i];
      const right = list[i + 1];

      const drawBox = (x, item) => {
        if (!item) return;
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(x, y, colWidth, boxHeight, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(String(item.label || ""), x + 4, y + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text(String(item.value || ""), x + 4, y + 14);
      };

      drawBox(margin, left);
      drawBox(margin + colWidth + colGap, right);

      y += boxHeight + 5;
    }
  };

  const addSimpleTable = (title, rows = [], columns = []) => {
    if (!rows.length) return;

    addSubTitle(title);
    addPageIfNeeded(10);

    const colWidths = columns.map((c) => c.width);
    const headers = columns.map((c) => c.label);
    let x = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    headers.forEach((header, idx) => {
      doc.text(header, x + 1, y);
      x += colWidths[idx];
    });

    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    rows.forEach((row) => {
      let rowHeight = 5;
      const wrappedCells = columns.map((col) => {
        const value = String(row[col.key] ?? "");
        const lines = doc.splitTextToSize(value, col.width - 2);
        rowHeight = Math.max(rowHeight, lines.length * 4.8);
        return lines;
      });

      addPageIfNeeded(rowHeight + 3);

      let xCell = margin;
      wrappedCells.forEach((lines, idx) => {
        doc.text(lines, xCell + 1, y);
        xCell += colWidths[idx];
      });

      y += rowHeight + 2;
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
    });

    y += 2;
  };

  // ===== PAGE 1: COVER =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("VP-PHARM", margin, y);
  y += 10;

  doc.setFontSize(16);
  doc.text("AI WEEKLY SALES INTELLIGENCE", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Kỳ báo cáo: ${periodLabel || "Tùy chọn"}`, margin, y);
  y += 7;
  doc.text(
    `Từ ngày: ${formatDate(dateRange.start)}   |   Đến ngày: ${formatDate(dateRange.end)}`,
    margin,
    y
  );
  y += 7;
  doc.text(`Ngày xuất báo cáo: ${new Date().toLocaleString("vi-VN")}`, margin, y);
  y += 7;
  doc.text(`Nguồn tạo: ${generatedBy}`, margin, y);
  y += 12;

  addDivider();

  addSubTitle("Tóm tắt điều hành");
  addParagraph(
    aiExecutiveBrief?.summary ||
      executiveBrief?.summary ||
      "Báo cáo điều hành tổng hợp hiệu quả bán hàng, mức độ phủ, chất lượng doanh số và các trọng tâm hành động cho kỳ hiện tại."
  );

  addSubTitle("Điểm điều hành nổi bật");
  addBulletList(
    aiExecutiveBrief?.highlights?.length
      ? aiExecutiveBrief.highlights
      : executiveBrief?.highlights || []
  );

  addSubTitle("Cảnh báo điều hành");
  addBulletList(
    aiExecutiveBrief?.warnings?.length
      ? aiExecutiveBrief.warnings
      : executiveBrief?.warnings || []
  );

  // ===== PAGE 2: KPI =====
  doc.addPage();
  y = 20;

  addTitle("1. TỔNG QUAN KPI ĐIỀU HÀNH", 16);

  addKpiGrid([
    { label: "Tổng số báo cáo", value: formatNumber(summary.totalReports) },
    { label: "Tổng khách viếng thăm", value: formatNumber(summary.totalVisits) },
    { label: "Doanh số chuyến đi", value: formatCurrency(summary.tripRevenue) },
    { label: "Doanh số dự kiến", value: formatCurrency(summary.expectedRevenue) },
    { label: "Số nhân viên active", value: formatNumber(summary.activeEmployees) },
    { label: "Health Score", value: formatPercent(healthScore.total) },
    { label: "Coverage Score", value: formatPercent(healthScore.coverage) },
    { label: "Sales Quality Score", value: formatPercent(healthScore.salesQuality) },
    { label: "Market Execution Score", value: formatPercent(healthScore.marketExecution) },
    { label: "Phân loại", value: healthScore.label || "" },
  ]);

  addDivider();

  addSubTitle("Nhận định KPI");
  addParagraph(
    aiExecutiveBrief?.salesFocus ||
      "Trọng tâm điều hành cần theo dõi bao gồm tăng trưởng doanh số, chất lượng độ phủ, khả năng duy trì tần suất viếng thăm và hiệu quả triển khai thị trường theo khu vực."
  );

  // ===== PAGE 3: AI CEO BRIEF =====
  doc.addPage();
  y = 20;

  addTitle("2. AI CEO BRIEF", 16);

  addSubTitle("Tóm tắt điều hành tuần");
  addParagraph(aiExecutiveBrief?.summary || "");

  addSubTitle("Trọng tâm doanh số");
  addParagraph(aiExecutiveBrief?.salesFocus || "");

  addSubTitle("Rủi ro điều hành");
  addParagraph(aiExecutiveBrief?.risksNarrative || "");
  addBulletList(aiExecutiveBrief?.riskBullets || risks);

  addSubTitle("Cơ hội tăng trưởng");
  addParagraph(aiExecutiveBrief?.opportunitiesNarrative || "");
  addBulletList(aiExecutiveBrief?.opportunityBullets || opportunities);

  addSubTitle("Hành động tuần tới");
  addBulletList(
    aiExecutiveBrief?.nextActions?.length
      ? aiExecutiveBrief.nextActions
      : executiveBrief?.actions || []
  );

  // ===== PAGE 4: TOP RANKING =====
  doc.addPage();
  y = 20;

  addTitle("3. TOP RANKING", 16);

  addSimpleTable(
    "Top nhân viên",
    safeArray(topEmployees).slice(0, 10).map((item, index) => ({
      rank: index + 1,
      name: item.name || item.employeeName || "-",
      revenue: formatCurrency(item.revenue || item.sales || item.totalSales || 0),
      visits: formatNumber(item.visits || item.totalVisits || 0),
    })),
    [
      { key: "rank", label: "Hạng", width: 18 },
      { key: "name", label: "Nhân viên", width: 72 },
      { key: "revenue", label: "Doanh số", width: 50 },
      { key: "visits", label: "Viếng thăm", width: 34 },
    ]
  );

  addSimpleTable(
    "Top địa bàn",
    safeArray(topAreas).slice(0, 10).map((item, index) => ({
      rank: index + 1,
      area: item.name || item.area || item.province || "-",
      revenue: formatCurrency(item.revenue || item.sales || item.totalSales || 0),
      reports: formatNumber(item.reports || item.totalReports || 0),
    })),
    [
      { key: "rank", label: "Hạng", width: 18 },
      { key: "area", label: "Địa bàn", width: 72 },
      { key: "revenue", label: "Doanh số", width: 50 },
      { key: "reports", label: "Báo cáo", width: 34 },
    ]
  );

  // ===== PAGE 5: FINAL ACTIONS =====
  doc.addPage();
  y = 20;

  addTitle("4. KHUYẾN NGHỊ ĐIỀU HÀNH", 16);

  addSubTitle("Điểm tốt nổi bật");
  addBulletList(
    aiExecutiveBrief?.highlights?.length
      ? aiExecutiveBrief.highlights
      : executiveBrief?.highlights || []
  );

  addSubTitle("Cảnh báo cần xử lý");
  addBulletList(
    aiExecutiveBrief?.warnings?.length
      ? aiExecutiveBrief.warnings
      : executiveBrief?.warnings || []
  );

  addSubTitle("Top 3 hành động đề xuất tuần tới");
  addBulletList(
    aiExecutiveBrief?.nextActions?.slice(0, 3)?.length
      ? aiExecutiveBrief.nextActions.slice(0, 3)
      : executiveBrief?.actions?.slice(0, 3) || []
  );

  addDivider();
  addParagraph(
    "Tài liệu này được tạo tự động từ hệ thống VP-PHARM AI Weekly Sales Intelligence nhằm hỗ trợ điều hành bán hàng, phát hiện rủi ro và định hướng hành động tuần tiếp theo."
  );

  const fileName = `VP-PHARM_CEO_Brief_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
import OpenAI from "openai";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

function tryParseJsonFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {}
  }

  return null;
}

function safeArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value: any) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(num);
}

function formatVND(value: any) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

function buildContextSummary(report: any) {
  const employee = report?.employee || {};
  const director = report?.director || {};
  const products = safeArray(report?.productLines);

  const productsSummary = products.length
    ? products
        .slice(0, 20)
        .map((p, idx) => {
          const lineNo = idx + 1;
          return [
            `#${lineNo}: ${p.productName || "unknown-product"}`,
            `ĐVT: ${p.unit || "unknown"}`,
            `Giá: ${formatVND(p.price || 0)}`,
            `SL: ${formatNumber(p.quantity || 0)}`,
            `DS dự kiến: ${formatVND(p.expectedRevenue || 0)}`,
          ].join(" | ");
        })
        .join("\n")
    : "Không có mặt hàng nào.";

  const unexplored = Number(report?.unexploredCustomerCount || 0);
  const assigned = Number(report?.assignedCustomerCount || 0);
  const totalMarket = Number(report?.totalMarketCustomerCount || 0);
  const visitCount = Number(report?.visitCustomerCount || 0);
  const tripRevenue = Number(report?.tripRevenue || 0);
  const totalExpectedRevenue = Number(report?.totalExpectedRevenue || 0);

  const unexploredRate =
    assigned > 0 ? `${((unexplored / assigned) * 100).toFixed(1)}%` : "unknown";

  const visitCoverageRate =
    assigned > 0 ? `${((visitCount / assigned) * 100).toFixed(1)}%` : "unknown";

  const marketCoverageRate =
    totalMarket > 0 ? `${((assigned / totalMarket) * 100).toFixed(1)}%` : "unknown";

  return `
THÔNG TIN CHUNG
- Tên báo cáo: ${report?.reportDisplayName || report?.reportName || "unknown"}
- Tuần làm việc: ${report?.weekFrom || "unknown"} đến ${report?.weekTo || "unknown"}
- Giám đốc lập báo cáo: ${director?.name || "unknown"} (${director?.email || "unknown"})
- Nhân viên đi cùng: ${employee?.name || "unknown"}${employee?.code ? ` | Mã: ${employee.code}` : ""}
- Địa bàn: ${report?.province || "unknown"}

CHỈ SỐ CHUYẾN ĐI
- Số khách hàng đến viếng thăm: ${formatNumber(visitCount)}
- Doanh số cả chuyến đi: ${formatVND(tripRevenue)}
- Tổng số khách hàng TDV phụ trách: ${formatNumber(assigned)}
- Số khách hàng chưa khai thác: ${formatNumber(unexplored)}
- Tổng số khách hàng toàn địa bàn: ${formatNumber(totalMarket)}
- Tỷ lệ khách hàng chưa khai thác / khách hàng phụ trách: ${unexploredRate}
- Tỷ lệ viếng thăm / khách hàng phụ trách: ${visitCoverageRate}
- Tỷ lệ khách hàng phụ trách / toàn địa bàn: ${marketCoverageRate}

ĐÁNH GIÁ CỦA GIÁM ĐỐC
- Điểm mạnh: ${report?.employeeStrengths || "unknown"}
- Điểm yếu: ${report?.employeeWeaknesses || "unknown"}

DANH MỤC MẶT HÀNG
${productsSummary}

TỔNG HỢP DOANH SỐ
- Tổng doanh số dự kiến từ các mặt hàng: ${formatVND(totalExpectedRevenue)}
- Chênh lệch giữa doanh số chuyến đi và doanh số dự kiến từ mặt hàng: ${formatVND(
    tripRevenue - totalExpectedRevenue
  )}

FILE EXCEL ĐÍNH KÈM
- Tên file: ${report?.excelFile?.fileName || "unknown"}
- Lưu ý: Hệ thống mới có metadata file, chưa parse nội dung chi tiết của Excel.
`.trim();
}

function normalizeList(value: any) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return [value];
  if (typeof value === "object") return [value];
  return [];
}

function mapAnalysisShape(input: any) {
  const src = input && typeof input === "object" ? input : {};

  const tripSummary =
    src.tripSummary ||
    src.executive_summary ||
    src.manager_briefing ||
    src.trip_assessment ||
    "";

  const employeeAssessment =
    src.employeeAssessment ||
    src.employeePerformance ||
    src.employee_assessment ||
    "";

  const coverageAssessment =
    src.coverageAssessment ||
    src.marketCoverage ||
    src.market_coverage_assessment ||
    "";

  const salesAssessment =
    src.salesAssessment ||
    src.salesPotential ||
    src.product_mix_assessment ||
    "";

  const strengthHighlights =
    normalizeList(src.strengthHighlights).length > 0
      ? normalizeList(src.strengthHighlights)
      : normalizeList(src.key_strengths);

  const weaknessHighlights =
    normalizeList(src.weaknessHighlights).length > 0
      ? normalizeList(src.weaknessHighlights)
      : normalizeList(src.key_weaknesses);

  const risks = normalizeList(src.risks);
  const opportunities = normalizeList(src.opportunities);

  const managerRecommendations =
    normalizeList(src.managerRecommendations).length > 0
      ? normalizeList(src.managerRecommendations)
      : normalizeList(src.managerRecommendation).length > 0
      ? normalizeList(src.managerRecommendation)
      : normalizeList(src.coaching_recommendation);

  const nextWeekActions =
    normalizeList(src.nextWeekActions).length > 0
      ? normalizeList(src.nextWeekActions)
      : normalizeList(src.action_plan).length > 0
      ? normalizeList(src.action_plan)
      : normalizeList(src.next_week_action_plan);

  const questionsToClarify =
    normalizeList(src.questions_to_clarify).length > 0
      ? normalizeList(src.questions_to_clarify)
      : normalizeList(src.questionsToClarify);

  const scores =
    src.scores && typeof src.scores === "object" ? src.scores : undefined;

  return {
    tripSummary,
    employeeAssessment,
    coverageAssessment,
    salesAssessment,
    strengthHighlights,
    weaknessHighlights,
    risks,
    opportunities,
    managerRecommendations,
    nextWeekActions,
    questionsToClarify,
    scores,
  };
}

function buildAnalysisText(json: any) {
  if (!json || typeof json !== "object") return "";

  const lines: string[] = [];

  const pushSection = (title: string, items: any) => {
    if (!items) return;

    lines.push(title);

    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string") {
          lines.push(`- ${it}`);
        } else if (it && typeof it === "object") {
          const t = it.title || it.name || it.label || it.action || "Mục";
          const r =
            it.reason ||
            it.description ||
            it.suggestion ||
            it.owner ||
            it.kpi ||
            it.priority ||
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

  pushSection("TÓM TẮT CHUYẾN ĐI", json.tripSummary);
  pushSection("ĐÁNH GIÁ NHÂN VIÊN", json.employeeAssessment);
  pushSection("ĐÁNH GIÁ ĐỘ PHỦ THỊ TRƯỜNG", json.coverageAssessment);
  pushSection("ĐÁNH GIÁ DOANH SỐ", json.salesAssessment);
  pushSection("ĐIỂM MẠNH NỔI BẬT", json.strengthHighlights);
  pushSection("ĐIỂM YẾU CẦN CẢI THIỆN", json.weaknessHighlights);
  pushSection("RỦI RO", json.risks);
  pushSection("CƠ HỘI", json.opportunities);
  pushSection("KHUYẾN NGHỊ QUẢN LÝ", json.managerRecommendations);
  pushSection("KẾ HOẠCH TUẦN TỚI", json.nextWeekActions);
  pushSection("CÂU HỎI CẦN LÀM RÕ", json.questionsToClarify);

  if (json?.scores && typeof json.scores === "object") {
    lines.push("ĐIỂM THAM CHIẾU");
    lines.push(`- Execution: ${json.scores.execution ?? "unknown"}/100`);
    lines.push(`- Coaching readiness: ${json.scores.coaching_readiness ?? "unknown"}/100`);
    lines.push(`- Market coverage: ${json.scores.market_coverage ?? "unknown"}/100`);
    lines.push(`- Sales opportunity: ${json.scores.sales_opportunity ?? "unknown"}/100`);
    lines.push(`- Next week readiness: ${json.scores.next_week_readiness ?? "unknown"}/100`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export default async function handler(req: any, res: any) {
  const startedAt = Date.now();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { report } = req.body || {};
    if (!report) {
      return res.status(400).json({ error: "Missing report" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on Vercel" });
    }

    console.log("analyzeWeeklyReport:start", {
      reportName: report?.reportName || "",
      employeeName: report?.employee?.name || "",
      province: report?.province || "",
      productLines: Array.isArray(report?.productLines) ? report.productLines.length : 0,
    });

    const client = new OpenAI({
      apiKey,
      timeout: 40000,
    });

    const contextSummary = buildContextSummary(report);

    const schemaHint = {
      tripSummary: ["Nhận định ngắn về chất lượng chuyến đi"],
      employeeAssessment: ["Nhận định về năng lực và hành vi làm việc của nhân viên"],
      coverageAssessment: ["Nhận định về độ phủ, khoảng trống thị trường, mức khai thác địa bàn"],
      salesAssessment: ["Nhận định về doanh số, cơ cấu sản phẩm, chất lượng cơ hội bán hàng"],
      strengthHighlights: ["Điểm mạnh 1", "Điểm mạnh 2"],
      weaknessHighlights: ["Điểm yếu 1", "Điểm yếu 2"],
      risks: [
        {
          title: "Rủi ro",
          reason: "Vì sao đây là rủi ro",
          suggestion: "Khuyến nghị xử lý",
        },
      ],
      opportunities: [
        {
          title: "Cơ hội",
          reason: "Vì sao đây là cơ hội",
          suggestion: "Cách tận dụng",
        },
      ],
      managerRecommendations: ["Khuyến nghị coaching/quản lý 1", "Khuyến nghị 2"],
      nextWeekActions: [
        {
          action: "Việc cần làm",
          owner: "Director|Employee|Sales Team",
          priority: "P0|P1|P2",
          kpi: "Chỉ số theo dõi",
          deadline: "YYYY-MM-DD hoặc unknown",
        },
      ],
      questionsToClarify: ["Câu hỏi 1", "Câu hỏi 2"],
      scores: {
        execution: 0,
        coaching_readiness: 0,
        market_coverage: 0,
        sales_opportunity: 0,
        next_week_readiness: 0,
      },
    };

    const prompt = `
Bạn là cố vấn điều hành bán hàng ngành dược cho VP-PHARM.

Nhiệm vụ:
- Phân tích báo cáo đi thị trường tuần từ góc nhìn giám đốc kinh doanh.
- Nhận định ngắn gọn, thực chiến, không lan man.
- Không bịa dữ liệu.
- Nếu thiếu dữ liệu thì ghi "unknown" hoặc đưa vào questionsToClarify.
- Chỉ trả về JSON hợp lệ.
- Không thêm markdown, không thêm giải thích ngoài JSON.

Yêu cầu trọng tâm:
1. Đánh giá chất lượng chuyến đi.
2. Đánh giá nhân viên.
3. Đánh giá độ phủ địa bàn.
4. Đánh giá doanh số và cơ cấu sản phẩm.
5. Chỉ ra điểm mạnh, điểm yếu, rủi ro, cơ hội.
6. Đề xuất khuyến nghị quản lý.
7. Lập kế hoạch tuần tới có action, owner, priority, KPI, deadline nếu suy ra hợp lý.

Schema JSON bắt buộc:
${JSON.stringify(schemaHint)}

Dữ liệu chuẩn hóa:
${contextSummary}
`.trim();

    console.log("analyzeWeeklyReport:openai_request");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là cố vấn điều hành bán hàng cấp cao cho VP-PHARM. Chỉ trả về JSON hợp lệ, thực chiến, ngắn gọn, không bịa dữ liệu.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    console.log("analyzeWeeklyReport:openai_done_ms", Date.now() - startedAt);

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = tryParseJsonFromText(raw);

    if (!parsed) {
      return res.status(200).json({
        analysis_json: null,
        analysis_text: raw,
        raw,
      });
    }

    const analysis_json = mapAnalysisShape(parsed);
    const analysis_text = buildAnalysisText(analysis_json);

    console.log("analyzeWeeklyReport:done_ms", Date.now() - startedAt);

    return res.status(200).json({
      analysis_json,
      analysis_text,
      raw,
      ok: true,
      durationMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    console.error("analyzeWeeklyReport error:", err);

    const message =
      err?.status === 408 || err?.code === "ETIMEDOUT"
        ? "OpenAI timeout"
        : err?.message || "Internal error";

    return res.status(500).json({
      error: message,
      detail: err?.name || "unknown_error",
      ok: false,
      durationMs: Date.now() - startedAt,
    });
  }
}
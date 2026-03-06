import OpenAI from "openai";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

function tryParseJsonFromText(text) {
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(num);
}

function formatVND(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

function buildContextSummary(report) {
  const employee = report?.employee || {};
  const director = report?.director || {};
  const products = safeArray(report?.productLines);

  const productsSummary = products.length
    ? products
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

DANH MỤC MẶT HÀNG VÀ DOANH SỐ DỰ KIẾN
${productsSummary}

TỔNG HỢP DOANH SỐ
- Tổng doanh số dự kiến từ các mặt hàng: ${formatVND(totalExpectedRevenue)}
- Chênh lệch giữa doanh số chuyến đi và doanh số dự kiến từ mặt hàng:
  ${formatVND(tripRevenue - totalExpectedRevenue)}

FILE EXCEL ĐÍNH KÈM
- Tên file: ${report?.excelFile?.fileName || "unknown"}
- Lưu ý: Hiện tại hệ thống mới có metadata file, chưa parse nội dung Excel để đọc chi tiết số liệu trong file.
`.trim();
}

function buildAnalysisText(json) {
  if (!json || typeof json !== "object") return "";

  const lines = [];

  const pushTitle = (text) => {
    if (!text) return;
    lines.push(text);
  };

  const pushParagraph = (text) => {
    if (!text) return;
    lines.push(text);
    lines.push("");
  };

  const pushList = (title, arr, formatter) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    lines.push(title);
    arr.forEach((item, idx) => {
      const text = formatter ? formatter(item, idx) : String(item || "");
      if (text) lines.push(`- ${text}`);
    });
    lines.push("");
  };

  pushTitle("1. TÓM TẮT ĐIỀU HÀNH");
  pushParagraph(json.manager_briefing);

  pushTitle("2. ĐÁNH GIÁ TỔNG QUAN CHUYẾN ĐI");
  pushParagraph(json.trip_assessment);

  pushTitle("3. ĐÁNH GIÁ NHÂN VIÊN");
  pushParagraph(json.employee_assessment);

  pushTitle("4. ĐÁNH GIÁ ĐỊA BÀN VÀ ĐỘ PHỦ");
  pushParagraph(json.market_coverage_assessment);

  pushTitle("5. ĐÁNH GIÁ CƠ CẤU MẶT HÀNG / DOANH SỐ");
  pushParagraph(json.product_mix_assessment);

  pushList("6. ĐIỂM MẠNH NỔI BẬT", json.key_strengths);
  pushList("7. ĐIỂM YẾU / KHOẢNG TRỐNG CẦN XỬ LÝ", json.key_weaknesses);

  pushList("8. RỦI RO QUAN TRỌNG", json.risks, (item) => {
    if (typeof item === "string") return item;
    return `${item?.title || "Rủi ro"}${item?.severity ? ` [${item.severity}]` : ""}${item?.reason ? `: ${item.reason}` : ""}`;
  });

  pushList("9. CƠ HỘI BÁN HÀNG", json.opportunities, (item) => {
    if (typeof item === "string") return item;
    return `${item?.title || "Cơ hội"}${item?.impact ? ` [${item.impact}]` : ""}${item?.reason ? `: ${item.reason}` : ""}`;
  });

  pushTitle("10. GỢI Ý COACHING CHO GIÁM ĐỐC");
  pushParagraph(json.coaching_recommendation);

  pushList("11. KẾ HOẠCH HÀNH ĐỘNG TUẦN TỚI", json.next_week_action_plan, (item) => {
    if (typeof item === "string") return item;
    return [
      item?.action || "Hành động",
      item?.owner ? `Owner: ${item.owner}` : "",
      item?.priority ? `Ưu tiên: ${item.priority}` : "",
      item?.kpi ? `KPI: ${item.kpi}` : "",
      item?.deadline ? `Deadline: ${item.deadline}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  });

  pushList("12. CÂU HỎI CẦN LÀM RÕ THÊM", json.questions_to_clarify);

  if (json?.scores && typeof json.scores === "object") {
    lines.push("13. CHẤM ĐIỂM THAM CHIẾU");
    lines.push(
      `- Execution: ${json.scores.execution ?? "unknown"}/100`
    );
    lines.push(
      `- Coaching readiness: ${json.scores.coaching_readiness ?? "unknown"}/100`
    );
    lines.push(
      `- Market coverage: ${json.scores.market_coverage ?? "unknown"}/100`
    );
    lines.push(
      `- Sales opportunity: ${json.scores.sales_opportunity ?? "unknown"}/100`
    );
    lines.push(
      `- Next week readiness: ${json.scores.next_week_readiness ?? "unknown"}/100`
    );
    lines.push("");
  }

  return lines.join("\n").trim();
}

export default async function handler(req, res) {
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

    const client = new OpenAI({ apiKey });

    const schemaHint = {
      manager_briefing:
        "Tóm tắt điều hành 1 đoạn, sâu sắc, súc tích, nêu rõ chất lượng chuyến đi và ưu tiên quản trị.",
      trip_assessment:
        "Đánh giá tổng quan hiệu quả chuyến đi, mức độ thực chất, chất lượng làm việc trên thị trường.",
      employee_assessment:
        "Đánh giá năng lực nhân viên, mức độ chủ động, khả năng chăm sóc khách hàng, chốt đơn, phát triển địa bàn.",
      market_coverage_assessment:
        "Đánh giá độ phủ và mức độ khai thác địa bàn, chỉ ra chỗ còn trống.",
      product_mix_assessment:
        "Đánh giá hợp lý hay bất hợp lý của cơ cấu sản phẩm, sản lượng và doanh số dự kiến.",
      key_strengths: ["Điểm mạnh 1", "Điểm mạnh 2"],
      key_weaknesses: ["Điểm yếu 1", "Điểm yếu 2"],
      risks: [
        {
          title: "Rủi ro",
          severity: "high|medium|low",
          reason: "Vì sao đây là rủi ro",
          suggestion: "Khuyến nghị xử lý",
        },
      ],
      opportunities: [
        {
          title: "Cơ hội",
          impact: "high|medium|low",
          reason: "Vì sao đây là cơ hội",
          suggestion: "Cách tận dụng",
        },
      ],
      coaching_recommendation:
        "Hướng coaching cụ thể cho giám đốc khi đi cùng nhân viên trong tuần tới.",
      next_week_action_plan: [
        {
          action: "Việc cần làm",
          owner: "Director|Employee|Admin|Sales Team",
          priority: "P0|P1|P2",
          kpi: "Chỉ số đo lường",
          deadline: "YYYY-MM-DD hoặc unknown",
        },
      ],
      questions_to_clarify: ["Câu hỏi 1", "Câu hỏi 2"],
      scores: {
        execution: 0,
        coaching_readiness: 0,
        market_coverage: 0,
        sales_opportunity: 0,
        next_week_readiness: 0,
      },
    };

    const contextSummary = buildContextSummary(report);

    const prompt = `
Bạn là chuyên gia điều hành bán hàng ngành dược tại Việt Nam, đang tư vấn trực tiếp cho Giám đốc kinh doanh VP-PHARM.

MỤC TIÊU
Phân tích sâu sắc chuyến đi thị trường trong tuần, không chỉ tóm tắt dữ liệu mà phải:
1. Nhìn ra chất lượng thực của chuyến đi.
2. Đánh giá chính xác năng lực và khoảng trống của nhân viên.
3. Chỉ ra rủi ro quản trị, rủi ro thị trường, rủi ro độ phủ.
4. Nêu cơ hội bán hàng, cơ hội mở rộng khách hàng, cơ hội cải thiện sản phẩm.
5. Đề xuất kế hoạch hành động tuần tới thật cụ thể, đủ sâu và hơn mong đợi của Giám đốc kinh doanh.
6. Nếu dữ liệu có dấu hiệu bất hợp lý, phải chỉ ra.
7. Nếu thiếu dữ liệu, không được bịa. Hãy ghi "unknown" khi cần và đưa vào questions_to_clarify.

NGUYÊN TẮC PHÂN TÍCH
- Phải có tư duy điều hành bán hàng thực chiến.
- Phải nhìn theo góc độ Giám đốc kinh doanh, không phải chỉ là thư ký ghi chép.
- Phải đánh giá cả: con người, địa bàn, độ phủ, cơ cấu sản phẩm, tiềm năng doanh số, mức độ kỷ luật thị trường.
- Kế hoạch tuần tới phải có owner, priority, KPI và deadline nếu có thể suy ra hợp lý.
- Chỉ trả về JSON hợp lệ.
- Không thêm giải thích ngoài JSON.

SCHEMA JSON BẮT BUỘC:
${JSON.stringify(schemaHint, null, 2)}

DỮ LIỆU BÁO CÁO:
${typeof report === "string" ? report : JSON.stringify(report, null, 2)}

TÓM TẮT NGỮ CẢNH ĐÃ CHUẨN HÓA:
${contextSummary}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là cố vấn điều hành bán hàng cấp cao cho VP-PHARM. Chỉ trả về JSON hợp lệ, sâu sắc, thực chiến, không bịa dữ liệu.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = tryParseJsonFromText(raw);

    if (!parsed) {
      return res.status(200).json({
        analysis_json: null,
        analysis_text: raw,
        raw,
      });
    }

    const analysis_json = parsed;
    const analysis_text = buildAnalysisText(parsed);

    return res.status(200).json({
      analysis_json,
      analysis_text,
      raw,
    });
  } catch (err) {
    console.error("analyzeWeeklyReport error:", err);
    return res.status(500).json({
      error: err?.message || "Internal error",
    });
  }
}
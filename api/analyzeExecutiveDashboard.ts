import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const body = req.body || {};
    const reports = Array.isArray(body.reports) ? body.reports : [];
    const filters = body.filters || {};
    const summary = body.summary || {};

    if (!reports.length && !Object.keys(summary).length) {
      return res.status(400).json({
        error: "No dashboard data provided",
      });
    }

    const prompt = `
Bạn là AI điều hành cấp giám đốc cho hệ thống VP-PHARM.

Hãy phân tích dữ liệu dashboard sau và trả về JSON hợp lệ với đúng các key:
- executiveSummary
- systemRisks
- keyOpportunities
- performanceAlerts
- notableTrends
- employeeInsights
- provinceInsights
- productInsights
- strategicActions

Yêu cầu:
- executiveSummary: string
- các mục còn lại: mảng
- nội dung bằng tiếng Việt
- ngắn gọn, sắc bén, theo góc nhìn điều hành

Bộ lọc:
${JSON.stringify(filters, null, 2)}

Tóm tắt số liệu:
${JSON.stringify(summary, null, 2)}

Danh sách báo cáo:
${JSON.stringify(reports, null, 2)}

Chỉ trả về JSON hợp lệ, không thêm markdown.
`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Bạn là chuyên gia phân tích điều hành kinh doanh dược phẩm cho ban giám đốc.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);

    return res.status(200).json({
      executiveSummary: parsed.executiveSummary || "",
      systemRisks: parsed.systemRisks || [],
      keyOpportunities: parsed.keyOpportunities || [],
      performanceAlerts: parsed.performanceAlerts || [],
      notableTrends: parsed.notableTrends || [],
      employeeInsights: parsed.employeeInsights || [],
      provinceInsights: parsed.provinceInsights || [],
      productInsights: parsed.productInsights || [],
      strategicActions: parsed.strategicActions || [],
    });
  } catch (error: any) {
    console.error("analyzeExecutiveDashboard error:", error);

    return res.status(500).json({
      error: error?.message || "Internal server error",
    });
  }
}
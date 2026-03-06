import OpenAI from "openai";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

function tryParseJsonFromText(text: string) {
  // cố gắng parse thẳng
  try {
    return JSON.parse(text);
  } catch {}

  // cố gắng trích đoạn JSON {...}
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

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { report } = req.body || {};
    if (!report) return res.status(400).json({ error: "Missing report" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY on Vercel" });

    const client = new OpenAI({ apiKey });

    const schemaHint = {
      executive_summary: ["..."],
      diagnosis: {
        drivers: ["..."],
        root_causes: ["..."],
      },
      alerts: [
        { title: "…", reason: "…", severity: "P0|P1|P2", suggested_action: "…" },
      ],
      opportunities: [
        { title: "…", rationale: "…", expected_impact: "low|medium|high" },
      ],
      coaching_plan: [
        { staff: "…", focus: "…", what_to_do: ["…"], check_in_question: "…" },
      ],
      action_plan: [
        {
          title: "…",
          owner: "GĐKD|ASM|Sales|Ops",
          priority: "P0|P1|P2",
          kpi: { metric: "…", target: "…", dueDate: "YYYY-MM-DD" },
        },
      ],
      questions_to_clarify: ["..."],
    };

    const prompt = `
Bạn là chuyên gia điều hành bán hàng ngành dược (VP-PHARM).
Nhiệm vụ: phân tích báo cáo tuần và trả về JSON DUY NHẤT theo đúng cấu trúc mẫu.

QUY TẮC:
- KHÔNG bịa số. Nếu thiếu dữ liệu, ghi "unknown" và đưa vào questions_to_clarify.
- Ưu tiên hành động cụ thể, đo được (KPI), có owner, có ưu tiên P0/P1/P2.
- Trả về CHỈ JSON, không thêm giải thích bên ngoài.

Cấu trúc JSON mẫu:
${JSON.stringify(schemaHint, null, 2)}

Dữ liệu báo cáo tuần (JSON):
${typeof report === "string" ? report : JSON.stringify(report, null, 2)}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Chỉ trả về JSON hợp lệ theo schema." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = tryParseJsonFromText(raw);

    // fallback text nếu parse fail
    const analysis_json = parsed;
    const analysis_text = parsed
      ? null
      : raw;

    return res.status(200).json({
      analysis_json,
      analysis_text,
      raw, // để debug nếu cần; sau này có thể bỏ
    });
  } catch (err: any) {
    console.error("analyzeWeeklyReport error:", err);
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}
import OpenAI from "openai";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: any, res: any) {
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

    const prompt = `
Bạn là trợ lý phân tích điều hành bán hàng cho Giám đốc Kinh doanh VP-PHARM.
Hãy phân tích báo cáo tuần và xuất ra theo 5 mục:
1) Tóm tắt điều hành
2) Coaching đội ngũ
3) Rủi ro
4) Cơ hội
5) Checklist tuần tới

Báo cáo:
${typeof report === "string" ? report : JSON.stringify(report, null, 2)}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Bạn là chuyên gia quản trị bán hàng ngành dược." },
        { role: "user", content: prompt },
      ],
    });

    return res.status(200).json({
      analysis: completion.choices?.[0]?.message?.content || "",
    });
  } catch (err: any) {
    console.error("analyzeWeeklyReport error:", err);
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}
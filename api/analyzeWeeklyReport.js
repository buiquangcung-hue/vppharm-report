import OpenAI from "openai";

const PROJECT_ID = "enthusiasts-golf-club-6868";

async function verifyFirebaseToken(idToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );

  const certs = await response.json();

  const decoded = JSON.parse(
    Buffer.from(idToken.split(".")[1], "base64").toString()
  );

  if (decoded.aud !== PROJECT_ID) {
    throw new Error("Invalid Firebase project");
  }

  return decoded;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);

    if (!tokenMatch) {
      return res.status(401).json({ error: "Missing token" });
    }

    const decoded = await verifyFirebaseToken(tokenMatch[1]);

    const { report } = req.body;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Bạn là trợ lý phân tích điều hành bán hàng cho Giám đốc Kinh doanh VP-PHARM.

Hãy phân tích báo cáo tuần và đưa ra:

1. Tóm tắt điều hành
2. Điểm mạnh đội ngũ
3. Điểm yếu cần cải thiện
4. Đề xuất coaching
5. Chiến lược đẩy sản phẩm

Dữ liệu:
${JSON.stringify(report, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Bạn là chuyên gia quản trị bán hàng dược." },
        { role: "user", content: prompt }
      ],
    });

    const analysis = completion.choices?.[0]?.message?.content || "";

    return res.status(200).json({
      uid: decoded.user_id,
      analysis
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "AI error"
    });
  }
}
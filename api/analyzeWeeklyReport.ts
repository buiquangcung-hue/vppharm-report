import OpenAI from "openai";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function initFirebaseAdmin() {
  if (getApps().length) return;

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const serviceAccount = JSON.parse(saJson);

  initializeApp({
    credential: cert(serviceAccount),
  });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    if (!tokenMatch) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const { report } = req.body || {};
    if (!report) {
      return res.status(400).json({ error: "Missing report in body" });
    }

    // 1) Verify Firebase ID token (đúng chuẩn)
    initFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(tokenMatch[1], true); // checkRevoked=true
    const uid = decoded.uid;

    // 2) Call OpenAI
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const prompt = `
Bạn là trợ lý phân tích điều hành bán hàng cho Giám đốc Kinh doanh VP-PHARM.
Hãy phân tích báo cáo tuần và đưa ra:
1) Tóm tắt điều hành
2) Coaching nhân viên / đội ngũ
3) Rủi ro
4) Cơ hội
5) Checklist tuần tới

Dữ liệu báo cáo (JSON):
${JSON.stringify(report, null, 2)}
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Bạn là chuyên gia quản trị bán hàng dược." },
        { role: "user", content: prompt },
      ],
    });

    const analysis = completion.choices?.[0]?.message?.content || "";

    // 3) Lưu Firestore (server-side, an toàn)
    const db = getFirestore();
    const docRef = await db.collection("weekly_reports").add({
      uid,
      report,
      analysis,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      uid,
      reportId: docRef.id,
      analysis,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      error: error?.message || "AI error",
    });
  }
}
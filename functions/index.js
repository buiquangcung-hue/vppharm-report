const admin = require("firebase-admin");
admin.initializeApp();

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// OpenAI v4 CJS-safe (tránh lỗi export default)
let OpenAI = require("openai");
OpenAI = OpenAI.default || OpenAI;

// Secret đã tạo: OPENAI_API_KEY
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// ✅ GEN2 Callable Function
exports.analyzeWeeklyReport = onCall(
  {
    // ✅ đổi region để tránh kẹt build/us-central1
    region: "asia-southeast1",

    // ✅ dùng secret (đã set bằng firebase functions:secrets:set OPENAI_API_KEY)
    secrets: [OPENAI_API_KEY],

    // ✅ tăng ổn định
    timeoutSeconds: 60,
    memory: "512MiB",

    // ✅ chỉ định rõ runtime service account
    // (SA này có sẵn trong IAM của bạn)
    serviceAccount: "firebase-adminsdk-fbsvc@enthusiasts-golf-club-6868.iam.gserviceaccount.com",
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Bạn chưa đăng nhập.");
      }

      const report = request.data?.report;
      if (!report) {
        throw new HttpsError("invalid-argument", "Thiếu dữ liệu report.");
      }

      const apiKey = OPENAI_API_KEY.value();
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "Chưa cấu hình OPENAI_API_KEY secret."
        );
      }

      const client = new OpenAI({ apiKey });

      const prompt = `
Bạn là trợ lý phân tích điều hành bán hàng cho Giám đốc Kinh doanh VP-PHARM.
Hãy phân tích báo cáo tuần đi công tác cùng nhân viên và trả về:
1) Tóm tắt điều hành (3-6 bullet, KPI chính)
2) Rủi ro & cơ hội
3) Coaching theo từng nhân viên (mạnh/yếu/hành động)
4) Ưu tiên hàng mục tiêu (top 3) + cách đẩy
5) Checklist tuần tới (10 mục)

Dữ liệu (JSON):
${JSON.stringify(report, null, 2)}
`;

      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Bạn là chuyên gia quản trị bán hàng ngành dược/OTC, giỏi coaching đội ngũ.",
          },
          { role: "user", content: prompt },
        ],
      });

      return { analysis: completion.choices?.[0]?.message?.content || "" };
    } catch (err) {
      console.error("analyzeWeeklyReport error:", err);
      // Nếu lỗi đã là HttpsError thì ném lại
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        "internal",
        "Có lỗi khi phân tích báo cáo. Vui lòng thử lại."
      );
    }
  }
);
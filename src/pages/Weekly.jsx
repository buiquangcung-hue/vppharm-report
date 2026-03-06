import { useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

function toPlainTextAnalysis(analysisJson, fallbackText) {
  if (!analysisJson || typeof analysisJson !== "object") return fallbackText || "";

  const lines = [];

  const pushSection = (title, items) => {
    if (!items) return;

    lines.push(title);

    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string") {
          lines.push(`- ${it}`);
        } else if (it && typeof it === "object") {
          const t = it.title || it.name || it.staff || "Mục";
          const r =
            it.reason ||
            it.rationale ||
            it.focus ||
            it.owner ||
            it.suggested_action ||
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

  pushSection("Tóm tắt điều hành", analysisJson.executive_summary);
  pushSection("Chẩn đoán / nguyên nhân", analysisJson.diagnosis?.drivers || analysisJson.diagnosis);
  pushSection("Cảnh báo", analysisJson.alerts);
  pushSection("Cơ hội", analysisJson.opportunities);
  pushSection("Coaching plan", analysisJson.coaching_plan);
  pushSection("Action plan tuần tới", analysisJson.action_plan);

  if (analysisJson.questions_to_clarify?.length) {
    pushSection("Câu hỏi cần làm rõ", analysisJson.questions_to_clarify);
  }

  return lines.join("\n").trim();
}

function getWeekKeyHint() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function Weekly() {
  const [form, setForm] = useState({
    weekKey: getWeekKeyHint(),
    results: "",
    people: "",
    risks: "",
    nextWeekPlan: "",
  });

  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisJson, setAnalysisJson] = useState(null);
  const [savedId, setSavedId] = useState("");
  const [error, setError] = useState("");

  const reportPayload = useMemo(() => {
    return {
      weekKey: (form.weekKey || "").trim(),
      results: (form.results || "").trim(),
      people: (form.people || "").trim(),
      risks: (form.risks || "").trim(),
      nextWeekPlan: (form.nextWeekPlan || "").trim(),
    };
  }, [form]);

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function submitReport() {
    try {
      setLoading(true);
      setSavedId("");
      setError("");
      setAnalysisText("");
      setAnalysisJson(null);

      if (!auth.currentUser) {
        throw new Error("Bạn chưa đăng nhập.");
      }

      if (!reportPayload.weekKey) {
        throw new Error("Vui lòng nhập tuần báo cáo.");
      }

      // Gọi API AI
      const res = await fetch("/api/analyzeWeeklyReport", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: reportPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "API error");
      }

      const aJson = data.analysis_json || null;
      const aText = data.analysis_text || data.analysis || "";

      setAnalysisJson(aJson);

      const prettyText = toPlainTextAnalysis(aJson, aText);
      setAnalysisText(prettyText);

      // Lưu Firestore
      const user = auth.currentUser;

      const docRef = await addDoc(collection(db, "weekly_reports"), {
        weekKey: reportPayload.weekKey || null,
        ownerUid: user.uid,
        ownerEmail: user.email || null,
        input: reportPayload,
        analysis_text: prettyText,
        analysis_json: aJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSavedId(docRef.id);
    } catch (e) {
      const msg = String(e?.message || e);
      setError(msg);
      setAnalysisText(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-header">
          <h2>AI Weekly Sales Intelligence</h2>
          <p>VP-PHARM · Báo cáo tuần → AI phân tích → Lưu lịch sử</p>
        </div>

        <div className="card-body">
          <div className="grid two">
            <div>
              <label>Tuần báo cáo (weekKey)</label>
              <input
                value={form.weekKey}
                onChange={(e) => updateField("weekKey", e.target.value)}
                placeholder="Ví dụ: 2026-W10"
              />
              <div className="small" style={{ marginTop: 8 }}>
                Gợi ý: <span className="kbd">{getWeekKeyHint()}</span>
              </div>
            </div>

            <div>
              <label>Trạng thái lưu</label>
              <div className="pill" style={{ marginTop: 2 }}>
                {savedId ? (
                  <>
                    <span className="small">Đã lưu:</span>
                    <span className="kbd">{savedId}</span>
                  </>
                ) : (
                  <>
                    <span className="small">Chưa lưu</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hr"></div>

          <label>Kết quả tuần</label>
          <textarea
            rows={5}
            value={form.results}
            onChange={(e) => updateField("results", e.target.value)}
          />

          <label>Con người (nhân sự / coaching)</label>
          <textarea
            rows={5}
            value={form.people}
            onChange={(e) => updateField("people", e.target.value)}
          />

          <label>Vận hành & rủi ro</label>
          <textarea
            rows={5}
            value={form.risks}
            onChange={(e) => updateField("risks", e.target.value)}
          />

          <label>Kế hoạch tuần tới</label>
          <textarea
            rows={5}
            value={form.nextWeekPlan}
            onChange={(e) => updateField("nextWeekPlan", e.target.value)}
          />

          <div style={{ height: 14 }} />

          <div className="row">
            <button className="btn" onClick={submitReport} disabled={loading}>
              {loading ? "AI đang phân tích..." : "Phân tích & Lưu báo cáo"}
            </button>
          </div>

          {error ? (
            <div style={{ marginTop: 12 }} className="small">
              Lỗi: {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Kết quả phân tích AI</h2>
        </div>

        <div className="card-body">
          <div
            style={{
              whiteSpace: "pre-wrap",
              background: "rgba(255,255,255,.06)",
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.10)",
              minHeight: 160,
            }}
          >
            {analysisText || "Chưa có kết quả."}
          </div>

          {analysisJson ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                Xem JSON cấu trúc
              </summary>
              <pre
                style={{
                  overflow: "auto",
                  background: "rgba(0,0,0,.25)",
                  color: "#d6e2ff",
                  padding: 12,
                  borderRadius: 12,
                  marginTop: 10,
                }}
              >
                {JSON.stringify(analysisJson, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
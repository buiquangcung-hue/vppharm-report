import { useMemo, useState } from "react";
import WeeklyReportForm from "../components/WeeklyReportForm.jsx";
import { db } from "../firebase.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

function toPlainTextAnalysis(analysisJson, fallbackText) {
  if (!analysisJson || typeof analysisJson !== "object") return fallbackText || "";
  const lines = [];

  const pushSection = (title, items) => {
    if (!items) return;
    lines.push(title);
    if (Array.isArray(items)) {
      for (const it of items) {
        if (typeof it === "string") lines.push(`- ${it}`);
        else if (it && typeof it === "object") {
          const t = it.title || it.name || it.staff || "Mục";
          const r = it.reason || it.rationale || it.focus || it.owner || "";
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

export default function Weekly() {
  const [form, setForm] = useState({
    weekKey: "",
    results: "",
    people: "",
    risks: "",
    nextWeekPlan: "",
  });

  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisJson, setAnalysisJson] = useState(null);
  const [savedId, setSavedId] = useState("");

  const reportPayload = useMemo(() => {
    return {
      weekKey: (form.weekKey || "").trim(),
      results: (form.results || "").trim(),
      people: (form.people || "").trim(),
      risks: (form.risks || "").trim(),
      nextWeekPlan: (form.nextWeekPlan || "").trim(),
    };
  }, [form]);

  async function submit() {
    try {
      setLoading(true);
      setSavedId("");
      setAnalysisText("");
      setAnalysisJson(null);

      // 1) Call AI API
      const res = await fetch("/api/analyzeWeeklyReport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: reportPayload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "API error");

      const aJson = data.analysis_json || null;
      const aText = data.analysis_text || data.analysis || "";

      setAnalysisJson(aJson);
      const prettyText = toPlainTextAnalysis(aJson, aText);
      setAnalysisText(prettyText);

      // 2) Save Firestore (client-side)
      const docRef = await addDoc(collection(db, "weekly_reports"), {
        weekKey: reportPayload.weekKey || null,
        input: reportPayload,
        analysis_text: prettyText,
        analysis_json: aJson,
        createdAt: serverTimestamp(),
      });

      setSavedId(docRef.id);
    } catch (e) {
      setAnalysisText(`Lỗi: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "34px auto", padding: "0 14px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14 }}>
        <div>
          <h1 style={{ margin: 0 }}>AI Weekly Sales Intelligence</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            VP-PHARM • Báo cáo tuần → AI phân tích → Lưu lịch sử
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {savedId ? (
            <span>
              Đã lưu Firestore: <b>{savedId}</b>
            </span>
          ) : (
            <span>Chưa lưu</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <WeeklyReportForm value={form} onChange={setForm} onSubmit={submit} loading={loading} />
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <h2 style={{ marginTop: 0 }}>Kết quả phân tích AI</h2>
        <div
          style={{
            whiteSpace: "pre-wrap",
            background: "#f6f7f9",
            padding: 14,
            borderRadius: 12,
            border: "1px solid #e9e9e9",
            minHeight: 120,
          }}
        >
          {analysisText || "Chưa có kết quả. Hãy nhập báo cáo và bấm “Phân tích & Lưu báo cáo”."}
        </div>

        {analysisJson ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Xem JSON cấu trúc</summary>
            <pre style={{ overflow: "auto", background: "#0b1020", color: "#d6e2ff", padding: 12, borderRadius: 12 }}>
              {JSON.stringify(analysisJson, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
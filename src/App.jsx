import { useState } from "react";

export default function App() {

  const [report, setReport] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyzeReport() {
    setLoading(true);

    const res = await fetch("/api/analyzeWeeklyReport", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        report: report
      })
    });

    const data = await res.json();
    setAnalysis(data.analysis || data.error);

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial" }}>

      <h1>VP-PHARM AI Báo Cáo Tuần</h1>

      <textarea
        rows={10}
        style={{ width: "100%", padding: 10 }}
        placeholder="Nhập báo cáo tuần của bạn..."
        value={report}
        onChange={(e) => setReport(e.target.value)}
      />

      <br /><br />

      <button onClick={analyzeReport} disabled={loading}>
        {loading ? "AI đang phân tích..." : "Phân tích báo cáo"}
      </button>

      <hr style={{ margin: "30px 0" }} />

      <h2>Kết quả phân tích AI</h2>

      <div style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 20 }}>
        {analysis}
      </div>

    </div>
  );
}
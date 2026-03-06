import { useMemo } from "react";

export default function WeeklyReportForm({ value, onChange, onSubmit, loading }) {
  const v = value || {};

  const weekKeyHint = useMemo(() => {
    // hint đơn giản, không cần chính xác ISO week tuyệt đối
    const d = new Date();
    const y = d.getFullYear();
    const start = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - start) / (24 * 3600 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  }, []);

  function setField(key, val) {
    onChange({ ...v, [key]: val });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700 }}>Tuần báo cáo (weekKey)</label>
        <input
          value={v.weekKey || ""}
          onChange={(e) => setField("weekKey", e.target.value)}
          placeholder={`Ví dụ: ${weekKeyHint}`}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <div style={{ fontSize: 12, color: "#666" }}>
          Gợi ý: {weekKeyHint}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700 }}>Kết quả tuần</label>
        <textarea
          rows={4}
          value={v.results || ""}
          onChange={(e) => setField("results", e.target.value)}
          placeholder={[
            "- Doanh thu: ...",
            "- Độ phủ/điểm bán active: ...",
            "- Khách hàng mới/rời bỏ: ...",
            "- Top SKU tăng/giảm: ...",
          ].join("\n")}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700 }}>Con người (nhân sự / coaching)</label>
        <textarea
          rows={4}
          value={v.people || ""}
          onChange={(e) => setField("people", e.target.value)}
          placeholder={[
            "- NV vượt KPI: A, B (lý do)",
            "- NV dưới KPI: C (nguyên nhân)",
            "- Nhu cầu hỗ trợ/training/chính sách: ...",
          ].join("\n")}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700 }}>Vận hành & rủi ro</label>
        <textarea
          rows={4}
          value={v.risks || ""}
          onChange={(e) => setField("risks", e.target.value)}
          placeholder={[
            "- Tồn kho bất thường: ...",
            "- Công nợ/COD/giao hàng: ...",
            "- Khiếu nại khách: ...",
            "- Đối thủ/biến động thị trường: ...",
          ].join("\n")}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700 }}>Kế hoạch tuần tới</label>
        <textarea
          rows={4}
          value={v.nextWeekPlan || ""}
          onChange={(e) => setField("nextWeekPlan", e.target.value)}
          placeholder={[
            "- Mục tiêu doanh thu: ...",
            "- Mở điểm bán: ...",
            "- SKU trọng tâm: ...",
            "- Kế hoạch coaching: ...",
            "- CTKM/đề xuất hỗ trợ: ...",
          ].join("\n")}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={onSubmit}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: loading ? "#eee" : "#111",
            color: loading ? "#666" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "AI đang phân tích..." : "Phân tích & Lưu báo cáo"}
        </button>
        <div style={{ fontSize: 12, color: "#666" }}>
          AI sẽ trả JSON cấu trúc + tóm tắt điều hành.
        </div>
      </div>
    </div>
  );
}
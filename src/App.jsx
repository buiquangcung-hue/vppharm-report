import { useState } from "react";
import Weekly from "./pages/Weekly.jsx";
import Reports from "./pages/Reports.jsx";

export default function App() {
  const [tab, setTab] = useState("weekly");

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "Arial",
          }}
        >
          <div style={{ fontWeight: 900 }}>VP-PHARM • AI Weekly Sales Intelligence</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setTab("weekly")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: tab === "weekly" ? "#111" : "#fff",
                color: tab === "weekly" ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Weekly
            </button>
            <button
              onClick={() => setTab("reports")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: tab === "reports" ? "#111" : "#fff",
                color: tab === "reports" ? "#fff" : "#111",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Reports
            </button>
          </div>
        </div>
      </div>

      {tab === "weekly" ? <Weekly /> : <Reports />}
    </div>
  );
}
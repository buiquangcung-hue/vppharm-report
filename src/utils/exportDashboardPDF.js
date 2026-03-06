import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportDashboardPDF() {

  const element = document.getElementById("ceo-brief");

  if (!element) {
    alert("Không tìm thấy nội dung để xuất PDF.");
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#0b0f19",
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();

  const imgWidth = pageWidth - 40;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);

  const now = new Date();

  const fileName =
    "VP-PHARM_CEO_Brief_" +
    now.toISOString().slice(0, 10) +
    ".pdf";

  pdf.save(fileName);
}
export function removeVietnameseTones(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function slugifyVietnamese(text = "") {
  return removeVietnameseTones(text)
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function formatDateToDdMmYy(dateInput) {
  if (!dateInput) return "";

  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);

  return `${dd}-${mm}-${yy}`;
}

export function buildWeeklyReportName(weekFrom, employeeName) {
  const datePart = formatDateToDdMmYy(weekFrom);
  const employeePart = slugifyVietnamese(employeeName || "Nhan-Vien");
  return `BC_Tuan_${datePart}_${employeePart}`;
}

export function buildWeeklyReportDisplayName(weekFrom, employeeName) {
  if (!weekFrom) return "";
  const d = new Date(weekFrom);
  if (Number.isNaN(d.getTime())) return "";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);

  return `BC_Tuan_${dd}/${mm}/${yy}_${employeeName || "Nhân viên"}`;
}
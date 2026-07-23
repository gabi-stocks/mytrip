// עוזרי תאריך משותפים. תאריכים מאוחסנים כמחרוזת "YYYY-MM-DD" (כמו input type="date").

export function formatDateLong(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
}

// כל התאריכים בין start ל-end (כולל), כמערך מחרוזות "YYYY-MM-DD"
export function dateRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  let cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

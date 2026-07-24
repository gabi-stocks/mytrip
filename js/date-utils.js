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
  return out;// כל התאריכים ש"תפוסים" על ידי מקום נתון. ברוב המקרים זה פשוט התאריך שלו.
// עבור לינה עם תאריך יציאה (checkOutDate) מוגדר — כל הלילות מהכניסה ועד
// (לא כולל) תאריך היציאה, כי ביום היציאה כבר לא ישנים שם.
export function occupiedDates(place) {
  if (!place.date) return [];
  if (place.category === "lodging" && place.checkOutDate && place.checkOutDate > place.date) {
    return dateRange(place.date, place.checkOutDate).slice(0, -1);
  }
  return [place.date];
}
}

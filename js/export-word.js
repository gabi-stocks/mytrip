import { CATEGORY_LABELS } from "./categories.js";
import { formatDateLong } from "./date-utils.js";
import { googleMapsLink, withDistancesToNext, formatKm } from "./geo-utils.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function sortKey(place) {
  // בתוך אותו תאריך: קודם לפי מספור (order) שנקבע ידנית, ואז לפי מועד היצירה
  return (place.order ?? 9999) * 1e15 + (place.createdAt?.seconds || 0);
}

function buildDayTable(places) {
  const ordered = withDistancesToNext([...places].sort((a, b) => sortKey(a) - sortKey(b)));
  const rows = ordered.map((p) => {
    const nameCell = (typeof p.lat === "number")
      ? `<a href="${googleMapsLink(p)}">${escapeHtml(p.name)}</a>`
      : escapeHtml(p.name);
    const distCell = p.distanceToNextKm != null ? formatKm(p.distanceToNextKm) + " למקום הבא" : "";
    return `
      <tr>
        <td>${p.order ?? ""}</td>
        <td>${nameCell}</td>
        <td>${CATEGORY_LABELS[p.category] || "אחר"}</td>
        <td>${escapeHtml(p.notes || "")}</td>
        <td>${escapeHtml(p.personalNote || "")}</td>
        <td>${distCell}</td>
      </tr>`;
  }).join("");

  return `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:11pt;">
      <thead>
        <tr style="background:#EFE7D6;">
          <th>#</th><th>מקום</th><th>קטגוריה</th><th>הסבר</th><th>הערה אישית</th><th>מרחק</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function exportTripToWord(trip, places) {
  const active = places.filter((p) => !p.deleted);
  const byDate = new Map();
  const noDate = [];

  for (const p of active) {
    if (!p.date) { noDate.push(p); continue; }
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date).push(p);
  }

  const sortedDates = [...byDate.keys()].sort();

  let sections = sortedDates.map((date) => `
    <h2 style="font-family:Georgia,serif; border-bottom:1px solid #999; padding-bottom:4px;">${escapeHtml(formatDateLong(date))}</h2>
    ${buildDayTable(byDate.get(date))}
    <br/>
  `).join("");

  if (noDate.length > 0) {
    sections += `
      <h2 style="font-family:Georgia,serif; border-bottom:1px solid #999; padding-bottom:4px;">ללא תאריך משויך</h2>
      ${buildDayTable(noDate)}
    `;
  }

  const title = trip.name || "טיול";
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; direction: rtl; }
        table { direction: rtl; }
        th, td { text-align: right; }
        h1 { font-family: Georgia, serif; }
      </style>
    </head>
    <body dir="rtl">
      <h1>${escapeHtml(title)}</h1>
      ${sections || "<p>אין עדיין מקומות בטיול.</p>"}
    </body>
    </html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

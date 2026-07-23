import { ensureSignedIn } from "./firebase-init.js";
import { createTrip, listenToTrips, addPlace } from "./trip-store.js";
import { readBackupFile } from "./backup.js";

const form = document.getElementById("new-trip-form");
const nameInput = document.getElementById("new-trip-name");
const startInput = document.getElementById("new-trip-start");
const endInput = document.getElementById("new-trip-end");
const list = document.getElementById("trips-list");
const restoreBtn = document.getElementById("restore-backup-btn");
const restoreInput = document.getElementById("restore-backup-input");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderTrips(trips) {
  if (trips.length === 0) {
    list.innerHTML = `<p class="empty-state">עוד אין טיולים. צרו את הטיול הראשון למעלה.</p>`;
    return;
  }
  list.innerHTML = trips.map(trip => `
    <a class="trip-card" href="trip.html?id=${encodeURIComponent(trip.id)}">
      <span class="trip-card-stamp">&#9992;</span>
      <h3>${escapeHtml(trip.name || "טיול ללא שם")}</h3>
    </a>
  `).join("");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const submitBtn = form.querySelector("button");
  submitBtn.disabled = true;
  try {
    const id = await createTrip(name, startInput.value || null, endInput.value || null);
    window.location.href = `trip.html?id=${encodeURIComponent(id)}`;
  } catch (err) {
    console.error(err);
    alert("יצירת הטיול נכשלה. נסו שוב.");
    submitBtn.disabled = false;
  }
});

restoreBtn.addEventListener("click", () => restoreInput.click());

restoreInput.addEventListener("change", async () => {
  const file = restoreInput.files[0];
  if (!file) return;
  restoreBtn.disabled = true;
  restoreBtn.textContent = "משחזר...";
  try {
    const data = await readBackupFile(file);
    const restoredName = (data.trip.name || "טיול") + " (משוחזר)";
    const id = await createTrip(restoredName, data.trip.startDate, data.trip.endDate);
    for (const p of data.places) {
      await addPlace(id, p);
    }
    window.location.href = `trip.html?id=${encodeURIComponent(id)}`;
  } catch (err) {
    console.error(err);
    alert(err.message || "שחזור הגיבוי נכשל.");
    restoreBtn.disabled = false;
    restoreBtn.textContent = "שחזור טיול מקובץ גיבוי";
  }
});

async function init() {
  try {
    await ensureSignedIn();
    listenToTrips(renderTrips);
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="error-text">שגיאה בהתחברות ל-Firebase. בדקו את ההגדרות ב-firebase-init.js.</p>`;
  }
}

init();

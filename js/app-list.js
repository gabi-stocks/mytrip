import { ensureSignedIn } from "./firebase-init.js";
import {
  createTrip, listenToTrips, addPlace,
  renameTrip, trashTrip, restoreTrip, purgeTrip
} from "./trip-store.js";
import { readBackupFile } from "./backup.js";
import { requireAdmin } from "./admin.js";

const form = document.getElementById("new-trip-form");
const nameInput = document.getElementById("new-trip-name");
const startInput = document.getElementById("new-trip-start");
const endInput = document.getElementById("new-trip-end");
const list = document.getElementById("trips-list");
const restoreBtn = document.getElementById("restore-backup-btn");
const restoreInput = document.getElementById("restore-backup-input");
const toggleTrashBtn = document.getElementById("toggle-trips-trash");
const trashPanel = document.getElementById("trips-trash-panel");
const trashList = document.getElementById("trips-trash-list");

let allTrips = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderTrips() {
  const activeTrips = allTrips.filter((t) => !t.deleted);

  if (activeTrips.length === 0) {
    list.innerHTML = `<p class="empty-state">עוד אין טיולים. צרו את הטיול הראשון למעלה.</p>`;
    return;
  }

  list.innerHTML = activeTrips
    .map(
      (trip) => `
    <div class="trip-card" data-id="${trip.id}">
      <div class="trip-card-header">
        <span class="trip-card-stamp">&#9992;</span>
        <div class="trip-card-actions">
          <button class="icon-btn" data-action="rename" title="שינוי שם">&#9998;</button>
          <button class="icon-btn" data-action="delete" title="מחיקה">&#128465;</button>
        </div>
      </div>
      <a class="trip-card-link" href="trip.html?id=${encodeURIComponent(trip.id)}">
        <h3>${escapeHtml(trip.name || "טיול ללא שם")}</h3>
      </a>
    </div>
  `
    )
    .join("");

  [...list.querySelectorAll(".trip-card")].forEach((card) => {
    const trip = activeTrips.find((t) => t.id === card.dataset.id);
    if (!trip) return;
    card.querySelector('[data-action="rename"]').addEventListener("click", (e) => {
      e.preventDefault();
      handleRename(trip);
    });
    card.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
      e.preventDefault();
      handleDelete(trip);
    });
  });
}

async function handleRename(trip) {
  if (!requireAdmin()) return;
  const newName = prompt("שם חדש לטיול:", trip.name || "");
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === trip.name) return;
  try {
    await renameTrip(trip.id, trimmed);
  } catch (err) {
    console.error(err);
    alert("שינוי השם נכשל.");
  }
}

async function handleDelete(trip) {
  if (!requireAdmin()) return;
  if (!confirm(`להעביר את הטיול "${trip.name}" לפח האשפה? אפשר לשחזר משם.`)) return;
  try {
    await trashTrip(trip.id);
  } catch (err) {
    console.error(err);
    alert("המחיקה נכשלה.");
  }
}

function renderTripsTrash() {
  const trashed = allTrips.filter((t) => t.deleted);
  if (trashed.length === 0) {
    trashList.innerHTML = `<p class="hint">פח האשפה ריק.</p>`;
    return;
  }
  trashList.innerHTML = trashed
    .map(
      (trip) => `
    <div class="suggestion-card" data-id="${trip.id}">
      <div><strong>${escapeHtml(trip.name || "טיול ללא שם")}</strong></div>
      <div class="row-actions">
        <button class="secondary" data-action="restore">שחזור</button>
        <button class="secondary" data-action="purge">מחיקה לצמיתות</button>
      </div>
    </div>
  `
    )
    .join("");

  [...trashList.children].forEach((card) => {
    const trip = trashed.find((t) => t.id === card.dataset.id);
    if (!trip) return;
    card.querySelector('[data-action="restore"]').addEventListener("click", async () => {
      try {
        await restoreTrip(trip.id);
      } catch (err) {
        console.error(err);
        alert("השחזור נכשל.");
      }
    });
    card.querySelector('[data-action="purge"]').addEventListener("click", async () => {
      if (!confirm(`למחוק לצמיתות את "${trip.name}"? כל המקומות שבתוכו יימחקו גם הם. לא ניתן לשחזר.`)) return;
      try {
        await purgeTrip(trip.id);
      } catch (err) {
        console.error(err);
        alert("המחיקה נכשלה.");
      }
    });
  });
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

toggleTrashBtn.addEventListener("click", () => {
  if (trashPanel.hidden && !requireAdmin()) return;
  trashPanel.hidden = !trashPanel.hidden;
  if (!trashPanel.hidden) renderTripsTrash();
});

async function init() {
  try {
    await ensureSignedIn();
    listenToTrips((trips) => {
      allTrips = trips;
      renderTrips();
      if (!trashPanel.hidden) renderTripsTrash();
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="error-text">שגיאה בהתחברות ל-Firebase. בדקו את ההגדרות ב-firebase-init.js.</p>`;
  }
}

init();

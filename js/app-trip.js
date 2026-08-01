import { ensureSignedIn } from "./firebase-init.js";
import {
  getTrip, listenToPlaces, addPlace, updatePlace,
  trashPlace, restorePlace, purgePlace,
  listenToNotes, addNote, deleteNote
} from "./trip-store.js";
import { loadGoogleMaps } from "./maps-loader.js";
import { searchPlacesByText, searchNearby } from "./places-search.js";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "./categories.js";
import { formatDateShort, formatDateLong, dateRange, occupiedDates } from "./date-utils.js";
import { googleMapsLink, withDistancesToNext, formatKm, haversineKm } from "./geo-utils.js";
import { exportTripToWord } from "./export-word.js";
import { exportTripBackup } from "./backup.js";

const params = new URLSearchParams(window.location.search);
const tripId = params.get("id");

const els = {
  tripName: document.getElementById("trip-name"),
  copyLinkBtn: document.getElementById("copy-link-btn"),
  viewToggleBtns: [...document.querySelectorAll(".view-toggle button")],
  categoryChips: document.getElementById("category-chips"),
  dateTabs: document.getElementById("date-tabs"),
  mapDiv: document.getElementById("map"),
  tableWrap: document.getElementById("table-wrap"),
  placesTbody: document.getElementById("places-tbody"),
  toggleAddPlace: document.getElementById("toggle-add-place"),
  addPlacePanel: document.getElementById("add-place-panel"),
  placeName: document.getElementById("place-name"),
  placeNameEn: document.getElementById("place-name-en"),
  placeCategory: document.getElementById("place-category"),
  placeDateLabel: document.getElementById("place-date-label"),
  placeDate: document.getElementById("place-date"),
  placeCheckoutRow: document.getElementById("place-checkout-row"),
  placeCheckout: document.getElementById("place-checkout"),
  placeOrder: document.getElementById("place-order"),
  placeNotes: document.getElementById("place-notes"),
  placePersonalNote: document.getElementById("place-personal-note"),
  placeSource: document.getElementById("place-source"),
  searchPlaceBtn: document.getElementById("search-place-btn"),
  pickOnMapBtn: document.getElementById("pick-on-map-btn"),
  locationStatus: document.getElementById("location-status"),
  candidateList: document.getElementById("candidate-list"),
  cancelPlaceBtn: document.getElementById("cancel-place-btn"),
  savePlaceBtn: document.getElementById("save-place-btn"),
  suggestionsWrap: document.getElementById("suggestions-wrap"),
  suggestionsList: document.getElementById("suggestions-list"),
  notesWrap: document.getElementById("notes-wrap"),
  noteInput: document.getElementById("note-input"),
  addNoteBtn: document.getElementById("add-note-btn"),
  notesList: document.getElementById("notes-list"),
  toggleTrash: document.getElementById("toggle-trash"),
  trashPanel: document.getElementById("trash-panel"),
  trashList: document.getElementById("trash-list"),
  exportWordBtn: document.getElementById("export-word-btn"),
  backupTripBtn: document.getElementById("backup-trip-btn"),
};

let map = null;
let markers = new Map();
let polyline = null;
let infoWindow = null;
let trip = null;
let allPlaces = [];
let allNotes = [];
let currentCategory = "all";
let currentDate = "all";
let pendingLocation = null;
let pickingOnMap = false;
let editingPlaceId = null;

// עוקב אם אנחנו כרגע ב"שכבת היסטוריה" שנפתחה בשביל פאנל ההוספה/עריכה —
// כדי שכפתור "אחורה" בנייד יסגור את הפאנל במקום לצאת ישר לעמוד הבית.
let addPlacePanelHistoryPushed = false;

function openAddPlacePanel() {
  els.addPlacePanel.hidden = false;
  if (!addPlacePanelHistoryPushed) {
    history.pushState({ panel: "add-place" }, "", location.href);
    addPlacePanelHistoryPushed = true;
  }
}

function closeAddPlacePanel() {
  els.addPlacePanel.hidden = true;
  if (addPlacePanelHistoryPushed) {
    addPlacePanelHistoryPushed = false;
    history.back();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// חלון המידע על המפה הוא HTML שגוגל מזריק לעמוד — כדי שהלחיצה על שם
// המקום שם תוכל לפתוח את טופס העריכה שלנו (שחי בתוך המודול), חושפים
// פונקציה קטנה גלובלית שהתוכן של חלון המידע יכול לקרוא לה.
window.__editPlaceFromMap = function (placeId) {
  const place = allPlaces.find((p) => p.id === placeId);
  if (place) startEditPlace(place);
};

async function init() {
  if (!tripId) {
    els.tripName.textContent = "לא נמצא טיול";
    return;
  }
  await ensureSignedIn();

  trip = await getTrip(tripId);
  if (!trip) {
    els.tripName.textContent = "הטיול לא נמצא";
    return;
  }
  els.tripName.textContent = trip.name || "טיול ללא שם";
  document.title = (trip.name || "טיול") + " — מתכנן הטיולים";
  renderDateTabs();

  const gmaps = await loadGoogleMaps();
  map = new gmaps.Map(els.mapDiv, {
    center: { lat: 41.8967, lng: 12.4822 },
    zoom: 5
  });
  infoWindow = new gmaps.InfoWindow();

  map.addListener("click", (e) => {
    if (!pickingOnMap) return;
    setPendingLocation({ lat: e.latLng.lat(), lng: e.latLng.lng(), placeId: null, address: "" }, "המיקום נבחר על המפה");
    pickingOnMap = false;
    els.pickOnMapBtn.textContent = "סימון ידני על המפה";
  });

  window.addEventListener("popstate", () => {
    // לחיצת "אחורה" בזמן שהפאנל פתוח: סוגרים את הפאנל במקום לעזוב את העמוד.
    if (!els.addPlacePanel.hidden) {
      els.addPlacePanel.hidden = true;
      addPlacePanelHistoryPushed = false;
    }
  });

  listenToPlaces(tripId, (places) => {
    allPlaces = places;
    renderDateTabs();
    renderMarkers();
    renderTable();
    if (!els.trashPanel.hidden) renderTrash();
  });

  listenToNotes(tripId, (notes) => {
    allNotes = notes;
    renderNotes();
  });

  bindUI();
}

function bindUI() {
  els.copyLinkBtn.addEventListener("click", async () => {
    const shareData = {
      title: trip?.name || "טיול",
      text: "בואו לתכנן את הטיול ביחד:",
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // המשתמש ביטל את השיתוף או שהדפדפן לא תמך בפועל — נופלים לחזרה להעתקה
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      els.copyLinkBtn.textContent = "הקישור הועתק!";
      setTimeout(() => (els.copyLinkBtn.textContent = "שיתוף הטיול עם המשפחה"), 2000);
    } catch {
      prompt("העתיקו את הקישור הבא:", window.location.href);
    }
  });

  els.viewToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.viewToggleBtns.forEach((b) => b.classList.toggle("active", b === btn));
      els.mapDiv.hidden = btn.dataset.view !== "map";
      els.tableWrap.hidden = btn.dataset.view !== "table";
      els.suggestionsWrap.hidden = btn.dataset.view !== "suggestions";
      els.notesWrap.hidden = btn.dataset.view !== "notes";
    });
  });

  els.categoryChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    currentCategory = chip.dataset.cat;
    [...els.categoryChips.children].forEach((c) => c.classList.toggle("active", c === chip));
    renderMarkers();
    renderTable();
  });

  els.dateTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".day-tab");
    if (!tab) return;
    currentDate = tab.dataset.date;
    [...els.dateTabs.children].forEach((t) => t.classList.toggle("active", t === tab));
    renderMarkers();
    renderTable();
  });

  els.placeCategory.addEventListener("change", updateCheckoutVisibility);

  els.toggleAddPlace.addEventListener("click", () => {
    resetPlaceForm();
    if (els.addPlacePanel.hidden) {
      openAddPlacePanel();
    } else {
      closeAddPlacePanel();
    }
    els.trashPanel.hidden = true;
  });
  els.cancelPlaceBtn.addEventListener("click", () => {
    closeAddPlacePanel();
    resetPlaceForm();
  });

  els.searchPlaceBtn.addEventListener("click", async () => {
    const q = els.placeName.value.trim();
    if (!q) {
      els.locationStatus.textContent = "כתבו שם מקום לפני החיפוש";
      return;
    }
    els.locationStatus.textContent = "מחפש...";
    try {
      const results = await searchPlacesByText(map, q);
      if (results.length === 0) {
        els.locationStatus.textContent = "לא נמצאו תוצאות. אפשר לסמן ידנית על המפה.";
        els.candidateList.hidden = true;
        return;
      }
      renderCandidates(results);
    } catch (err) {
      console.error(err);
      els.locationStatus.textContent = "החיפוש נכשל.";
    }
  });

  els.pickOnMapBtn.addEventListener("click", () => {
    pickingOnMap = !pickingOnMap;
    els.pickOnMapBtn.textContent = pickingOnMap ? "לחצו על המפה כדי לסמן..." : "סימון ידני על המפה";
  });

  els.savePlaceBtn.addEventListener("click", savePlace);

  els.suggestionsWrap.querySelectorAll("[data-suggest-type]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const type = btn.dataset.suggestType;
      els.suggestionsList.innerHTML = `<p class="hint">מחפש הצעות...</p>`;
      try {
        const centerLatLng = map.getCenter();
        const center = { lat: centerLatLng.lat(), lng: centerLatLng.lng() };
        const results = await searchNearby(map, center, type);
        renderSuggestions(results, type === "tourist_attraction" ? "attraction" : "restaurant", center);
      } catch (err) {
        console.error(err);
        els.suggestionsList.innerHTML = `<p class="error-text">החיפוש נכשל.</p>`;
      }
    });
  });

  els.addNoteBtn.addEventListener("click", async () => {
    const text = els.noteInput.value.trim();
    if (!text) return;
    els.addNoteBtn.disabled = true;
    try {
      await addNote(tripId, text);
      els.noteInput.value = "";
    } catch (err) {
      console.error(err);
      alert("הוספת ההערה נכשלה.");
    } finally {
      els.addNoteBtn.disabled = false;
    }
  });

  els.toggleTrash.addEventListener("click", () => {
    els.trashPanel.hidden = !els.trashPanel.hidden;
    els.addPlacePanel.hidden = true;
    if (!els.trashPanel.hidden) renderTrash();
  });

  els.exportWordBtn.addEventListener("click", () => {
    exportTripToWord(trip, allPlaces);
  });

  els.backupTripBtn.addEventListener("click", () => {
    exportTripBackup(trip, allPlaces);
  });
}

// ---------- טפסים ----------

function renderCandidates(results) {
  els.candidateList.hidden = false;
  els.candidateList.innerHTML = results
    .map((r, i) => `
      <div class="candidate-item" data-idx="${i}">
        ${escapeHtml(r.name)}
        <small>${escapeHtml(r.address)}</small>
      </div>
    `)
    .join("");
  [...els.candidateList.children].forEach((el, i) => {
    el.addEventListener("click", () => {
      const r = results[i];
      els.placeName.value = r.name;
      setPendingLocation(r, "נבחר: " + r.name);
      els.candidateList.hidden = true;
    });
  });
}

function setPendingLocation(loc, statusText) {
  pendingLocation = loc;
  els.locationStatus.textContent = statusText;
}

function updateCheckoutVisibility() {
  const isLodging = els.placeCategory.value === "lodging";
  els.placeCheckoutRow.hidden = !isLodging;
  els.placeDateLabel.textContent = isLodging ? "תאריך כניסה (אופציונלי)" : "תאריך (אופציונלי)";
}

function resetPlaceForm() {
  editingPlaceId = null;
  pendingLocation = null;
  pickingOnMap = false;
  els.placeName.value = "";
  els.placeNameEn.value = "";
  els.placeCategory.value = "lodging";
  els.placeDate.value = currentDate !== "all" && currentDate !== "none" ? currentDate : "";
  els.placeCheckout.value = "";
  els.placeOrder.value = "";
  els.placeNotes.value = "";
  els.placePersonalNote.value = "";
  els.placeSource.value = "";
  els.locationStatus.textContent = "";
  els.candidateList.hidden = true;
  els.pickOnMapBtn.textContent = "סימון ידני על המפה";
  updateCheckoutVisibility();
}

async function savePlace() {
  const name = els.placeName.value.trim();
  if (!name) {
    alert("נא להזין שם מקום");
    return;
  }
  const category = els.placeCategory.value;
  const date = els.placeDate.value || null;
  const checkOutDate = category === "lodging" ? (els.placeCheckout.value || null) : null;
  if (checkOutDate && date && checkOutDate <= date) {
    alert("תאריך היציאה חייב להיות אחרי תאריך הכניסה.");
    return;
  }
  const data = {
    name,
    nameEn: els.placeNameEn.value.trim() || null,
    category,
    date,
    checkOutDate,
    order: els.placeOrder.value ? Number(els.placeOrder.value) : null,
    notes: els.placeNotes.value.trim(),
    personalNote: els.placePersonalNote.value.trim(),
    sourceLink: els.placeSource.value.trim() || null
  };
  if (pendingLocation && typeof pendingLocation.lat === "number") {
    data.lat = pendingLocation.lat;
    data.lng = pendingLocation.lng;
    data.placeId = pendingLocation.placeId || null;
    data.address = pendingLocation.address || "";
  }

  els.savePlaceBtn.disabled = true;
  try {
    if (editingPlaceId) {
      await updatePlace(tripId, editingPlaceId, data);
    } else {
      await addPlace(tripId, data);
    }
    closeAddPlacePanel();
    resetPlaceForm();
  } catch (err) {
    console.error(err);
    alert("השמירה נכשלה, נסו שוב.");
  } finally {
    els.savePlaceBtn.disabled = false;
  }
}

function startEditPlace(place) {
  editingPlaceId = place.id;
  pendingLocation = typeof place.lat === "number"
    ? { lat: place.lat, lng: place.lng, placeId: place.placeId, address: place.address }
    : null;
  pickingOnMap = false;
  els.pickOnMapBtn.textContent = "סימון ידני על המפה";
  els.candidateList.hidden = true;
  els.placeName.value = place.name || "";
  els.placeNameEn.value = place.nameEn || "";
  els.placeCategory.value = place.category || "other";
  els.placeDate.value = place.date || "";
  els.placeCheckout.value = place.checkOutDate || "";
  els.placeOrder.value = place.order ?? "";
  els.placeNotes.value = place.notes || "";
  els.placePersonalNote.value = place.personalNote || "";
  els.placeSource.value = place.sourceLink || "";
  els.locationStatus.textContent = pendingLocation
    ? "המיקום הקיים נשמר, אפשר לשנות אם צריך"
    : "לא סומן מיקום למקום הזה (אפשר להוסיף עכשיו, לא חובה)";
  updateCheckoutVisibility();
  openAddPlacePanel();
  els.trashPanel.hidden = true;
  els.addPlacePanel.scrollIntoView({ behavior: "smooth" });
}

async function trashThisPlace(place) {
  if (!confirm(`להעביר את "${place.name}" לפח האשפה? אפשר לשחזר משם בכל שלב.`)) return;
  try {
    await trashPlace(tripId, place.id);
  } catch (err) {
    console.error(err);
    alert("הפעולה נכשלה.");
  }
}

// ---------- סינון ומיון ----------

function getActivePlaces() {
  return allPlaces.filter((p) => !p.deleted);
}

function getFilteredPlaces() {
  return getActivePlaces().filter((p) => {
    const catOk = currentCategory === "all" || p.category === currentCategory;
    let dateOk = true;
    if (currentDate === "none") dateOk = !p.date;
    else if (currentDate !== "all") dateOk = occupiedDates(p).includes(currentDate);
    return catOk && dateOk;
  });
}

function computeDisplayList(list) {
  if (currentDate !== "all" && currentDate !== "none") {
    const sorted = [...list].sort((a, b) => {
      const ao = a.order ?? Infinity;
      const bo = b.order ?? Infinity;
      if (ao !== bo) return ao - bo;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });
    return withDistancesToNext(sorted);
  }

  const groups = new Map();
  for (const p of list) {
    const key = p.date || "__none__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const dateKeys = [...groups.keys()].filter((k) => k !== "__none__").sort();
  const orderedKeys = groups.has("__none__") ? [...dateKeys, "__none__"] : dateKeys;

  let result = [];
  for (const key of orderedKeys) {
    const groupSorted = [...groups.get(key)].sort((a, b) => {
      const ao = a.order ?? Infinity;
      const bo = b.order ?? Infinity;
      if (ao !== bo) return ao - bo;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });
    result = result.concat(withDistancesToNext(groupSorted));
  }
  return result;
}

function computeDateList() {
  const fromTrip = trip?.startDate && trip?.endDate ? dateRange(trip.startDate, trip.endDate) : [];
  const fromPlaces = new Set();
  for (const p of getActivePlaces()) {
    for (const d of occupiedDates(p)) fromPlaces.add(d);
  }
  return [...new Set([...fromTrip, ...fromPlaces])].sort();
}

function renderDateTabs() {
  const dates = computeDateList();
  const staticTabs = `
    <span class="day-tab${currentDate === "all" ? " active" : ""}" data-date="all">כל התאריכים</span>
    <span class="day-tab${currentDate === "none" ? " active" : ""}" data-date="none">ללא תאריך</span>
  `;
  const dateTabsHtml = dates
    .map((d) => `<span class="day-tab${d === currentDate ? " active" : ""}" data-date="${d}">${formatDateShort(d)}</span>`)
    .join("");
  els.dateTabs.innerHTML = staticTabs + dateTabsHtml;
}

// ---------- מפה ----------

function markerIcon(category) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 26 36"><path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 23 13 23s13-13.3 13-23C26 5.8 20.2 0 13 0z" fill="${color}"/><circle cx="13" cy="13" r="5.5" fill="#fff"/></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(26, 36),
    anchor: new google.maps.Point(13, 36)
  };
}

function renderMarkers() {
  if (!map) return;
  const list = computeDisplayList(getFilteredPlaces());
  const filteredIds = new Set(list.map((p) => p.id));

  for (const [id, marker] of markers) {
    if (!filteredIds.has(id)) {
      marker.setMap(null);
      markers.delete(id);
    }
  }

  const bounds = new google.maps.LatLngBounds();
  const pathPoints = [];
  let hasAny = false;

  for (const place of list) {
    if (typeof place.lat !== "number" || typeof place.lng !== "number") continue;
    hasAny = true;
    const pos = { lat: place.lat, lng: place.lng };
    bounds.extend(pos);
    pathPoints.push(pos);

    let marker = markers.get(place.id);
    if (!marker) {
      marker = new google.maps.Marker({ position: pos, map, icon: markerIcon(place.category) });
      marker.addListener("click", () => showInfoWindow(marker, place));
      markers.set(place.id, marker);
    } else {
      marker.setPosition(pos);
      marker.setIcon(markerIcon(place.category));
    }
  }

  if (polyline) {
    polyline.setMap(null);
    polyline = null;
  }
  const showRoute = currentDate !== "all" && currentDate !== "none" && pathPoints.length > 1;
  if (showRoute) {
    polyline = new google.maps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: "#0F5C56",
      strokeOpacity: 0.8,
      strokeWeight: 3
    });
    polyline.setMap(map);
  }

  if (hasAny) {
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      if (map.getZoom() > 15) map.setZoom(15);
    });
  }
}

function formatPlaceDateShort(place) {
  if (!place.date) return "—";
  if (place.category === "lodging" && place.checkOutDate && place.checkOutDate > place.date) {
    return `${formatDateShort(place.date)}–${formatDateShort(place.checkOutDate)}`;
  }
  return formatDateShort(place.date);
}

function formatPlaceDateLong(place) {
  if (!place.date) return "ללא תאריך";
  if (place.category === "lodging" && place.checkOutDate && place.checkOutDate > place.date) {
    return `${formatDateLong(place.date)} — ${formatDateLong(place.checkOutDate)}`;
  }
  return formatDateLong(place.date);
}

function showInfoWindow(marker, place) {
  const dateLabel = formatPlaceDateLong(place);
  const nameEnHtml = place.nameEn
    ? `<div dir="ltr" style="color:#4B5563; font-size:12px;">${escapeHtml(place.nameEn)}</div>`
    : "";
  const link = place.sourceLink
    ? `<div><a href="${escapeHtml(place.sourceLink)}" target="_blank" rel="noopener">קישור מקור</a></div>`
    : "";
  const mapsLink = typeof place.lat === "number"
    ? `<div><a href="${googleMapsLink(place)}" target="_blank" rel="noopener">פתיחה ב-Google Maps</a></div>`
    : "";
  const personal = place.personalNote
    ? `<p style="margin:4px 0; font-style:italic;">${escapeHtml(place.personalNote)}</p>`
    : "";
  const distance = place.distanceToNextKm != null
    ? `<div style="color:#4B5563; font-size:12px;">${formatKm(place.distanceToNextKm)} למקום הבא</div>`
    : "";
  const editLink = `<div><a href="#" onclick="window.__editPlaceFromMap('${place.id}'); return false;">עריכת מקום זה</a></div>`;
  infoWindow.setContent(`
    <div style="font-family:'Assistant',sans-serif; max-width:230px;">
      <strong><a href="#" onclick="window.__editPlaceFromMap('${place.id}'); return false;">${escapeHtml(place.name)}</a></strong><br>
      ${nameEnHtml}
      <span style="color:#4B5563;">${CATEGORY_LABELS[place.category] || "אחר"} · ${escapeHtml(dateLabel)}</span>
      <p style="margin:6px 0;">${escapeHtml(place.notes || "")}</p>
      ${personal}
      ${distance}
      ${link}
      ${mapsLink}
      ${editLink}
    </div>
  `);
  infoWindow.open({ anchor: marker, map });
}

// ---------- טבלה ----------

function renderTable() {
  const list = computeDisplayList(getFilteredPlaces());
  if (list.length === 0) {
    els.placesTbody.innerHTML = `<tr><td colspan="9" class="hint">אין מקומות להצגה בסינון הנוכחי.</td></tr>`;
    return;
  }
  els.placesTbody.innerHTML = list
    .map((place) => {
      const nameHe = typeof place.lat === "number"
        ? `<a href="${googleMapsLink(place)}" target="_blank" rel="noopener">${escapeHtml(place.name)}</a>`
        : escapeHtml(place.name);
      const nameEnHtml = place.nameEn ? `<div class="name-en" dir="ltr">${escapeHtml(place.nameEn)}</div>` : "";
      const nameCell = nameHe + nameEnHtml;
      return `
      <tr data-id="${place.id}">
        <td>${place.order ?? "—"}</td>
        <td>${nameCell}</td>
        <td><span class="cat-pill ${place.category}">${CATEGORY_LABELS[place.category] || "אחר"}</span></td>
        <td>${formatPlaceDateShort(place)}</td>
        <td>${escapeHtml(place.notes || "")}</td>
        <td>${escapeHtml(place.personalNote || "")}</td>
        <td>${place.distanceToNextKm != null ? formatKm(place.distanceToNextKm) : "—"}</td>
        <td class="col-narrow">${place.sourceLink ? `<a href="${escapeHtml(place.sourceLink)}" target="_blank" rel="noopener">קישור</a>` : "—"}</td>
        <td class="row-actions">
          <button class="secondary" data-action="edit">עריכה</button>
          <button class="secondary" data-action="delete">מחיקה</button>
        </td>
      </tr>`;
    })
    .join("");

  [...els.placesTbody.querySelectorAll("tr")].forEach((row) => {
    const place = list.find((p) => p.id === row.dataset.id);
    if (!place) return;
    row.querySelector('[data-action="edit"]').addEventListener("click", () => startEditPlace(place));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => trashThisPlace(place));
  });
}

// ---------- הצעות מקומות קרובים ----------

function renderSuggestions(results, category, center) {
  if (results.length === 0) {
    els.suggestionsList.innerHTML = `<p class="hint">לא נמצאו הצעות באזור זה.</p>`;
    return;
  }
  els.suggestionsList.innerHTML = results
    .map((r, i) => {
      const ratingLabel = r.rating ? `⭐ ${r.rating}` : "";
      const distKm = center && typeof r.lat === "number" ? haversineKm(center, r) : null;
      const distLabel = distKm != null ? formatKm(distKm) + " מאיתנו (אווירי)" : "";
      const metaParts = [r.address, ratingLabel, distLabel].filter(Boolean).join(" · ");
      const mapsLinkHtml = typeof r.lat === "number"
        ? `<div><a href="${googleMapsLink(r)}" target="_blank" rel="noopener">לצפייה ב-Google Maps</a></div>`
        : "";
      return `
    <div class="suggestion-card" data-idx="${i}">
      <div>
        <strong>${escapeHtml(r.name)}</strong>
        <div class="meta">${metaParts}</div>
        ${mapsLinkHtml}
      </div>
      <div class="suggestion-actions">
        <button class="secondary" data-action="add">הוספה לטיול</button>
        <button class="icon-btn" data-action="dismiss" title="הסרה מהרשימה">&times;</button>
      </div>
    </div>
  `;
    })
    .join("");

  [...els.suggestionsList.children].forEach((card, i) => {
    card.querySelector('[data-action="add"]').addEventListener("click", () => {
      const r = results[i];
      resetPlaceForm();
      els.placeName.value = r.name;
      els.placeCategory.value = category;
      setPendingLocation(r, "נבחר מתוך ההצעות: " + r.name);
      openAddPlacePanel();
      els.addPlacePanel.scrollIntoView({ behavior: "smooth" });
    });
    card.querySelector('[data-action="dismiss"]').addEventListener("click", () => {
      card.remove();
    });
  });
}

// ---------- הערות כלליות ----------

function renderNotes() {
  if (allNotes.length === 0) {
    els.notesList.innerHTML = `<p class="hint">אין עדיין הערות. אפשר להוסיף הערה למעלה.</p>`;
    return;
  }
  els.notesList.innerHTML = allNotes
    .map(
      (n) => `
    <div class="suggestion-card" data-id="${n.id}">
      <div><p style="margin:0; white-space:pre-wrap;">${escapeHtml(n.text)}</p></div>
      <button class="icon-btn" data-action="delete-note" title="מחיקה">&times;</button>
    </div>
  `
    )
    .join("");

  [...els.notesList.children].forEach((card) => {
    const note = allNotes.find((n) => n.id === card.dataset.id);
    if (!note) return;
    card.querySelector('[data-action="delete-note"]').addEventListener("click", async () => {
      if (!confirm("למחוק את ההערה הזו?")) return;
      try {
        await deleteNote(tripId, note.id);
      } catch (err) {
        console.error(err);
        alert("המחיקה נכשלה.");
      }
    });
  });
}

// ---------- פח אשפה ----------

function getTrashedPlaces() {
  return allPlaces.filter((p) => p.deleted);
}

function renderTrash() {
  const trashed = getTrashedPlaces();
  if (trashed.length === 0) {
    els.trashList.innerHTML = `<p class="hint">פח האשפה ריק.</p>`;
    return;
  }
  els.trashList.innerHTML = trashed
    .map(
      (p) => `
    <div class="suggestion-card" data-id="${p.id}">
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <div class="meta">${CATEGORY_LABELS[p.category] || "אחר"}${p.date ? " · " + formatPlaceDateShort(p) : ""}</div>
      </div>
      <div class="row-actions">
        <button class="secondary" data-action="restore">שחזור</button>
        <button class="secondary" data-action="purge">מחיקה לצמיתות</button>
      </div>
    </div>
  `
    )
    .join("");

  [...els.trashList.children].forEach((card) => {
    const place = trashed.find((p) => p.id === card.dataset.id);
    if (!place) return;
    card.querySelector('[data-action="restore"]').addEventListener("click", async () => {
      try {
        await restorePlace(tripId, place.id);
      } catch (err) {
        console.error(err);
        alert("השחזור נכשל.");
      }
    });
    card.querySelector('[data-action="purge"]').addEventListener("click", async () => {
      if (!confirm(`למחוק לצמיתות את "${place.name}"? לא ניתן לשחזר פעולה זו.`)) return;
      try {
        await purgePlace(tripId, place.id);
      } catch (err) {
        console.error(err);
        alert("המחיקה נכשלה.");
      }
    });
  });
}

init();

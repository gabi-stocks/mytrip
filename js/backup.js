// גיבוי מלא של טיול (כולל כל המקומות) לקובץ JSON שאפשר לשמור במחשב,
// ולשחזר ממנו מאוחר יותר גם אם הטיול כולו נמחק בטעות מ-Firestore.

export function exportTripBackup(trip, places) {
  const payload = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    trip: { name: trip.name, startDate: trip.startDate || null, endDate: trip.endDate || null },
    places: places.map((p) => ({
      name: p.name,
      category: p.category,
      date: p.date || null,
      order: p.order ?? null,
      notes: p.notes || "",
      personalNote: p.personalNote || "",
      lat: p.lat,
      lng: p.lng,
      placeId: p.placeId || null,
      address: p.address || "",
      sourceLink: p.sourceLink || null,
      deleted: !!p.deleted
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.name || "טיול"}-גיבוי.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// קורא קובץ גיבוי שנבחר על ידי המשתמש ומחזיר את התוכן המפוענח
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.trip || !Array.isArray(data.places)) {
          reject(new Error("קובץ הגיבוי לא תקין"));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error("לא ניתן לקרוא את קובץ הגיבוי"));
      }
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsText(file);
  });
}

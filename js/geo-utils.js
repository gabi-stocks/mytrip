// מרחק קווי-אווירי בין שתי נקודות (נוסחת Haversine), בק"מ.
// זהו מרחק "כציפור עפה" ולא מרחק נסיעה בפועל בכביש — טוב מספיק כדי
// לאמוד מרחקים בין תחנות בטיול, אך לא מחליף ניווט אמיתי.
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return R * c;
}

export function formatKm(km) {
  if (km < 10) return km.toFixed(1) + " ק\"מ";
  return Math.round(km) + " ק\"מ";
}

// קישור שפותח את המקום ישירות באפליקציית/אתר Google Maps
export function googleMapsLink(place) {
  const query = encodeURIComponent(`${place.lat},${place.lng}`);
  let url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  if (place.placeId) url += `&query_place_id=${encodeURIComponent(place.placeId)}`;
  return url;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// מוסיף לכל מקום את המרחק (בק"מ) למקום הבא ברשימה שכבר ממוינת
// (למשל: מקומות מאותו תאריך, ממוינים לפי שדה order).
export function withDistancesToNext(sortedPlaces) {
  return sortedPlaces.map((place, i) => {
    const next = sortedPlaces[i + 1];
    if (!next || typeof place.lat !== "number" || typeof next.lat !== "number") {
      return { ...place, distanceToNextKm: null };
    }
    return { ...place, distanceToNextKm: haversineKm(place, next) };
  });
}

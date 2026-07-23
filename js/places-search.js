// עוטף את google.maps.places.PlacesService בהבטחות (Promises) פשוטות לשימוש.
// service צריך מופע map פעיל (דרישה של ה-API הישן, גם אם לא מציגים תוצאה עליו ישירות).

export function searchPlacesByText(map, queryText) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.places.PlacesService(map);
    service.textSearch({ query: queryText }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve((results || []).slice(0, 5).map(toCandidate));
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error("חיפוש המקום נכשל (" + status + ")"));
      }
    });
  });
}

export function searchNearby(map, location, type) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({ location, radius: 4000, type }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve((results || []).slice(0, 10).map(toCandidate));
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error("חיפוש מקומות קרובים נכשל (" + status + ")"));
      }
    });
  });
}

function toCandidate(r) {
  return {
    name: r.name,
    address: r.formatted_address || r.vicinity || "",
    lat: r.geometry.location.lat(),
    lng: r.geometry.location.lng(),
    placeId: r.place_id,
    rating: r.rating || null
  };
}

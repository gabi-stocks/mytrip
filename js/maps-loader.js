// ============================================================
// יש להחליף במפתח ה-API שלך מ-Google Cloud Console.
// יש לוודא ש-Maps JavaScript API וגם Places API מופעלים בפרויקט,
// ומומלץ להגביל את המפתח לדומיין שבו האתר יתארח (למשל GitHub Pages).
// ============================================================
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

let loadingPromise = null;

export function loadGoogleMaps() {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    window.__onGoogleMapsLoaded = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=he&callback=__onGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("טעינת Google Maps נכשלה — בדקו את מפתח ה-API"));
    document.head.appendChild(script);
  });

  return loadingPromise;
}

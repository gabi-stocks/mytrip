// ============================================================
// חיבור ל-Firebase. יש להחליף את הפרטים למטה בפרטי הפרויקט שלך
// (Firebase Console -> Project settings -> General -> Your apps -> SDK setup and configuration)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCERDxgJp_B1HaiprUeCpj3F5zk_X205Es",
  authDomain: "mytrip-3492b.firebaseapp.com",
  projectId: "mytrip-3492b",
  storageBucket: "mytrip-3492b.firebasestorage.app",
  messagingSenderId: "392899895826",
  appId: "1:392899895826:web:bee0b376b4fb2ee91e2ecb",
  measurementId: "G-PH5EHXTE4Y"
};
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// מוודא שיש משתמש מחובר (אנונימי) לפני שקוראים/כותבים ל-Firestore.
// כל מי שנכנס לקישור של טיול מקבל "זהות" אנונימית משלו,
// מספיק כדי לעמוד בכללי האבטחה של Firestore בלי מסך התחברות.
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        signInAnonymously(auth).catch(reject);
      }
    }, reject);
  });
}

// ============================================================
// שער כניסה פשוט לפעולות ניהול (מחיקת/שינוי שם טיול).
// חשוב להבין את המגבלה: זהו קוד שרץ בדפדפן, כל מי שמסתכל בקוד המקור
// של האתר (כמו שאר המפתחות באפליקציה הזו) יכול לראות את ה-PIN.
// זה מספיק כדי למנוע לחיצות בטעות או ארגון מקרי על ידי בני משפחה,
// אבל זו לא הגנה אמיתית מפני מישהו שמנסה לעקוף אותה בכוונה.
// אם צריך הגנה אמיתית, יש לעבור למנגנון התחברות אמיתי (Firebase Auth
// עם משתמש/סיסמה למנהל בלבד, ולהגביל ברמת כללי ה-Firestore Rules).
//
// אפשר (ומומלץ) להחליף את הקוד הבא למספר/מילה אחרים:
const ADMIN_PIN = "2027";

const SESSION_KEY = "tripPlannerAdminUnlocked";

export function isAdminUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === "yes";
}

// מציג בקשה לקוד מנהל אם עוד לא אושרה בסשן הנוכחי. מחזיר true אם אפשר להמשיך.
export function requireAdmin() {
  if (isAdminUnlocked()) return true;
  const entered = prompt("פעולת ניהול טיולים — נא להזין קוד מנהל:");
  if (entered === null) return false; // המשתמש ביטל
  if (entered === ADMIN_PIN) {
    sessionStorage.setItem(SESSION_KEY, "yes");
    return true;
  }
  alert("קוד שגוי.");
  return false;
}

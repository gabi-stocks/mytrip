import { db } from "./firebase-init.js";
import {
  collection, addDoc, doc, getDoc, onSnapshot,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Trips ----------

export async function createTrip(name, startDate = null, endDate = null) {
  const ref = await addDoc(collection(db, "trips"), {
    name,
    startDate: startDate || null,
    endDate: endDate || null,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export function listenToTrips(callback) {
  const q = query(collection(db, "trips"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function getTrip(tripId) {
  const snap = await getDoc(doc(db, "trips", tripId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Places (subcollection per trip) ----------
// שימו לב: listenToPlaces מחזיר גם פריטים שסומנו כ"נמחקו" (deleted:true) —
// אלה הפריטים בפח האשפה. מסכי התצוגה הרגילים אחראים לסנן אותם החוצה,
// כדי שיהיה אפשר לשחזר מקום שנמחק בטעות.

export function listenToPlaces(tripId, callback) {
  const q = query(collection(db, "trips", tripId, "places"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addPlace(tripId, place) {
  return addDoc(collection(db, "trips", tripId, "places"), {
    deleted: false,
    deletedAt: null,
    ...place,
    createdAt: serverTimestamp()
  });
}

export async function updatePlace(tripId, placeId, changes) {
  return updateDoc(doc(db, "trips", tripId, "places", placeId), changes);
}

// מחיקה "רכה" — מעביר לפח האשפה במקום למחוק לצמיתות
export async function trashPlace(tripId, placeId) {
  return updateDoc(doc(db, "trips", tripId, "places", placeId), {
    deleted: true,
    deletedAt: serverTimestamp()
  });
}

export async function restorePlace(tripId, placeId) {
  return updateDoc(doc(db, "trips", tripId, "places", placeId), {
    deleted: false,
    deletedAt: null
  });
}

// מחיקה לצמיתות מהפח — בלתי הפיכה
export async function purgePlace(tripId, placeId) {
  return deleteDoc(doc(db, "trips", tripId, "places", placeId));
}

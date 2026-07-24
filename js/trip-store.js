import { db } from "./firebase-init.js";
import {
  collection, addDoc, doc, getDoc, getDocs, onSnapshot,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------- Trips ----------

export async function createTrip(name, startDate = null, endDate = null) {
  const ref = await addDoc(collection(db, "trips"), {
    name,
    startDate: startDate || null,
    endDate: endDate || null,
    deleted: false,
    deletedAt: null,
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

export async function renameTrip(tripId, newName) {
  return updateDoc(doc(db, "trips", tripId), { name: newName });
}

export async function trashTrip(tripId) {
  return updateDoc(doc(db, "trips", tripId), {
    deleted: true,
    deletedAt: serverTimestamp()
  });
}

export async function restoreTrip(tripId) {
  return updateDoc(doc(db, "trips", tripId), {
    deleted: false,
    deletedAt: null
  });
}

export async function purgeTrip(tripId) {
  const placesSnap = await getDocs(collection(db, "trips", tripId, "places"));
  await Promise.all(placesSnap.docs.map((d) => deleteDoc(d.ref)));
  return deleteDoc(doc(db, "trips", tripId));
}

// ---------- Places (subcollection per trip) ----------

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

export async function purgePlace(tripId, placeId) {
  return deleteDoc(doc(db, "trips", tripId, "places", placeId));
}

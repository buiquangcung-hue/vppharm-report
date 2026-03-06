import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "provinces";

export async function getActiveProvinces() {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("active", "==", true),
    orderBy("name", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getAllProvinces() {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function createProvince(payload) {
  const data = {
    name: String(payload?.name || "").trim(),
    code: String(payload?.code || "").trim().toUpperCase(),
    active: payload?.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, COLLECTION_NAME), data);
}

export async function updateProvince(provinceId, payload) {
  const ref = doc(db, COLLECTION_NAME, provinceId);

  await updateDoc(ref, {
    ...(payload?.name !== undefined ? { name: String(payload.name).trim() } : {}),
    ...(payload?.code !== undefined ? { code: String(payload.code).trim().toUpperCase() } : {}),
    ...(payload?.active !== undefined ? { active: Boolean(payload.active) } : {}),
    updatedAt: serverTimestamp(),
  });
}
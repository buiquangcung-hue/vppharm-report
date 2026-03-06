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

const COLLECTION_NAME = "products";

export async function getActiveProducts() {
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

export async function getAllProducts() {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function createProduct(payload) {
  const data = {
    name: String(payload?.name || "").trim(),
    unit: String(payload?.unit || "").trim(),
    price: Number(payload?.price || 0),
    active: payload?.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, COLLECTION_NAME), data);
}

export async function updateProduct(productId, payload) {
  const ref = doc(db, COLLECTION_NAME, productId);

  await updateDoc(ref, {
    ...(payload?.name !== undefined ? { name: String(payload.name).trim() } : {}),
    ...(payload?.unit !== undefined ? { unit: String(payload.unit).trim() } : {}),
    ...(payload?.price !== undefined ? { price: Number(payload.price || 0) } : {}),
    ...(payload?.active !== undefined ? { active: Boolean(payload.active) } : {}),
    updatedAt: serverTimestamp(),
  });
}
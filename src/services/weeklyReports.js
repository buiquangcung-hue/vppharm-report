import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "weekly_reports";

export async function createWeeklyReport(payload) {
  const data = {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, COLLECTION_NAME), data);
}

export async function getReportsByOwner(ownerUid) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getAllReports() {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { ROLES } from "../utils/roles";

const COLLECTION_NAME = "users";

export async function getUserProfile(uid) {
  if (!uid) return null;

  const ref = doc(db, COLLECTION_NAME, uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function getAllUsers() {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getPendingUsers() {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("approved", "==", false)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getDirectors() {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("role", "==", ROLES.DIRECTOR),
    where("approved", "==", true),
    where("blocked", "==", false)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getManagedEmployees(managerUid) {
  if (!managerUid) return [];

  const q = query(
    collection(db, COLLECTION_NAME),
    where("role", "==", ROLES.USER),
    where("approved", "==", true),
    where("blocked", "==", false),
    where("managerUid", "==", managerUid)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function approveUser(userId) {
  const ref = doc(db, COLLECTION_NAME, userId);
  await updateDoc(ref, {
    approved: true,
    role: ROLES.USER,
    status: "active",
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function blockUser(userId) {
  const ref = doc(db, COLLECTION_NAME, userId);
  await updateDoc(ref, {
    blocked: true,
    status: "blocked",
    updatedAt: serverTimestamp(),
  });
}

export async function unblockUser(userId) {
  const ref = doc(db, COLLECTION_NAME, userId);
  await updateDoc(ref, {
    blocked: false,
    status: "active",
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserRoleAndManager(userId, payload) {
  const ref = doc(db, COLLECTION_NAME, userId);

  await updateDoc(ref, {
    ...(payload?.role !== undefined ? { role: payload.role } : {}),
    ...(payload?.status !== undefined ? { status: payload.status } : {}),
    ...(payload?.managerUid !== undefined ? { managerUid: payload.managerUid || "" } : {}),
    ...(payload?.managerName !== undefined ? { managerName: payload.managerName || "" } : {}),
    ...(payload?.approved !== undefined ? { approved: Boolean(payload.approved) } : {}),
    ...(payload?.blocked !== undefined ? { blocked: Boolean(payload.blocked) } : {}),
    updatedAt: serverTimestamp(),
  });
}
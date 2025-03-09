import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { UserData } from "./firebase";
import { auth } from "./firebase";

export async function updateUserProfile(data: Partial<UserData>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const userDocRef = doc(db, "users", user.uid);

  // Convert Date objects to Firestore Timestamps
  const firestoreData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      firestoreData[key] = Timestamp.fromDate(value);
    } else if (value === null) {
      firestoreData[key] = null;
    } else {
      firestoreData[key] = value;
    }
  }

  await updateDoc(userDocRef, firestoreData);
}
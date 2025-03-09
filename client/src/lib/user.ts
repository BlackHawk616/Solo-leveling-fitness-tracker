import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserData } from "./firebase";
import { auth } from "./firebase";

export async function updateUserProfile(data: Partial<UserData>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const userDocRef = doc(db, "users", user.uid);
  await updateDoc(userDocRef, data);
}

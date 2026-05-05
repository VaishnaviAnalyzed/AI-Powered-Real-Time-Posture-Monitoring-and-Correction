import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import app from "./firebase";

const db = getFirestore(app);

export const saveUserData = async (uid, data) => {
    await setDoc(doc(db, "users", uid), data);
};

export const getUserData = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
};

export default db;
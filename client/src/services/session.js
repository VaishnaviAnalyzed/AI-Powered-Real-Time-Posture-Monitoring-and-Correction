import { db } from "./firebase";
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp
} from "firebase/firestore";

export const saveSession = async (uid, data) => {
    const ref = collection(db, "users", uid, "sessions");

    await addDoc(ref, {
        totalTime: data.totalTime,
        goodPostureTime: data.goodPostureTime,
        score: data.score,
        exercise: data.exercise || "squat",
        createdAt: serverTimestamp(),
    });
};

export const getSessions = async (uid) => {
    const ref = collection(db, "users", uid, "sessions");
    const q = query(ref, orderBy("createdAt", "desc"), limit(8));

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    }));
};
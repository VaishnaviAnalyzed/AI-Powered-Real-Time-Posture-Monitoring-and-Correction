import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB445O14Cse8haO0itCEjpHrzQBk-4WEy0",
    authDomain: "posturepal-94ac5.firebaseapp.com",
    projectId: "posturepal-94ac5",
    storageBucket: "posturepal-94ac5.firebasestorage.app",
    messagingSenderId: "1028355041648",
    appId: "1:1028355041648:web:c87ee6deb6ced103d147b5"
};

const app = initializeApp(firebaseConfig);

// 🔥 ADD THIS
export const db = getFirestore(app);

export default app;
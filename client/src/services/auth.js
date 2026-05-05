import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import app from "./firebase";

const auth = getAuth(app);

export const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

export const signup = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export default auth;
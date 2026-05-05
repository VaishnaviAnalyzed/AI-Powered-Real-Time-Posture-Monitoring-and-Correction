import { createContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../services/auth";
import { getUserData } from "../services/db";

export const UserContext = createContext();

function UserProvider({ children }) {
    const [user,     setUser    ] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading,  setLoading ] = useState(true);

    const fetchUserData = useCallback(async (firebaseUser) => {
        if (!firebaseUser) return;
        try {
            const data = await getUserData(firebaseUser.uid);
            setUserData(data);
        } catch (err) {
            console.error("Firestore read error:", err);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                await fetchUserData(firebaseUser);
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [fetchUserData]);

    // Re-fetch if userData is missing but user is logged in (post-onboarding navigation)
    useEffect(() => {
        if (user && !userData && !loading) {
            fetchUserData(user);
        }
    }, [user, userData, loading, fetchUserData]);

    return (
        <UserContext.Provider value={{ user, userData, loading, refetchUserData: () => fetchUserData(user) }}>
            {children}
        </UserContext.Provider>
    );
}

export default UserProvider;
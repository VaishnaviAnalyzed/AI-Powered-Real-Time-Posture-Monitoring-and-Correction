import { useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import Container from "../components/layout/Container";
import { UserContext } from "../context/UserContext";

function GoalPage() {
    const { userData, setUserData } = useContext(UserContext);
    const [goal, setGoal] = useState("");
    const navigate = useNavigate();
    const handleFinish = () => {
        const finalData = {
            ...userData,
            goal
        };

        setUserData(finalData);

        console.log("COMPLETE USER PROFILE:", finalData);

        navigate("/dashboard");
    };
    return (
        <Container>
            <h2>Step 3: Select Your Goal</h2>

            <button onClick={() => setGoal("Posture Correction")}>
                Posture Correction
            </button><br /><br />

            <button onClick={() => setGoal("Strength Building")}>
                Strength Building
            </button><br /><br />

            <button onClick={() => setGoal("Flexibility")}>
                Flexibility
            </button><br /><br />

            <button onClick={() => setGoal("Endurance")}>
                Endurance
            </button><br /><br />

            <p>Selected Goal: {goal}</p>

            <button onClick={handleFinish}>
                Finish
            </button>
        </Container>
    );
}

export default GoalPage;
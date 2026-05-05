import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Container from "../components/layout/Container";
import { UserContext } from "../context/UserContext";

function PhysicalStatsPage() {
    const navigate = useNavigate();
    const { userData, setUserData } = useContext(UserContext);

    const [height, setHeight] = useState(userData.height);
    const [weight, setWeight] = useState(userData.weight);

    const handleNext = () => {
        const updatedData = {
            ...userData,
            height,
            weight
        };

        setUserData(updatedData);

        console.log("FINAL USER DATA:", updatedData);

        navigate("/goal");
    };

    return (
        <Container>
            <h2>Step 2: Physical Stats</h2>

            <input
                placeholder="Enter your height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
            /><br /><br />

            <input
                placeholder="Enter your weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
            /><br /><br />

            <button onClick={handleNext}>
                Next
            </button>
        </Container>
    );
}

export default PhysicalStatsPage;
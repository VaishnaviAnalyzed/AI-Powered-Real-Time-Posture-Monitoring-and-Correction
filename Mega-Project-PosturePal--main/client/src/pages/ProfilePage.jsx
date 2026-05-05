import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Container from "../components/layout/Container";
import { UserContext } from "../context/UserContext";

function ProfilePage() {
  const navigate = useNavigate();
  const { userData, setUserData } = useContext(UserContext);

  const [name, setName] = useState(userData.name);
  const [age, setAge] = useState(userData.age);
  const [gender, setGender] = useState(userData.gender);

  const handleNext = () => {
    setUserData({
      ...userData,
      name,
      age,
      gender
    });

    navigate("/physical");
  };

  return (
    <Container>
      <h2 className="gradient-text">Step 1: Basic Information</h2>

      <div className="card" style={{ marginTop: "20px" }}>
        <input
          className="input"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="input"
          placeholder="Enter your age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <input
          className="input"
          placeholder="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        />

        <div style={{ marginTop: "15px" }}>
          <button onClick={handleNext}>
            Next →
          </button>
        </div>
      </div>
    </Container>
  );
}

export default ProfilePage;
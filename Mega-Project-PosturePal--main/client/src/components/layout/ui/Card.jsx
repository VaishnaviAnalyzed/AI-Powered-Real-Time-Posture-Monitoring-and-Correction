function Card({ children }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(0,255,255,0.15)",
      borderRadius: "20px",
      padding: "20px",
      backdropFilter: "blur(10px)"
    }}>
      {children}
    </div>
  );
}

export default Card;
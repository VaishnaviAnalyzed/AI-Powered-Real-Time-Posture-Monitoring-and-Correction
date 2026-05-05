function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "linear-gradient(90deg, #00d4ff, #3b82f6)",
        borderRadius: "12px",
        padding: "12px 20px",
        color: "white",
        border: "none",
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

export default Button;
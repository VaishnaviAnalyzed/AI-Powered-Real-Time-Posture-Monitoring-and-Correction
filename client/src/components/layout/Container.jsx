function Container({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      padding: "20px",
      display: "flex",
      justifyContent: "center"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "1100px"
      }}>
        {children}
      </div>
    </div>
  );
}

export default Container;
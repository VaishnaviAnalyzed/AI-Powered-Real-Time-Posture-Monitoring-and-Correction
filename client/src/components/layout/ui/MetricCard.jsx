import Card from "./Card";

function MetricCard({ title, value }) {
  return (
    <Card>
      <h4 style={{ opacity: 0.6 }}>{title}</h4>
      <h2>{value}</h2>
    </Card>
  );
}

export default MetricCard;
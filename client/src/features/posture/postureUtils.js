export function formatConfidence(score) {
    return (score * 100).toFixed(1) + "%";
}
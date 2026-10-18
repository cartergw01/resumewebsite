// The three numbers from Carter's 886 work (see PRODUCT.md, "Content truths").
// The Work stop and /work both read them from here, so the two never drift.
const numbers = [
  { value: "350+", label: "startups screened" },
  { value: "100+", label: "through diligence" },
  { value: "15+", label: "batch teams supported" },
];

export default function WorkNumbers({ className }: { className?: string }) {
  return (
    <ul className={className} aria-label="886 Studios in numbers">
      {numbers.map((item) => (
        <li key={item.value}><strong>{item.value}</strong> {item.label}</li>
      ))}
    </ul>
  );
}

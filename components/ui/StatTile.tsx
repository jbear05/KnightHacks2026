// One figure in a facts strip: value (number-xl) over a mono label. Render inside a <dl>.
export function StatTile({ value, label, tone = "text-fg" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="order-2 text-fg-subtle type-label">{label}</dt>
      <dd className={`order-1 type-number-xl whitespace-nowrap ${tone}`}>{value}</dd>
    </div>
  );
}

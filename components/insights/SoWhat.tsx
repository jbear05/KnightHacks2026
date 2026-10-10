// Yellow "So what" pill plus the one-sentence takeaway under every Insights chart.
export function SoWhat({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex w-full items-start gap-2.5">
      <span className="shrink-0 rounded-pill border-[1.5px] border-line-strong bg-spot-tint px-2 py-[3px] text-fg type-label">
        So what
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-extrabold leading-[22px] text-fg">{children}</span>
    </p>
  );
}

/** White sticker card with the Insights header row (heading-lg title, mono label on the right). */
export function ChartCard({
  id,
  title,
  meta,
  className = "",
  children,
}: {
  id: string;
  title: string;
  meta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`relative flex min-w-0 flex-col gap-3.5 bg-surface px-5 py-6 sticker sm:px-7 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="type-heading-lg">
          {title}
        </h2>
        <p className="text-fg-subtle type-label">{meta}</p>
      </div>
      {children}
    </section>
  );
}

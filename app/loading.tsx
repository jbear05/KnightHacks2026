// Shown while a page waits on the API.
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10" role="status" aria-live="polite">
      <p className="text-fg-muted type-body">Loading mission records…</p>
      <div aria-hidden className="h-40 animate-pulse rounded-card bg-raised motion-reduce:animate-none" />
    </div>
  );
}

import { Glyph } from "./Glyph";

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1368px] flex-col gap-6 px-4 pt-8 pb-12 md:px-12 md:pt-10">
      <h1 className="type-heading-lg">{title}</h1>
      <div className="flex items-start gap-3 bg-surface px-6 py-5 sticker">
        <Glyph name="bloom" size={32} />
        <div className="flex flex-col gap-1 type-body">{children}</div>
      </div>
    </div>
  );
}

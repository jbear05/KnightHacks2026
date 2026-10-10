import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

// Figma "Button": 2px ink outline, 12px corners, hard 4px ink shadow, 40px tall.
// Primary (and a pressed secondary) uses SPOT yellow with dark text.
export function Button({ variant = "secondary", className = "", ...props }: Props) {
  const filled = variant === "primary" || props["aria-pressed"] === true;
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-button border-2 border-line-strong px-3 py-2 whitespace-nowrap shadow-sticker transition-[transform,box-shadow] type-button active:translate-y-[2px] active:shadow-[0_2px_0_0_#1f3b24] disabled:cursor-wait ${
        filled ? "bg-spot text-on-spot" : "bg-surface text-fg hover:bg-spot-tint"
      } ${className}`}
    />
  );
}

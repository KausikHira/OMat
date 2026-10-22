import Link from "next/link";

type WordmarkProps = {
  size?: "sm" | "lg";
  className?: string;
};

export function Wordmark({ size = "sm", className = "" }: WordmarkProps) {
  const wordmark = size === "lg" ? "text-[clamp(4.5rem,15vw,8.5rem)]" : "text-[1.45rem]";
  const dot = size === "lg" ? "size-[0.12em]" : "size-[0.1em]";

  return (
    <Link
      href="/"
      aria-label="omat home"
      className={`inline-flex items-baseline gap-[0.07em] font-display font-normal leading-none tracking-[-0.045em] text-ink ${wordmark} ${className}`}
    >
      <span>omat</span>
      <span aria-hidden="true" className={`inline-block rounded-full bg-accent ${dot}`} />
    </Link>
  );
}

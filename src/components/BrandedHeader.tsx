// Listen Labs branded header: `Listen Labs / Project Title` centered at the
// top of the page. Spec: 12px Inter 400, top center, 24px from top, two-tone
// secondary/primary color split, no letter-spacing.

type Props = {
  /** Right side of the slash — Title Case. */
  title: string;
  /** Render as a positioned overlay (default) or as a flow element. */
  variant?: "fixed" | "inline";
};

export default function BrandedHeader({ title, variant = "fixed" }: Props) {
  const base =
    "text-center text-[12px] leading-4 font-normal pointer-events-none select-none";
  const positioned =
    variant === "fixed"
      ? "fixed top-6 left-0 right-0 z-30"
      : "block pt-6 pb-4";

  return (
    <div className={`${base} ${positioned}`}>
      <span className="text-content-secondary">Listen Labs /</span>{" "}
      <span className="text-content-primary">{title}</span>
    </div>
  );
}

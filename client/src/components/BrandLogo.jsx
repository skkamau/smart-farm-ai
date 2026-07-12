const sizes = {
  small: { image: "h-8 w-8", title: "text-base" },
  medium: { image: "h-12 w-12", title: "text-xl" },
  large: { image: "h-24 w-24", title: "text-3xl" }
};

export default function BrandLogo({ size = "medium", iconOnly = false, onDark = false, className = "" }) {
  const selected = sizes[size] || sizes.medium;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Smart Farm AI">
      <picture className="shrink-0">
        <source srcSet="/brand/smart-farm-mark.svg" type="image/svg+xml" />
        <img className={`${selected.image} block object-contain`} src="/brand/smart-farm-mark.png" alt="Smart Farm AI" width="96" height="96" />
      </picture>
      {!iconOnly && (
        <span className={`${selected.title} whitespace-nowrap font-black ${onDark ? "text-white" : "text-farm-950 dark:text-white"}`}>
          Smart Farm <span className="text-lime-500">AI</span>
        </span>
      )}
    </span>
  );
}

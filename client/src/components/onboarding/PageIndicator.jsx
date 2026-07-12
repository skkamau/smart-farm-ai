export default function PageIndicator({ count, current, onSelect }) {
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label={`Onboarding page ${current + 1} of ${count}`}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-farm-700 ${index === current ? "w-7 bg-farm-700 dark:bg-lime-400" : "w-2.5 bg-farm-200 dark:bg-farm-700"}`}
          onClick={() => onSelect(index)}
          aria-label={`Go to introduction page ${index + 1}`}
          aria-current={index === current ? "step" : undefined}
        />
      ))}
    </div>
  );
}

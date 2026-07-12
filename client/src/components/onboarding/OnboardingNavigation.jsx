import { ArrowLeft, ArrowRight } from "lucide-react";

export default function OnboardingNavigation({ current, count, onBack, onNext, onComplete }) {
  const last = current === count - 1;
  return (
    <div className={`grid gap-3 ${current === 0 ? "grid-cols-1" : "grid-cols-2"}`}>
      {current > 0 && <button type="button" className="btn-muted min-h-12" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</button>}
      <button type="button" className="btn-primary min-h-12" onClick={last ? onComplete : onNext}>
        {last ? "Get Started" : "Next"}{!last && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import OnboardingNavigation from "../components/onboarding/OnboardingNavigation";
import OnboardingSlide from "../components/onboarding/OnboardingSlide";
import PageIndicator from "../components/onboarding/PageIndicator";
import { useAuth } from "../context/AuthContext";
import { completeOnboarding, hasCompletedOnboarding, onboardingSlideKey, sessionGet, sessionSet } from "../utils/onboarding";

const slides = [
  {
    title: "1. Manage Your Farm",
    description: "Keep your animals, crops, inventory and farm activities organized in one place.",
    image: "/onboarding/manage-farm.svg",
    alt: "Farmer using a tablet beside livestock, crops, and a barn"
  },
  {
    title: "2. Track Health and Finance",
    description: "Record animal health, medicines, veterinary costs, income, expenses and inventory accurately.",
    image: "/onboarding/health-finance.svg",
    alt: "Veterinary clipboard, medicine bottle, finance chart, and coins"
  },
  {
    title: "3. Make Better Decisions",
    description: "Use farm records, reminders, weather information and insights to plan ahead.",
    image: "/onboarding/better-decisions.svg",
    alt: "Mobile farm dashboard with analytics, weather, and reminders"
  }
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replay = searchParams.get("replay") === "1";
  const [current, setCurrent] = useState(() => {
    if (replay) return 0;
    const saved = Number(sessionGet(onboardingSlideKey));
    return Number.isInteger(saved) && saved >= 0 && saved < slides.length ? saved : 0;
  });
  const [transitioning, setTransitioning] = useState(false);
  const headingRef = useRef(null);
  const touchStart = useRef(null);

  useEffect(() => {
    if (hasCompletedOnboarding() && !replay) navigate(user ? "/" : "/login", { replace: true });
  }, [replay, user, navigate]);

  const goTo = useCallback((index) => {
    if (transitioning || index < 0 || index >= slides.length || index === current) return;
    setTransitioning(true);
    setCurrent(index);
    sessionSet(onboardingSlideKey, String(index));
    window.setTimeout(() => {
      setTransitioning(false);
      headingRef.current?.focus();
    }, window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : 220);
  }, [current, transitioning]);

  const finish = useCallback(() => {
    if (transitioning) return;
    completeOnboarding();
    navigate(user ? "/" : "/login", { replace: true });
  }, [navigate, transitioning, user]);

  useEffect(() => {
    function keydown(event) {
      if (event.key === "ArrowRight") goTo(current + 1);
      if (event.key === "ArrowLeft") goTo(current - 1);
      if (event.key === "Escape") finish();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [current, goTo, finish]);

  function swipeEnd(clientX) {
    if (touchStart.current === null) return;
    const delta = clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 55) return;
    if (delta < 0) goTo(current + 1);
    else goTo(current - 1);
  }

  return (
    <main className="onboarding-page">
      <div
        className="onboarding-shell"
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => swipeEnd(event.changedTouches[0].clientX)}
        onPointerDown={(event) => { if (event.pointerType !== "touch") touchStart.current = event.clientX; }}
        onPointerUp={(event) => { if (event.pointerType !== "touch") swipeEnd(event.clientX); }}
      >
        <header className="flex items-center justify-between gap-4">
          <BrandLogo size="small" />
          <button type="button" className="rounded-md px-3 py-2 text-sm font-bold text-farm-800 hover:bg-field-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-farm-700 dark:text-lime-300 dark:hover:bg-farm-900" onClick={finish}>Skip</button>
        </header>

        <div key={current} className="onboarding-slide-transition">
          <OnboardingSlide ref={headingRef} slide={slides[current]} index={current} />
        </div>

        <div className="mt-auto space-y-6 pt-5">
          <PageIndicator count={slides.length} current={current} onSelect={goTo} />
          <OnboardingNavigation current={current} count={slides.length} onBack={() => goTo(current - 1)} onNext={() => goTo(current + 1)} onComplete={finish} />
        </div>
      </div>
    </main>
  );
}

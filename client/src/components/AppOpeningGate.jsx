import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasCompletedOnboarding, sessionGet, sessionSet, splashSessionKey } from "../utils/onboarding";
import SplashScreen from "./SplashScreen";

const onboardingEntryPaths = new Set(["/", "/login", "/signup", "/forgot-password"]);

export default function AppOpeningGate({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(() => sessionGet(splashSessionKey) === "true");

  useEffect(() => {
    if (loading || splashDone) return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const timer = window.setTimeout(() => {
      sessionSet(splashSessionKey, "true");
      setSplashDone(true);
    }, reducedMotion ? 250 : 1700);
    return () => window.clearTimeout(timer);
  }, [loading, splashDone]);

  if (loading || !splashDone) return <SplashScreen />;
  if (!user && !hasCompletedOnboarding() && onboardingEntryPaths.has(location.pathname)) return <Navigate to="/onboarding" replace />;
  return children;
}

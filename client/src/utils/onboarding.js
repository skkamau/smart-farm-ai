import { storageGet, storageSet } from "./storage";

export const onboardingCompletedKey = "smartFarmOnboardingCompleted";
export const onboardingSlideKey = "smartFarmOnboardingSlide";
export const splashSessionKey = "smartFarmSplashShown";

export function hasCompletedOnboarding() {
  return storageGet(onboardingCompletedKey) === "true";
}

export function completeOnboarding() {
  storageSet(onboardingCompletedKey, "true");
  sessionRemove(onboardingSlideKey);
}

export function sessionGet(key) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function sessionSet(key, value) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private browsing may disable session storage.
  }
}

export function sessionRemove(key) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.removeItem(key);
  } catch {
    // Keep navigation usable when storage is unavailable.
  }
}

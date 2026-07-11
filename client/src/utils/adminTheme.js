import { useEffect } from "react";

export function useAdminLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => root.classList.toggle("dark", wasDark);
  }, []);
}

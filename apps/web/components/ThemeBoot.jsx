"use client";

import { useEffect } from "react";

export function ThemeBoot() {
  useEffect(() => {
    const stored = localStorage.getItem("opendeploy_theme");
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = stored || preferred;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, []);

  return null;
}

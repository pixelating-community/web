"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.error("SW registration failed:", err));
      };

      window.addEventListener("load", onLoad);

      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function SiteVisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent || null
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/site-visit", blob);
      return;
    }

    fetch("/api/site-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch((error) => {
      console.error("Site visit tracking failed:", error);
    });
  }, [pathname, searchParams]);

  return null;
}

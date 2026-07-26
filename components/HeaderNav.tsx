"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const primaryItems = [
  { href: "/check", label: "Fitment Checker" },
  { href: "/builds", label: "Verified Builds" }
];

const exploreItems = [
  { href: "/", label: "Home" },
  { href: "/submit-build", label: "Submit Build" },
  { href: "/account", label: "Account" }
];

export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <nav className="nav-links" aria-label="Primary">
      <div className="nav-primary-tabs">
        {primaryItems.map((item) => (
          <Link
            key={item.href}
            className="nav-primary-tab"
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="nav-menu" ref={navRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="nav-menu-button"
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
          Explore
        </button>
        {open ? (
          <div className="nav-menu-panel" role="menu">
            {exploreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

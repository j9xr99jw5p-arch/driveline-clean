"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const menuItems = [
  { href: "/check", label: "Fitment Checker" },
  { href: "/builds", label: "Verified Builds" },
  { href: "/parts", label: "Parts" },
  { href: "/pricing", label: "Pricing" },
  { href: "/submit-build", label: "Submit Build" }
];

export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
      <div className="nav-menu" ref={navRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="nav-menu-button"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
          Explore
        </button>
        {open ? (
          <div className="nav-menu-panel" role="menu">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} role="menuitem" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <Link href="/account">Account</Link>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { label: "Overview", href: "/admin" },
  { label: "Visitor Tracking", href: "/admin/visitors" },
  { label: "Parts Inventory", href: "/admin/parts" },
  { label: "Manage Packs", href: "/admin/packs" },
  { label: "Pending Builds", href: "/admin/builds" }
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav-links" aria-label="Admin navigation">
      {adminLinks.map((link) => {
        const active = link.href === "/admin"
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "active" : ""}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

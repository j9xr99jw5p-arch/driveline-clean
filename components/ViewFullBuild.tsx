"use client";

import { useState } from "react";

export function ViewFullBuild({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="view-full-build">
      <button className="button" type="button" onClick={() => setOpen((current) => !current)}>
        {open ? "Hide full build" : "View full build"}
      </button>
      {open ? <div className="view-full-build-details">{children}</div> : null}
    </div>
  );
}

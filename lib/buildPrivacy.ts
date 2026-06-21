import type { VerifiedBuild } from "@/lib/types";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const privateNotePrefixes = [
  "contact email:",
  "owner email:",
  "email:",
  "owner:",
  "owner name:",
  "submitter:",
  "submitter name:",
  "social handle:"
];

export function getPublicSocialHandle(build: Pick<VerifiedBuild, "owner_name" | "notes">) {
  const notesHandle = extractSocialHandle(build.notes);
  if (notesHandle) return notesHandle;

  const ownerName = build.owner_name?.trim();
  if (ownerName?.startsWith("@") && !emailPattern.test(ownerName)) return ownerName;

  return null;
}

export function sanitizePublicBuildNotes(notes: string | null) {
  if (!notes) return null;

  const publicLines = notes
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      const normalized = trimmed.toLowerCase();

      if (emailPattern.test(trimmed)) return false;
      return !privateNotePrefixes.some((prefix) => normalized.startsWith(prefix));
    });

  const sanitized = publicLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return sanitized || null;
}

function extractSocialHandle(notes: string | null) {
  if (!notes) return null;

  const line = notes
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.toLowerCase().startsWith("social handle:"));

  const handle = line?.replace(/^social handle:\s*/i, "").trim();
  return handle && !emailPattern.test(handle) ? handle : null;
}

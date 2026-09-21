export type BuildNoteSection = {
  heading: string | null;
  items: string[];
};

const BUILD_LIST_HEADINGS = [
  "Lighting / Electrical",
  "Recovery / Overland",
  "Armor / Exterior",
  "Wheels & Tires",
  "Wheels and Tires",
  "Favorite modifications",
  "Lighting upgrades",
  "Full build list",
  "Other modifications",
  "How it was made to fit",
  "Wheel setup",
  "Tire setup",
  "Suspension",
  "Fitment",
  "Interior",
  "Lighting",
  "Electrical",
  "Recovery",
  "Overland",
  "Armor",
  "Exterior",
  "Drivetrain",
  "Engine",
  "Bumpers",
  "Bumper",
  "Audio",
  "Bed"
] as const;

const HEADING_ALIASES: Record<string, string> = {
  "wheels and tires": "Wheels & Tires"
};

const headingPattern = new RegExp(
  `(^|\\s)(${[...BUILD_LIST_HEADINGS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")})(?:\\s*-\\s+|\\s*:\\s*|\\s*$)`,
  "g"
);

export function parseBuildNoteSections(text: string): BuildNoteSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const structured = looksStructured(trimmed) ? parseStructuredLines(trimmed) : [];
  if (structured.some((section) => section.items.length > 1 || section.heading)) {
    return structured;
  }

  return mergeSections(parseFlattenedDump(trimmed));
}

export function notesLookStructured(notes: string | null) {
  if (!notes?.trim()) return false;
  const lines = notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletCount = lines.filter((line) => /^[-•*]/.test(line)).length;
  return bulletCount >= 3 && lines.some((line) => isHeadingLine(line));
}

export function buildNotesFormatPrompt(notes: string) {
  return `Rewrite this truck build list into clean sections with headings and bullet items.

Keep every real part, brand, size, and fitment detail. Do not invent items. Do not mention owner names, emails, or social handles. Use headings like Suspension, Wheels & Tires, Fitment, Recovery / Overland, Armor / Exterior, Lighting / Electrical, and Interior when they fit. Omit empty headings.

Return plain text in this exact shape:
Heading
- item
- item

Heading
- item

Raw notes:
${notes}`;
}

export function mergePrivateNoteLines(originalNotes: string, formattedPublicNotes: string) {
  const privateLines = originalNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const normalized = line.toLowerCase();
      return (
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line) ||
        /^(contact email|owner email|email|owner|owner name|submitter|submitter name|social handle):/i.test(normalized)
      );
    });

  return [formattedPublicNotes.trim(), ...privateLines].filter(Boolean).join("\n\n");
}

function parseStructuredLines(text: string): BuildNoteSection[] {
  const sections: BuildNoteSection[] = [];
  let current: BuildNoteSection = { heading: null, items: [] };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeadingLine(line)) {
      pushSection(sections, current);
      current = { heading: canonicalHeading(line.replace(/:$/, "")), items: [] };
      continue;
    }

    if (/^[-•*]/.test(line)) {
      current.items.push(cleanItem(line.replace(/^[-•*]\s*/, "")));
      continue;
    }

    const labeled = line.match(/^([^:]{2,50}):\s*(.+)$/);
    if (labeled && !looksLikeSentenceLabel(labeled[1])) {
      pushSection(sections, current);
      current = { heading: canonicalHeading(labeled[1]), items: splitItems(labeled[2]) };
      continue;
    }

    current.items.push(cleanItem(line));
  }

  pushSection(sections, current);
  return mergeSections(sections);
}

function parseFlattenedDump(text: string): BuildNoteSection[] {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 1) {
    return blocks.flatMap((block) => parseOneFlattenedBlock(block));
  }

  return parseOneFlattenedBlock(text);
}

function parseOneFlattenedBlock(block: string): BuildNoteSection[] {
  const labeled = block.match(/^([^:\n]{2,50}):\s*([\s\S]+)$/);
  if (labeled && !looksLikeSentenceLabel(labeled[1])) {
    const heading = canonicalHeading(labeled[1]);
    const body = labeled[2].trim();
    const nested = parseByKnownHeadings(body);
    if (nested.length > 1 || nested[0]?.heading) {
      return nested.map((section) => (
        section.heading ? section : { heading, items: section.items }
      ));
    }

    return [{ heading, items: splitItems(body) }];
  }

  return parseByKnownHeadings(block);
}

function parseByKnownHeadings(text: string): BuildNoteSection[] {
  const matches = [...text.matchAll(headingPattern)];
  if (!matches.length) {
    const items = splitItems(text);
    return items.length ? [{ heading: null, items }] : [];
  }

  const sections: BuildNoteSection[] = [];
  const firstIndex = matches[0]?.index ?? 0;
  const intro = text.slice(0, firstIndex).trim();
  if (intro) sections.push({ heading: null, items: splitItems(intro) });

  matches.forEach((match, index) => {
    const heading = canonicalHeading(match[2] ?? "");
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1]?.index ?? text.length : text.length;
    const body = text.slice(start, end).trim();
    const items = splitItems(body);
    if (heading || items.length) sections.push({ heading, items });
  });

  return sections;
}

function splitItems(value: string) {
  return value
    .split(/\s+-\s+/)
    .map(cleanItem)
    .filter(Boolean);
}

function looksStructured(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length >= 3 && lines.some((line) => /^[-•*]/.test(line) || isHeadingLine(line));
}

function isHeadingLine(line: string) {
  const normalized = line.replace(/:$/, "").trim().toLowerCase();
  if (BUILD_LIST_HEADINGS.some((heading) => heading.toLowerCase() === normalized)) return true;
  return /^[A-Za-z][A-Za-z0-9 &/]{1,32}$/.test(line.replace(/:$/, "").trim()) && !line.includes(",");
}

function looksLikeSentenceLabel(label: string) {
  return label.trim().split(/\s+/).length > 6;
}

function canonicalHeading(value: string) {
  const normalized = value.trim().replace(/:$/, "");
  const alias = HEADING_ALIASES[normalized.toLowerCase()];
  if (alias) return alias;
  return BUILD_LIST_HEADINGS.find((heading) => heading.toLowerCase() === normalized.toLowerCase()) ?? normalized;
}

function cleanItem(value: string) {
  return value.replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim();
}

function pushSection(sections: BuildNoteSection[], section: BuildNoteSection) {
  const items = section.items.filter(Boolean);
  if (!section.heading && !items.length) return;
  sections.push({ heading: section.heading, items });
}

function mergeSections(sections: BuildNoteSection[]) {
  return sections.filter((section) => section.heading || section.items.length);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

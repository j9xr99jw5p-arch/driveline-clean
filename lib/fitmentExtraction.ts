// Turns the free-text answers on /check into the numeric inputs the
// deterministic fitment engine needs. A regex pass runs first so the form still
// works without an AI key; the AI pass in /api/fitment/extract fills the gaps.

export type ExtractedSpecs = {
  currentTireSize?: string;
  tireSize?: string;
  wheelDiameter?: number;
  wheelWidth?: number;
  wheelOffset?: number;
  liftHeight?: number;
  useCase?: string;
  rearLoad?: string;
  cab?: string;
  bed?: string;
};

export type SpecField = keyof ExtractedSpecs;

export type FitmentDescription = {
  year: string;
  make: string;
  model: string;
  trim: string;
  plannedChanges: string;
  currentSetup: string;
  usage: string;
  buildGoals: string;
  extraNotes: string;
};

export type ExtractionResult = {
  specs: ExtractedSpecs;
  // Fields the engine cannot run without, that neither pass could determine.
  missing: SpecField[];
  // Plain-language note about what was understood, shown above the confirm step.
  interpretation: string | null;
  usedAi: boolean;
};

export const requiredSpecFields: SpecField[] = [
  "tireSize",
  "wheelDiameter",
  "wheelWidth",
  "wheelOffset",
  "liftHeight"
];

export const emptyDescription: FitmentDescription = {
  year: "",
  make: "",
  model: "",
  trim: "",
  plannedChanges: "",
  currentSetup: "",
  usage: "",
  buildGoals: "",
  extraNotes: ""
};

export const useCaseOptions = [
  { value: "daily", label: "Daily driver" },
  { value: "mixed", label: "Mixed street and trail" },
  { value: "off-road", label: "Trail focused" }
];

export const rearLoadOptions = [
  { value: "normal", label: "No regular rear weight" },
  { value: "sometimes-heavy", label: "Occasional camping or gear load" },
  { value: "constant-heavy", label: "Constant rack, drawers, bumper, or tools" }
];

export const cabOptions = ["Access Cab", "Double Cab"];
export const bedOptions = ["5 ft", "6 ft"];

export function specFieldLabel(field: SpecField) {
  const labels: Record<SpecField, string> = {
    currentTireSize: "Current tire size",
    tireSize: "Desired tire size",
    wheelDiameter: "Wheel diameter",
    wheelWidth: "Wheel width",
    wheelOffset: "Wheel offset",
    liftHeight: "Lift height",
    useCase: "Use case",
    rearLoad: "Rear weight",
    cab: "Cab",
    bed: "Bed"
  };

  return labels[field];
}

// Matches 285/70R17, 285/70/17, 35x12.50R17, and 33X12.5R17.
const metricTire = /\b(\d{3})\s*\/\s*(\d{2})\s*[rR/]\s*(\d{2})\b/;
const flotationTire = /\b(\d{2}(?:\.\d+)?)\s*[xX]\s*(\d{1,2}(?:\.\d+)?)\s*[rR]?\s*(\d{2})\b/;

export function findTireSize(text: string) {
  const metric = text.match(metricTire);
  if (metric) return `${metric[1]}/${metric[2]}R${metric[3]}`;

  const flotation = text.match(flotationTire);
  if (flotation) return `${flotation[1]}x${flotation[2]}R${flotation[3]}`;

  return undefined;
}

// Matches 17x8.5 / 17 x 9 but not tire sizes, which carry a third number.
export function findWheelSize(text: string) {
  const matches = [...text.matchAll(/\b(1[4-9]|2[0-4])\s*[xX]\s*(\d{1,2}(?:\.\d+)?)\b(?!\s*[rR]?\s*\d{2}\b)/g)];

  for (const match of matches) {
    const diameter = Number(match[1]);
    const width = Number(match[2]);
    if (width >= 6 && width <= 14) return { wheelDiameter: diameter, wheelWidth: width };
  }

  return null;
}

// Handles "-12 offset", "offset -12", "+25mm offset", and "offset of 0mm".
export function findWheelOffset(text: string) {
  const explicit =
    text.match(/offset\s*(?:of\s*)?([+-]?\d{1,2})\s*(?:mm)?/i) ??
    text.match(/([+-]?\d{1,2})\s*(?:mm)?\s*offset/i);

  if (explicit) {
    const value = Number(explicit[1].replace("+", ""));
    if (Number.isFinite(value) && value >= -80 && value <= 80) return value;
  }

  if (/\bzero\s+offset\b/i.test(text)) return 0;
  return undefined;
}

export function findLiftHeight(text: string) {
  const explicit = text.match(/(\d(?:\.\d)?)\s*(?:"|''|in\b|inch(?:es)?\b)\s*(?:of\s*)?(?:lift|lifted|suspension\s*lift)/i)
    ?? text.match(/lift(?:ed)?\s*(?:of\s*)?(\d(?:\.\d)?)\s*(?:"|''|in\b|inch(?:es)?\b)?/i);

  if (explicit) {
    const value = Number(explicit[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 10) return value;
  }

  if (/\blevel(?:ing|ed)?\s*(?:kit)?\b/i.test(text)) return 2;
  if (/\bstock\s*(?:height|suspension)\b|\bno\s*lift\b/i.test(text)) return 0;
  return undefined;
}

export function findUseCase(text: string) {
  const trail = /(rock\s*crawl|trail|off[-\s]?road|overland|wheeling|desert|dune|forest\s*road|fire\s*road|gravel|dirt\s*road|backcountry|camp|mud|sand)/i;
  const street = /(daily|commut|street|highway|pavement|grocery|school|errand|road\s*trip)/i;

  if (trail.test(text)) return street.test(text) ? "mixed" : "off-road";
  if (street.test(text)) return "daily";
  return undefined;
}

export function findRearLoad(text: string) {
  if (/\b(rtt|roof\s*top\s*tent|drawer|bumper|camper|tool\s*box|constant|always\s*loaded|full\s*time)\b/i.test(text)) {
    return "constant-heavy";
  }

  if (/\b(camp|gear|haul|tow|weekend|sometimes|occasional)\b/i.test(text)) return "sometimes-heavy";
  return undefined;
}

export function findCab(text: string) {
  if (/\baccess\s*cab\b|\bextended\s*cab\b|\bxtracab\b/i.test(text)) return "Access Cab";
  if (/\bdouble\s*cab\b|\bcrew\s*cab\b|\bquad\s*cab\b/i.test(text)) return "Double Cab";
  return undefined;
}

export function findBed(text: string) {
  if (/\b6\s*(?:\.\d)?\s*(?:ft|foot|feet|')\b|\blong\s*bed\b/i.test(text)) return "6 ft";
  if (/\b5\s*(?:\.\d)?\s*(?:ft|foot|feet|')\b|\bshort\s*bed\b/i.test(text)) return "5 ft";
  return undefined;
}

// Reads each answer in the context it was given: tires named under "what you
// want to do" are the target, tires named under "what you already have" are
// the current setup.
export function extractSpecsLocally(description: FitmentDescription): ExtractedSpecs {
  const planned = `${description.plannedChanges} ${description.buildGoals}`.trim();
  const current = description.currentSetup.trim();
  const usage = `${description.usage} ${description.buildGoals} ${description.extraNotes}`.trim();
  const everything = [
    description.plannedChanges,
    description.currentSetup,
    description.usage,
    description.buildGoals,
    description.extraNotes,
    description.trim
  ].filter(Boolean).join(" ");

  const plannedWheel = findWheelSize(planned);
  const currentWheel = findWheelSize(current);
  const wheel = plannedWheel ?? currentWheel ?? findWheelSize(everything);

  const specs: ExtractedSpecs = {
    tireSize: findTireSize(planned) ?? findTireSize(everything),
    currentTireSize: findTireSize(current),
    wheelDiameter: wheel?.wheelDiameter,
    wheelWidth: wheel?.wheelWidth,
    wheelOffset: findWheelOffset(planned) ?? findWheelOffset(everything),
    liftHeight: findLiftHeight(planned) ?? findLiftHeight(everything),
    useCase: findUseCase(usage) ?? findUseCase(everything),
    rearLoad: findRearLoad(usage) ?? findRearLoad(everything),
    cab: findCab(everything),
    bed: findBed(everything)
  };

  // A tire size implies its wheel diameter when no wheel was named separately.
  if (!specs.wheelDiameter && specs.tireSize) {
    const metric = specs.tireSize.match(/R(\d{2})$/i);
    if (metric) specs.wheelDiameter = Number(metric[1]);
  }

  return stripEmpty(specs);
}

export function mergeSpecs(base: ExtractedSpecs, overrides: ExtractedSpecs): ExtractedSpecs {
  return stripEmpty({ ...base, ...stripEmpty(overrides) });
}

export function findMissingSpecs(specs: ExtractedSpecs): SpecField[] {
  return requiredSpecFields.filter((field) => {
    const value = specs[field];
    return value === undefined || value === null || value === "";
  });
}

function stripEmpty(specs: ExtractedSpecs): ExtractedSpecs {
  const result: ExtractedSpecs = {};

  for (const [key, value] of Object.entries(specs) as Array<[SpecField, unknown]>) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    Object.assign(result, { [key]: value });
  }

  return result;
}

export function isTacomaCalibrated(make: string, model: string) {
  return make.trim().toLowerCase() === "toyota" && model.trim().toLowerCase() === "tacoma";
}

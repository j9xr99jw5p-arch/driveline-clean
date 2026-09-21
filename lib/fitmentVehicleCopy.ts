export function formatTruckName(input: {
  year?: number | string;
  make?: string;
  model?: string;
}) {
  return [input.year, input.make, input.model]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ") || "this truck";
}

export function isToyotaTacoma(make?: string, model?: string) {
  return make?.trim().toLowerCase() === "toyota" && model?.trim().toLowerCase() === "tacoma";
}

export function rewriteWrongTruckName(
  text: string,
  input: { year?: number | string; make?: string; model?: string }
) {
  if (!text || isToyotaTacoma(input.make, input.model)) return text;

  const name = formatTruckName(input);
  return text
    .replace(/\bToyota Tacomas\b/gi, `${name}s`)
    .replace(/\bToyota Tacoma\b/gi, name)
    .replace(/\bTacomas\b/gi, `${name}s`)
    .replace(/\bTacoma\b/gi, name);
}

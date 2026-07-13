const BLOCKED_PATTERNS = [
  /\b(?:porn|porno|nudes?|onlyfans|escort|prostytucj|sekskamera)\b/i,
  /\b(?:zgwalce|zgwalcic|zabije cie|zabic cie|groze ci)\b/i,
  /\b(?:nazi|heil hitler)\b/i
];

function normalizeForModeration(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findModerationViolation(value: string) {
  const normalized = normalizeForModeration(value);
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))
    ? "Ta tre\u015b\u0107 mo\u017ce narusza\u0107 zasady spo\u0142eczno\u015bci."
    : null;
}

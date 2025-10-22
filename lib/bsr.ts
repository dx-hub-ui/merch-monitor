export function parseBsrFilters(minValue: string | null, maxValue: string | null) {
  const parse = (value: string | null) => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) return null;
    return parsed;
  };

  let min = parse(minValue);
  let max = parse(maxValue);

  if (min != null && max != null && min > max) {
    [min, max] = [max, min];
  }

  return { min, max } as const;
}

export function nextCode(prefix: string, codes: Array<string | null | undefined>, width = 3): string {
  const expression = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  const greatest = codes.reduce((maximum, code) => {
    const match = code?.match(expression);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${prefix}-${String(greatest + 1).padStart(width, '0')}`;
}

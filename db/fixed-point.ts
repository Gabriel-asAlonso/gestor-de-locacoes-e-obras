/** Exact decimal boundary: API/model values are decimal strings, SQL stores integer hundredths. */
export function toHundredths(value: string, precision = 15): bigint {
  if (typeof value !== 'string' || !/^-?\d+(\.\d{1,2})?$/.test(value)) {
    throw new TypeError('Use uma string decimal, com ponto e no máximo duas casas; não use number.');
  }
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const scaled = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (scaled > 10n ** BigInt(precision) - 1n) throw new RangeError('Precisão decimal excedida.');
  return negative ? -scaled : scaled;
}

export function fromHundredths(value: number | bigint): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError('Inteiro inexato recebido do banco.');
  const integer = BigInt(value);
  const absolute = integer < 0n ? -integer : integer;
  return `${integer < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

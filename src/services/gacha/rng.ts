/** Криптографически стойкий RNG (0 <= n < 1). */
export function secureRandomUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / (0xffffffff + 1);
}

export interface RandomSource {
  next(): number;
}

export const secureRandom: RandomSource = { next: secureRandomUnit };

/** Детерминированный RNG для тестов (LCG). */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

export function pickWeighted<T>(items: { item: T; weight: number }[], roll: number): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) throw new Error('pickWeighted: нулевой суммарный вес');
  let acc = 0;
  for (const { item, weight } of items) {
    acc += weight / total;
    if (roll < acc) return item;
  }
  return items[items.length - 1]!.item;
}

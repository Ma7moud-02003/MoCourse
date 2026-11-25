// Deterministic shuffle: the same seed always gives the same order, so a student who leaves
// and comes back sees the questions and choices in the same order, with nothing stored.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stableShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// mixes two ids into one seed (attempt id + question id)
export const seedOf = (a: number, b = 0) => (Math.imul(a, 2654435761) ^ Math.imul(b + 1, 40503)) >>> 0;

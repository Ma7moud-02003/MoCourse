import { stableShuffle, seedOf } from './stable-shuffle';

describe('stableShuffle', () => {
  const items = Array.from({ length: 12 }, (_, i) => i + 1);
  it('same seed gives the same order every time, and keeps every item', () => {
    const a = stableShuffle(items, seedOf(42));
    expect(stableShuffle(items, seedOf(42))).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
  it('different attempts get different orders (and the input is not changed)', () => {
    const copy = [...items];
    const orders = new Set([1, 2, 3, 4, 5, 6].map((id) => stableShuffle(items, seedOf(id)).join(',')));
    expect(orders.size).toBeGreaterThan(1);
    expect(items).toEqual(copy);
  });
  it('seeds differ per question', () => {
    expect(seedOf(7, 1)).not.toBe(seedOf(7, 2));
  });
});

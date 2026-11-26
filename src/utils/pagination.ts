export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 50;

/** page starts at 1 (default 1); limit default 10, at most 50. Bad or missing values fall back to the defaults. */
export function parsePaging(page?: unknown, limit?: unknown, defaultLimit = DEFAULT_PAGE_LIMIT) {
  const p = Math.floor(Number(page));
  const l = Math.floor(Number(limit));
  const safePage = Number.isFinite(p) && p >= 1 ? p : 1;
  const take = Number.isFinite(l) && l >= 1 ? Math.min(l, MAX_PAGE_LIMIT) : defaultLimit;
  return { page: safePage, limit: take, skip: (safePage - 1) * take };
}

/** Same response shape the notifications list already uses. */
export function pageResult<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

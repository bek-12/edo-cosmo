/**
 * Returns calendar-based { start, end } for a given period.
 * end is EXCLUSIVE (use createdAt: { gte: start, lt: end }).
 *
 * weekly  → Monday 00:00 … next Monday 00:00 (current ISO week)
 * monthly → 1st of current month 00:00 … 1st of next month 00:00
 * yearly  → Jan 1st 00:00 … Jan 1st of next year 00:00
 */
export function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === "weekly") {
    const dow       = now.getDay();                      // 0=Sun … 6=Sat
    const toMonday  = dow === 0 ? 6 : dow - 1;          // days since Monday
    const monday    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - toMonday);
    monday.setHours(0, 0, 0, 0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { start: monday, end: nextMonday };
  }

  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  // yearly
  const start = new Date(now.getFullYear(), 0, 1);
  const end   = new Date(now.getFullYear() + 1, 0, 1);
  return { start, end };
}

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const jakartaDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Calendar date (YYYY-MM-DD) of an instant as seen in Jakarta (UTC+7). The app
 * is Jakarta-scoped, so day boundaries must be computed in that zone rather than
 * the browser's local zone.
 */
export function jakartaDateKey(value: Date | string): string {
  return jakartaDateFormat.format(typeof value === "string" ? new Date(value) : value);
}

/** Today's Jakarta calendar date (YYYY-MM-DD) for date-input minimums and "today" filters. */
export function todayInJakarta(): string {
  return jakartaDateKey(new Date());
}

/**
 * EARLIEST date a booking may start (SOP: pengajuan maksimal H-1). Shifting the
 * Jakarta calendar day (not the browser day) keeps the boundary correct for
 * users whose device clock sits outside UTC+7.
 */
export function tomorrowInJakarta(): string {
  const tomorrow = new Date(`${todayInJakarta()}T00:00:00+07:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return jakartaDateKey(tomorrow);
}

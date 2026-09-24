import { describe, expect, it } from "vitest";
import { jakartaDateKey, todayInJakarta, tomorrowInJakarta } from "./datetime";

describe("tomorrowInJakarta", () => {
  it("advances exactly one Jakarta calendar day", () => {
    const tomorrow = new Date(`${todayInJakarta()}T12:00:00+07:00`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    expect(tomorrowInJakarta()).toBe(jakartaDateKey(tomorrow));
  });

  it("sits after today so the H-1 SOP rejects same-day bookings", () => {
    expect(tomorrowInJakarta() > todayInJakarta()).toBe(true);
  });

  it("returns a value accepted by a date input", () => {
    expect(tomorrowInJakarta()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

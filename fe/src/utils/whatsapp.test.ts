import { describe, expect, it } from "vitest";
import { getWhatsAppUrl } from "./whatsapp";

describe("getWhatsAppUrl", () => {
  it("normalizes common Indonesian phone formats", () => {
    expect(getWhatsAppUrl("0812 3456-7890")).toBe("https://wa.me/6281234567890");
    expect(getWhatsAppUrl("+62 812-3456-7890")).toBe("https://wa.me/6281234567890");
    expect(getWhatsAppUrl("81234567890")).toBe("https://wa.me/6281234567890");
  });

  it("rejects values that cannot become a valid Indonesian number", () => {
    expect(getWhatsAppUrl("javascript:alert(1)")).toBeNull();
    expect(getWhatsAppUrl("123")).toBeNull();
  });
});

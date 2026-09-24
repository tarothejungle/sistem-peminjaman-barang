import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { BookingStatus } from "../../../types";
import { bookingReportFilename, bookingReportParams, reportErrorMessage } from "./useBookingReport";

describe("bookingReportParams", () => {
  it("omits filters the operator left empty", () => {
    expect(bookingReportParams({ status: "", from: "", to: "" })).toEqual({});
  });

  it("forwards the filters the server validates", () => {
    expect(bookingReportParams({ status: BookingStatus.COMPLETED, from: "2026-09-01", to: "2026-09-30" })).toEqual({
      status: "COMPLETED",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
});

describe("bookingReportFilename", () => {
  it("uses the requested range as a readable fallback name", () => {
    expect(bookingReportFilename("xlsx", { from: "2026-09-01", to: "2026-09-30" })).toBe("laporan-peminjaman-2026-09-01-2026-09-30.xlsx");
  });

  it("falls back to the bare report name when no range is set", () => {
    expect(bookingReportFilename("pdf", {})).toBe("laporan-peminjaman.pdf");
  });
});

describe("reportErrorMessage", () => {
  function blobError(data: Blob, status: number): unknown {
    const error = new AxiosError("Request failed");
    error.response = { data, status, statusText: "", headers: {}, config: {} } as never;
    return error;
  }

  it("reads the JSON error envelope back out of a blob response", async () => {
    const data = new Blob([JSON.stringify({ error: { message: "Format laporan tidak dikenal" } })], { type: "application/json" });

    await expect(reportErrorMessage(blobError(data, 400))).resolves.toBe("Format laporan tidak dikenal");
  });

  it("returns null when the blob body carries no envelope", async () => {
    await expect(reportErrorMessage(blobError(new Blob(["<html>boom</html>"]), 500))).resolves.toBeNull();
  });
});

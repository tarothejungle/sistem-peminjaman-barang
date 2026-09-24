// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingStatus } from "../../../types";
import { BookingStatusBadge } from "./BookingStatusBadge";

describe("BookingStatusBadge", () => {
  it("names the acting approver role: Kasubag, not Kabag", () => {
    render(<BookingStatusBadge status={BookingStatus.PENDING_KABAG_APPROVAL} />);

    expect(screen.getByText("Menunggu Persetujuan Kasubag")).toBeInTheDocument();
  });
});

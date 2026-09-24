// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Room } from "../../../types";
import { ManageRoomsPage } from "./ManageRoomsPage";

const room: Room = {
  id: "room-1",
  name: "Ruang Rapat Utama",
  capacity: 30,
  location: "Lantai 3",
  facilities: ["AC"],
  isActive: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  imageUrl: "/rooms/room-1/image",
};

const idleMutation = { isPending: false, error: null, mutateAsync: vi.fn(), reset: vi.fn() };

vi.mock("../../rooms/api/useRooms", () => ({
  useRooms: () => ({ data: [room], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateRoom: () => idleMutation,
  useUpdateRoom: () => idleMutation,
  useDeactivateRoom: () => idleMutation,
}));

vi.mock("../../../components/common/ResourceImage", () => ({
  ResourceImage: ({ alt, className }: { alt: string; className: string }) => <img alt={alt} className={className} src="blob:room" />,
}));

afterEach(cleanup);

describe("ManageRoomsPage image preview", () => {
  it("opens the uploaded room photo from the thumbnail", () => {
    render(<ManageRoomsPage />);

    const previewButton = screen.getByRole("button", { name: "Lihat foto Ruang Rapat Utama" });
    expect(previewButton).toHaveClass("group");

    fireEvent.click(previewButton);

    expect(screen.getByRole("dialog", { name: "Foto Ruang Rapat Utama" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto Ruang Rapat Utama ukuran penuh" })).toBeInTheDocument();
  });
});

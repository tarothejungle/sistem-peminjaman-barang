// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DisplayRoom, RoomDisplayData } from "../api/useRoomDisplay";
import { RoomDisplayPage } from "./RoomDisplayPage";

const useRoomDisplay = vi.hoisted(() => vi.fn());

vi.mock("../api/useRoomDisplay", () => ({ useRoomDisplay }));

function room(overrides: Partial<DisplayRoom> & Pick<DisplayRoom, "id" | "name">): DisplayRoom {
  return {
    location: "Lantai 7A",
    capacity: 20,
    state: "AVAILABLE",
    currentBooking: null,
    nextBooking: null,
    todayBookings: [],
    ...overrides,
  };
}

/** Asia/Jakarta is UTC+7, so 01:00Z renders as 08:00 and 03:00Z as 10:00. */
const budgetMeeting = { workUnit: "Bagian Perencanaan", startTime: "2026-09-03T01:00:00.000Z", endTime: "2026-09-03T03:00:00.000Z", purpose: "Rapat Anggaran" };

const data: RoomDisplayData = {
  checkedAt: "2026-09-03T02:00:00.000Z",
  timezone: "Asia/Jakarta",
  summary: { total: 6, available: 6, inUse: 0, scheduled: 1 },
  rooms: [
    room({ id: "room-b", name: "Ruang Rapat B", capacity: 20, location: "Lantai 7A" }),
    room({ id: "room-c", name: "Ruang Rapat C", capacity: 25, location: "Lantai 7B" }),
    room({ id: "room-d", name: "Ruang Rapat D", capacity: 15, location: "Lantai 7B" }),
    room({ id: "room-i", name: "Ruang Rapat Inovation", capacity: 12, location: "Lantai 7A" }),
    room({ id: "room-u", name: "Ruang Rapat Utama", capacity: 40, location: "Lantai 7A" }),
    room({ id: "room-t", name: "Ruang Tamu", capacity: 10, location: "Lantai 7A" }),
  ],
};

const busy: RoomDisplayData = {
  ...data,
  summary: { total: 6, available: 5, inUse: 1, scheduled: 1 },
  rooms: [
    room({
      id: "room-u",
      name: "Ruang Rapat Utama",
      capacity: 40,
      state: "IN_USE",
      currentBooking: budgetMeeting,
      nextBooking: { workUnit: "Bagian Keuangan", startTime: "2026-09-03T06:00:00.000Z", endTime: "2026-09-03T07:00:00.000Z", purpose: "Evaluasi Kinerja dan pembahasan rencana tindak lanjut lintas unit kerja secara menyeluruh" },
      todayBookings: [
        budgetMeeting,
        { workUnit: "Bagian Keuangan", startTime: "2026-09-03T06:00:00.000Z", endTime: "2026-09-03T07:00:00.000Z", purpose: "Evaluasi Kinerja dan pembahasan rencana tindak lanjut lintas unit kerja secara menyeluruh" },
        { workUnit: "Bagian Organisasi", startTime: "2026-09-03T08:00:00.000Z", endTime: "2026-09-03T09:00:00.000Z", purpose: "Koordinasi Bagian dengan keterangan rapat yang cukup panjang dan harus tampil dalam beberapa baris" },
        { workUnit: "Bagian Hukum", startTime: "2026-09-03T10:00:00.000Z", endTime: "2026-09-03T11:00:00.000Z", purpose: "Pembahasan Kontrak" },
      ],
    }),
  ],
};

function dataWithRooms(count: number): RoomDisplayData {
  const rooms = Array.from({ length: count }, (_, index) => room({
    id: `room-${index + 1}`,
    name: `Ruang ${index + 1}`,
  }));

  return {
    ...data,
    summary: { total: count, available: count, inUse: 0, scheduled: 0 },
    rooms,
  };
}

const MESSAGE_UNAVAILABLE = "Informasi ruang belum tersedia. Sistem mencoba menghubungkan kembali.";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  localStorage.removeItem("room-display-theme");
});

describe("RoomDisplayPage", () => {
  it("shows the loading message while the first fetch has produced neither data nor an error", () => {
    // The webOS failure mode: `new AbortController()` threw before react-query could
    // dispatch, so status stayed pending with fetchStatus idle — isLoading is false too.
    useRoomDisplay.mockReturnValue({ data: undefined, isError: false, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getByText("Memuat informasi ruang rapat...")).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE_UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("shows the unavailable message only when the query failed with no cached data", () => {
    useRoomDisplay.mockReturnValue({ data: undefined, isError: true, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getByText(MESSAGE_UNAVAILABLE)).toBeInTheDocument();
  });

  it("renders the header, the four metrics and all six rooms", () => {
    useRoomDisplay.mockReturnValue({ data, isError: false, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getByRole("heading", { level: 1, name: "SISTEM INFORMASI RUANG RAPAT BINWAS" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Logo Kementerian Ketenagakerjaan" }).getAttribute("src")).toMatch(/\/logo-kemnaker-biru\.png$/);
    // id-ID formats time as "09.00.00"; the board must show HH:mm:ss.
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();

    // Scoped by class: "Tersedia" and "Sedang Dipakai" are also card badge text.
    for (const [label, value] of [["Total Ruang", "6"], ["Tersedia", "6"], ["Sedang Dipakai", "0"], ["Beragenda", "1"]] as const) {
      expect(screen.getByText(label, { selector: ".room-display__metric-label" }).previousSibling).toHaveTextContent(value);
    }

    const names = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Ruang Rapat B", "Ruang Rapat C", "Ruang Rapat D", "Ruang Rapat Inovation", "Ruang Rapat Utama", "Ruang Tamu"]);
    expect(screen.getByText("Kapasitas 40 orang")).toBeInTheDocument();
    expect(screen.getAllByText("Lantai 7B")).toHaveLength(2);
    expect(screen.getAllByText("Tersedia")).toHaveLength(7); // one metric label + six badges
    expect(screen.getAllByText("Siap Digunakan")).toHaveLength(6);
  });

  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 3, 1],
    [4, 2, 2],
    [6, 3, 2],
    [7, 4, 2],
    [8, 4, 2],
  ])("uses an adaptive %i-room grid with %i columns and %i rows", (count, columns, rows) => {
    useRoomDisplay.mockReturnValue({ data: dataWithRooms(count), isError: false, isLoading: false });
    const view = render(<RoomDisplayPage />);
    const board = view.container.querySelector(".room-display__board");

    expect(board).toHaveClass(`room-display__board--columns-${columns}`);
    expect(board).toHaveClass(`room-display__board--rows-${rows}`);
    expect(board?.children).toHaveLength(count);
    expect(view.container.querySelector(".room-display__pager")).not.toBeInTheDocument();
  });

  it("rotates groups of eight rooms and resets when the room list changes", () => {
    vi.useFakeTimers();
    const firstData = dataWithRooms(9);
    useRoomDisplay.mockReturnValue({ data: firstData, isError: false, isLoading: false });
    const view = render(<RoomDisplayPage />);
    const board = view.container.querySelector(".room-display__board");

    expect(board).toHaveClass("room-display__board--columns-4", "room-display__board--rows-2");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(screen.getByText("Halaman 1 dari 2")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Ruang 9" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.getByText("Halaman 2 dari 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Ruang 9" })).toBeInTheDocument();
    expect(board).toHaveClass("room-display__board--columns-4", "room-display__board--rows-2");

    useRoomDisplay.mockReturnValue({ data: dataWithRooms(10), isError: false, isLoading: false });
    view.rerender(<RoomDisplayPage />);

    expect(screen.getByText("Halaman 1 dari 2")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
  });

  it("keeps both pages full when sixteen rooms are available", () => {
    vi.useFakeTimers();
    useRoomDisplay.mockReturnValue({ data: dataWithRooms(16), isError: false, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(screen.getByText("Halaman 1 dari 2")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(screen.getByRole("heading", { level: 2, name: "Ruang 16" })).toBeInTheDocument();
    expect(screen.getByText("Halaman 2 dari 2")).toBeInTheDocument();
  });

  it("shows unit names and complete wrapped descriptions for two agenda rows", () => {
    useRoomDisplay.mockReturnValue({ data: busy, isError: false, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getByText("Sedang Dipakai", { selector: ".room-display__badge" })).toBeInTheDocument();
    expect(screen.getByRole("list").children).toHaveLength(3); // 2 agenda rows + the counter
    expect(screen.getByText("+2 agenda lainnya")).toBeInTheDocument();
    expect(screen.queryByText("Pembahasan Kontrak")).not.toBeInTheDocument();
    // currentBooking arrives as a separate object, so it can only be matched by value.
    expect(screen.getByText("Rapat Anggaran").closest("li")).toHaveClass("room-display__agenda-row--active");
    expect(screen.getByText("Bagian Perencanaan")).toHaveClass("room-display__agenda-unit--active");
    expect(screen.getByText("Bagian Keuangan")).not.toHaveClass("room-display__agenda-unit--active");
    const description = screen.getByText("Evaluasi Kinerja dan pembahasan rencana tindak lanjut lintas unit kerja secara menyeluruh");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("room-display__agenda-purpose");
    expect(description).not.toHaveClass("truncate");
    // withColons normalises the id-ID dot separator to the requested HH:mm form.
    expect(screen.getByText("08:00 - 10:00")).toBeInTheDocument();
    expect(screen.getByText("13:00 - 14:00")).toBeInTheDocument();
  });

  it("keeps the last known board on screen when a poll fails", () => {
    useRoomDisplay.mockReturnValue({ data, isError: true, isLoading: false });
    render(<RoomDisplayPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Ruang Rapat Utama" })).toBeInTheDocument();
    expect(screen.getByText("Koneksi terputus, menampilkan data terakhir")).toBeInTheDocument();
    expect(screen.getByText("Pembaruan terakhir 09:00 WIB")).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE_UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("locks the document to a single non-scrolling viewport only while mounted", () => {
    useRoomDisplay.mockReturnValue({ data, isError: false, isLoading: false });
    const view = render(<RoomDisplayPage />);

    expect(document.documentElement).toHaveClass("room-display-lock");
    expect(document.body).toHaveClass("room-display-lock");

    // The stylesheet is global once its lazy chunk loads, so the lock must not
    // outlive the board and leave the rest of the SPA unscrollable.
    view.unmount();
    expect(document.documentElement).not.toHaveClass("room-display-lock");
    expect(document.body).not.toHaveClass("room-display-lock");
  });

  it("switches board theme without requesting fullscreen and persists the choice", () => {
    const requestFullscreen = vi.fn();
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    useRoomDisplay.mockReturnValue({ data, isError: false, isLoading: false });
    const view = render(<RoomDisplayPage />);

    // Light is the project-wide default, so an unset panel opens light.
    expect(view.container.querySelector(".room-display")).toHaveClass("room-display--light");

    fireEvent.click(screen.getByRole("button", { name: "Gunakan tema gelap" }));

    expect(view.container.querySelector(".room-display")).toHaveClass("room-display--dark");
    // The mark follows the board palette, not the app theme store.
    expect(screen.getByRole("img", { name: "Logo Kementerian Ketenagakerjaan" }).getAttribute("src")).toMatch(/\/logo-kemnaker-putih\.png$/);
    // The accessible name states the action, not a state, so there is no aria-pressed
    // to contradict it — "Gunakan tema gelap, not pressed" would read as nonsense.
    expect(screen.getByRole("button", { name: "Gunakan tema terang" })).not.toHaveAttribute("aria-pressed");
    expect(localStorage.getItem("room-display-theme")).toBe("dark");
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("renders the board without Array.prototype.flatMap", () => {
    const flatMap = vi.spyOn(Array.prototype, "flatMap");
    useRoomDisplay.mockReturnValue({ data, isError: false, isLoading: false });
    render(<RoomDisplayPage />);

    expect(flatMap).not.toHaveBeenCalled();
    expect(screen.getByText("Informasi diperbarui setiap 5 detik")).toBeInTheDocument();
    flatMap.mockRestore();
  });
});

import { CalendarDays, CheckCircle2, Clock3, MapPin, MonitorUp, Moon, Sun, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DisplayBooking, DisplayRoom } from "../api/useRoomDisplay";
import { useRoomDisplay } from "../api/useRoomDisplay";
import "./RoomDisplayPage.css";

const TIMEZONE = "Asia/Jakarta";
/**
 * Agenda rows drawn inside one card before the remainder collapses into a counter.
 * The board is height-locked, so the cap is what keeps a busy room from pushing its
 * own card past the row track instead of clipping mid-line.
 */
const AGENDA_ROWS_PER_CARD = 2;
const ROOMS_PER_PAGE = 8;
const PAGE_ROTATION_INTERVAL = 10_000;
const DISPLAY_THEME_KEY = "room-display-theme";
type DisplayTheme = "light" | "dark";
/**
 * /smart-tv paints its own palette, so the mark follows the panel theme rather than
 * the app theme store: the blue mark on the light board, the white one on the dark.
 */
const KEMNAKER_LOGO: Record<DisplayTheme, string> = {
  light: `${import.meta.env.BASE_URL}logo-kemnaker-biru.png`,
  dark: `${import.meta.env.BASE_URL}logo-kemnaker-putih.png`,
};

function boardDimensions(roomCount: number, paginated: boolean): { columns: number; rows: number } {
  if (paginated || roomCount >= 7) return { columns: 4, rows: 2 };
  if (roomCount >= 5) return { columns: 3, rows: 2 };
  if (roomCount === 4) return { columns: 2, rows: 2 };
  if (roomCount === 3) return { columns: 3, rows: 1 };
  if (roomCount === 2) return { columns: 2, rows: 1 };
  return { columns: 1, rows: 1 };
}

const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIMEZONE });
const clockFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TIMEZONE });
const dateFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE });

/**
 * id-ID separates time parts with a dot ("09.00.00"), which is correct Indonesian
 * typography but reads as a decimal on a wall clock. The requested format is HH:mm:ss,
 * so the separator is normalised after formatting.
 *
 * Done with String.replace rather than Intl.DateTimeFormat.formatToParts because that
 * method needs Chromium 57 and webOS 4.x is Chromium 53 — and unlike ECMAScript
 * builtins, Intl gaps are not covered by the core-js polyfills in the legacy bundle.
 */
function withColons(value: string): string {
  return value.replace(/\./g, ":");
}

function formatTime(value: string): string {
  return withColons(timeFormat.format(new Date(value)));
}

/**
 * The API serialises `currentBooking` separately from `todayBookings`, so the two
 * are distinct objects after JSON.parse and cannot be compared by reference.
 */
function isSameBooking(candidate: DisplayBooking | null, booking: DisplayBooking): boolean {
  return candidate !== null && candidate.startTime === booking.startTime && candidate.endTime === booking.endTime;
}

/**
 * Pins the document to one non-scrolling viewport for as long as the board is on
 * screen. A scrollbar on a wall-mounted panel is both visible and undismissable —
 * there is no pointer to scroll it back.
 *
 * Applied imperatively instead of from RoomDisplayPage.css because that stylesheet
 * is global once its lazy chunk loads: an `html { overflow: hidden }` rule there
 * would keep every other route in the SPA unscrollable for the rest of the session.
 */
function useKioskViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;
    root.classList.add("room-display-lock");
    body.classList.add("room-display-lock");

    return () => {
      root.classList.remove("room-display-lock");
      body.classList.remove("room-display-lock");
    };
  }, []);
}

/**
 * The board keeps its own key instead of reading the app theme store: /smart-tv is
 * unauthenticated wall hardware whose palette is a property of the panel and its
 * ambient light, not of whoever last used the browser profile. It follows the
 * project default of light when unset.
 */
function readDisplayTheme(): DisplayTheme {
  return localStorage.getItem(DISPLAY_THEME_KEY) === "dark" ? "dark" : "light";
}

function Metric({ icon: Icon, tone, value, label }: { icon: LucideIcon; tone: string; value: number; label: string }) {
  return (
    <div className={`room-display__metric room-display__metric--${tone}`}>
      <Icon aria-hidden="true" />
      <span className="room-display__metric-body">
        <strong className="room-display__metric-value">{value}</strong>
        <span className="room-display__metric-label">{label}</span>
      </span>
    </div>
  );
}

function RoomCard({ room }: { room: DisplayRoom }) {
  const inUse = room.state === "IN_USE";
  const rows = room.todayBookings.slice(0, AGENDA_ROWS_PER_CARD);
  const remaining = room.todayBookings.length - rows.length;

  return (
    <article className={`room-display__card room-display__card--${inUse ? "busy" : "free"}`}>
      <div className="room-display__card-head">
        <span className="room-display__badge">{inUse ? "Sedang Dipakai" : "Tersedia"}</span>
      </div>

      <h2 className="room-display__card-name">{room.name}</h2>

      <p className="room-display__card-meta">
        <span><UsersRound aria-hidden="true" />Kapasitas {room.capacity} orang</span>
        <span><MapPin aria-hidden="true" />{room.location}</span>
      </p>

      {/*
        No separate "next booking" footer: nextBooking is always a member of
        todayBookings, so a footer would repeat a row already listed below and push
        the card past its grid track. The rows carry the same information, with the
        in-progress one highlighted.
      */}
      <div className="room-display__card-body">
        {rows.length === 0 ? (
          <div className="room-display__ready">
            <CheckCircle2 aria-hidden="true" />
            <strong>Siap Digunakan</strong>
            <span>Tidak ada agenda hari ini</span>
          </div>
        ) : (
          <ul className="room-display__agenda">
            {rows.map((booking) => {
              const active = isSameBooking(room.currentBooking, booking);

              return (
                <li
                  className={`room-display__agenda-row${active ? " room-display__agenda-row--active" : ""}`}
                  key={`${booking.startTime}-${booking.endTime}`}
                >
                  <span className={`room-display__agenda-unit${active ? " room-display__agenda-unit--active" : ""}`}>{booking.workUnit}</span>
                  <span className="room-display__agenda-detail">
                    <time>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</time>
                    <strong className="room-display__agenda-purpose">{booking.purpose}</strong>
                  </span>
                </li>
              );
            })}
            {remaining > 0 ? <li className="room-display__agenda-more">+{remaining} agenda lainnya</li> : null}
          </ul>
        )}
      </div>
    </article>
  );
}

export function RoomDisplayPage() {
  const display = useRoomDisplay();
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState<DisplayTheme>(readDisplayTheme);
  const [page, setPage] = useState(0);
  useKioskViewport();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const roomKey = display.data?.rooms.map((room) => room.id).join("|") ?? "";
  const pageCount = Math.max(1, Math.ceil((display.data?.rooms.length ?? 0) / ROOMS_PER_PAGE));

  useEffect(() => {
    setPage(0);
  }, [roomKey]);

  useEffect(() => {
    if (pageCount === 1) return;

    const timer = window.setInterval(() => setPage((current) => (current + 1) % pageCount), PAGE_ROTATION_INTERVAL);
    return () => window.clearInterval(timer);
  }, [pageCount]);

  const time = withColons(clockFormat.format(now));
  const date = dateFormat.format(now);
  const data = display.data;
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(DISPLAY_THEME_KEY, next);
    setTheme(next);
  };

  if (!data) {
    /*
     * Only these two states can reach here, and neither may be an infinite dead end:
     * pending with no cached data (first paint) or a hard failure. Once data exists it
     * is kept on screen even while a refetch fails, because a kiosk showing slightly
     * stale room status beats a kiosk showing an error banner.
     *
     * The theme modifier is applied here too: without it the first paint would ignore
     * the panel's stored palette and flash the opposite one before data arrives.
     */
    if (display.isError) {
      return <main className={`room-display room-display--${theme} room-display--message`}>Informasi ruang belum tersedia. Sistem mencoba menghubungkan kembali.</main>;
    }
    return <main className={`room-display room-display--${theme} room-display--message`}>Memuat informasi ruang rapat...</main>;
  }

  const visibleRooms = data.rooms.slice(page * ROOMS_PER_PAGE, (page + 1) * ROOMS_PER_PAGE);
  const dimensions = boardDimensions(visibleRooms.length, pageCount > 1);
  const boardClassName = [
    "room-display__board",
    `room-display__board--columns-${dimensions.columns}`,
    `room-display__board--rows-${dimensions.rows}`,
    dimensions.columns === 4 ? "room-display__board--dense" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className={`room-display room-display--${theme}`}>
      <header className="room-display__top">
        <div className="room-display__brand">
          <span className="room-display__mark">
            <img src={KEMNAKER_LOGO[theme]} alt="Logo Kementerian Ketenagakerjaan" />
          </span>
          <div className="room-display__brand-text">
            <h1 className="room-display__title">SISTEM INFORMASI RUANG RAPAT BINWAS</h1>
            <p className={`room-display__live${display.isError ? " room-display__live--stale" : ""}`}>
              <i aria-hidden="true" />
              <span>{display.isError ? "Koneksi terputus, menampilkan data terakhir" : "Informasi diperbarui setiap 5 detik"}</span>
              <span className="room-display__stamp">Pembaruan terakhir {formatTime(data.checkedAt)} WIB</span>
            </p>
          </div>
        </div>

        <div className="room-display__clock">
          <div className="room-display__clock-line">
            <button
              type="button"
              className="room-display__theme-button"
              aria-label={theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"}
              title={theme === "dark" ? "Tema terang" : "Tema gelap"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <strong className="room-display__time">{time}</strong>
          </div>
          <span className="room-display__date">{date}</span>
        </div>
      </header>

      <section className="room-display__metrics" aria-label="Ringkasan ruang rapat">
        <Metric icon={MonitorUp} tone="total" value={data.summary.total} label="Total Ruang" />
        <Metric icon={CheckCircle2} tone="free" value={data.summary.available} label="Tersedia" />
        <Metric icon={Clock3} tone="busy" value={data.summary.inUse} label="Sedang Dipakai" />
        <Metric icon={CalendarDays} tone="plan" value={data.summary.scheduled} label="Beragenda" />
      </section>

      <div className={boardClassName}>
        {visibleRooms.length
          ? visibleRooms.map((room) => <RoomCard key={room.id} room={room} />)
          : <p className="room-display__empty">Belum ada ruang rapat aktif.</p>}
      </div>

      {pageCount > 1 ? (
        <div className="room-display__pager" aria-live="polite">
          Halaman {page + 1} dari {pageCount}
        </div>
      ) : null}
    </main>
  );
}

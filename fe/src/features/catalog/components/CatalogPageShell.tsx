import { AlertCircle, PackageSearch, RefreshCw } from "lucide-react";

interface CatalogPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
  count: number;
  isLoading: boolean;
  isError: boolean;
  emptyLabel: string;
  onRetry: () => void;
  children: React.ReactNode;
}

export function CatalogPageShell({ eyebrow, title, description, countLabel, count, isLoading, isError, emptyLabel, onRetry, children }: CatalogPageShellProps) {
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-7 text-ink shadow-2xl backdrop-blur-xl sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent-soft blur-[100px]" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">{eyebrow}</p><h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-ink-3">{description}</p></div>
        <div className="rounded-xl border border-line bg-inset px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">{countLabel}</p><p className="mt-1 text-xl font-bold">{isLoading ? "—" : count}</p></div>
      </div>
    </section>

    {isLoading && <CatalogSkeleton />}
    {isError && <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-danger-line bg-panel px-6 text-center backdrop-blur-xl"><div className="grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger"><AlertCircle size={22} /></div><p className="mt-4 font-bold text-ink">Katalog gagal dimuat</p><p className="mt-1 text-sm text-ink-3">Periksa koneksi ke server, lalu coba lagi.</p><button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-solid px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-accent-hover"><RefreshCw size={15} /> Muat ulang</button></div>}
    {!isLoading && !isError && count === 0 && <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-panel-soft px-6 text-center"><PackageSearch size={38} className="text-ink-4" aria-hidden="true" /><p className="mt-4 font-bold text-ink-2">Belum ada {emptyLabel} aktif</p><p className="mt-1 text-sm text-ink-3">Data akan muncul setelah tersedia dari pengelola.</p></div>}
    {!isLoading && !isError && count > 0 && children}
  </div>;
}

function CatalogSkeleton() {
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Memuat katalog">{["one", "two", "three", "four"].map((key) => <div key={key} className="overflow-hidden rounded-2xl border border-line bg-panel"><div className="h-32 animate-pulse bg-raised-soft" /><div className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-raised-soft" /><div className="h-4 w-1/2 animate-pulse rounded bg-raised-soft" /><div className="h-10 animate-pulse rounded-xl bg-raised-soft" /></div></div>)}</div>;
}

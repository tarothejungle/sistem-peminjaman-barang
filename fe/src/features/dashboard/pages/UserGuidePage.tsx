import { Download, FileText } from "lucide-react";

const guideUrl = `${import.meta.env.BASE_URL}user-guide.pdf`;

export function UserGuidePage() {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent"><FileText size={22} aria-hidden="true" /></div>
          <div>
            <h1 className="text-xl font-bold text-ink">User Guide</h1>
            <p className="text-sm text-ink-3">Panduan Penggunaan Peminjaman Ruang Rapat Binwasnaker</p>
          </div>
        </div>
        <a href={guideUrl} download="PANDUAN PENGGUNAAN PEMINJAMAN RUANG RAPAT BINWASNAKER.pdf" className="inline-flex items-center gap-2 rounded-xl bg-accent-solid px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-accent-hover"><Download size={17} aria-hidden="true" />Unduh PDF</a>
      </div>
      <iframe src={`${guideUrl}#toolbar=1&view=FitH`} title="Panduan Penggunaan Peminjaman Ruang Rapat Binwasnaker" className="h-[75vh] min-h-[480px] w-full border-0" />
    </section>
  );
}

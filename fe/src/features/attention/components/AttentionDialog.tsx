import { Info } from "lucide-react";
import { useState } from "react";
import { useAttentionFeed } from "../api/useAttentionMessages";

/**
 * The post-login briefing. It only appears when an administrator has published
 * at least one active notice for the signed-in role, so it costs nothing on a
 * normal page load for everyone else.
 */
export function AttentionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const feed = useAttentionFeed(open);
  const messages = feed.data ?? [];

  if (!open || dismissed || messages.length === 0) return null;

  const close = () => {
    setDismissed(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-overlay px-4 py-8 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="attention-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel-strong shadow-2xl shadow-shade backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-line bg-accent-soft p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-solid text-onaccent shadow-lg shadow-accent-glow"><Info size={21} /></div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Perhatian</p>
            <h2 id="attention-title" className="mt-1 text-lg font-bold text-ink">Mohon dibaca sebelum mengajukan</h2>
          </div>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl border border-line bg-inset-soft p-4">
              <h3 className="font-bold text-ink">{message.title}</h3>
              <div className="mt-2 space-y-2 text-sm leading-6 text-ink-2">
                {message.message.split("\n").map((line) => line.trim()).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
          ))}
        </div>
        <div className="flex justify-end border-t border-line p-5">
          <button type="button" onClick={close} className="rounded-xl bg-accent-solid px-5 py-2.5 text-sm font-bold text-onaccent shadow-lg shadow-accent-glow transition hover:bg-accent-hover">Saya mengerti</button>
        </div>
      </div>
    </div>
  );
}
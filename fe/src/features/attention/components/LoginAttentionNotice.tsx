import { usePublicAttentionFeed } from "../api/useAttentionMessages";
import { SIGNAL_WORD_STYLES } from "./signalWord";

/**
 * Announcements an administrator placed before login. They render inside the
 * sign-in card, so they stay visible while maintenance mode is on.
 */
export function LoginAttentionNotice() {
  const feed = usePublicAttentionFeed();
  const messages = feed.data ?? [];

  if (messages.length === 0) return null;

  return (
    <section aria-label="Informasi sebelum masuk" className="mb-6 space-y-3">
      {messages.map((message) => {
        const signal = SIGNAL_WORD_STYLES[message.signalWord];
        const SignalIcon = signal.icon;
        return (
        <article key={message.id} className={`rounded-xl border p-4 text-left ${signal.border} ${signal.background}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-onaccent ${signal.solid}`}>
              <SignalIcon size={16} />
            </span>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${signal.text}`}>{signal.label}</p>
              <h2 className="mt-0.5 text-sm font-bold text-ink">{message.title}</h2>
              <div className="mt-1 space-y-1.5 text-xs leading-5 text-ink-2">
                {message.message.split("\n").map((line) => line.trim()).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </div>
        </article>
        );
      })}
    </section>
  );
}
import { Megaphone } from "lucide-react";
import { usePublicAttentionFeed } from "../api/useAttentionMessages";

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
      {messages.map((message) => (
        <article key={message.id} className="rounded-xl border border-warn-line bg-warn-soft p-4 text-left">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-warn-solid text-onaccent">
              <Megaphone size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">{message.title}</h2>
              <div className="mt-1 space-y-1.5 text-xs leading-5 text-ink-2">
                {message.message.split("\n").map((line) => line.trim()).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
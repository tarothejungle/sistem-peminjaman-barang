import { MessageCircle } from "lucide-react";
import { getWhatsAppUrl } from "../../utils/whatsapp";

export function WhatsAppLink({ phoneNumber }: { phoneNumber: string }) {
  const url = getWhatsAppUrl(phoneNumber);
  if (!url) return <span className="text-ink-3">{phoneNumber}</span>;

  return <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-ok transition hover:text-ok hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok" aria-label={`Hubungi ${phoneNumber} melalui WhatsApp`}><MessageCircle size={14} />{phoneNumber}</a>;
}

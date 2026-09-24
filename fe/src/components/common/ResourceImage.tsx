import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export function ResourceImage({ url, alt, className, fallback }: { url?: string | null; alt: string; className: string; fallback: React.ReactNode }) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setSource(null); return; }
    let objectUrl: string | null = null;
    let active = true;
    api.get<Blob>(url, { responseType: "blob" }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setSource(objectUrl);
    }).catch(() => { if (active) setSource(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  return source ? <img src={source} alt={alt} className={className} /> : <>{fallback}</>;
}

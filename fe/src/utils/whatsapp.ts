export function getWhatsAppUrl(phoneNumber: string): string | null {
  let digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  if (!/^62[0-9]{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}

/** GochaoBD WhatsApp number in international format, digits only (placeholder until the real one is provided). */
export const WHATSAPP_NUMBER = "8801000000000";

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Zentraler Ort für den öffentlichen Community-Kanal (Telegram/Discord).
// Über VITE_COMMUNITY_URL / VITE_COMMUNITY_LABEL überschreibbar, damit der
// Link nicht im Code festbrennt. Default: Telegram-Kanal der Jagd.
export const COMMUNITY_URL =
  import.meta.env.VITE_COMMUNITY_URL || "https://t.me/energyHunt";
export const COMMUNITY_LABEL =
  import.meta.env.VITE_COMMUNITY_LABEL || "Telegram-Kanal";

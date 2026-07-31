// Zentraler Ort für die öffentlichen Community-Kanäle (Telegram + Discord).
// Über VITE_COMMUNITY_URL / VITE_COMMUNITY_LABEL bzw. VITE_DISCORD_URL
// überschreibbar, damit die Links nicht im Code festbrennen.
export const COMMUNITY_URL =
  import.meta.env.VITE_COMMUNITY_URL || "https://t.me/energyHunt";
export const COMMUNITY_LABEL =
  import.meta.env.VITE_COMMUNITY_LABEL || "Telegram-Kanal";
export const DISCORD_URL =
  import.meta.env.VITE_DISCORD_URL || "https://discord.gg/E4hJvF9bh";
export const DISCORD_LABEL = "Discord";

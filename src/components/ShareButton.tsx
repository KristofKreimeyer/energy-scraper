import { useState } from "react";

// Teilen-Button: nutzt die native Web-Share-API (Mobil), sonst ein kleines
// Fallback-Menü (WhatsApp / Telegram / Link kopieren) für Desktop.

interface ShareButtonProps {
  text: string;
  url: string;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

export function ShareButton({ text, url, className, children, ariaLabel }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "EnergyHunt", text, url });
      } catch {
        /* Nutzer hat abgebrochen o. Ä. – nichts weiter tun. */
      }
      return;
    }
    setOpen((v) => !v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard nicht verfügbar */
    }
  }

  const shareText = `${text} ${url}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const item = "block w-full text-left px-3 py-2 text-[0.82rem] text-ink hover:bg-surface-2 cursor-pointer";

  return (
    <span className="relative z-10 inline-flex self-start" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={className} aria-label={ariaLabel ?? "Teilen"} aria-haspopup="menu" aria-expanded={open} onClick={onClick}>
        {children}
      </button>
      {open && (
        <>
          {/* Klick daneben schließt das Menü. */}
          <span className="fixed inset-0 z-20" aria-hidden="true" onClick={() => setOpen(false)} />
          <span role="menu" className="absolute right-0 top-full mt-1 z-30 min-w-[180px] flex flex-col bg-surface border border-border-strong rounded-lg shadow-card overflow-hidden">
            <a role="menuitem" className={item} href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              WhatsApp
            </a>
            <a role="menuitem" className={item} href={tgHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              Telegram
            </a>
            <button role="menuitem" type="button" className={item} onClick={copy}>
              {copied ? "✓ Link kopiert" : "Link kopieren"}
            </button>
          </span>
        </>
      )}
    </span>
  );
}

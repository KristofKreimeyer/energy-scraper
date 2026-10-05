import { generatedAt } from "../lib/offers";
import { WRAP } from "../lib/layout";
import { COMMUNITY_URL, COMMUNITY_LABEL, DISCORD_URL, DISCORD_LABEL } from "../lib/community-config";

export default function Footer() {
  const generatedLabel = new Date(generatedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <footer className="border-t-4 border-border-strong mt-10 pt-6 pb-10 text-muted text-[1rem]">
      <div className={`${WRAP} flex flex-wrap gap-x-4 gap-y-2 items-center`}>
        <span className="font-display text-[1.4rem] leading-none text-ink inline-flex items-center gap-2">
          <span aria-hidden="true">⚡</span>EnergyHunt
        </span>
        <a className="hover:text-accent-strong underline underline-offset-2" href="#/impressum">
          Impressum
        </a>
        <a className="hover:text-accent-strong underline underline-offset-2" href="#/datenschutz">
          Datenschutz
        </a>
        <a className="hover:text-accent-strong underline underline-offset-2" href="#/agb">
          AGB
        </a>
        <a className="hover:text-accent-strong underline underline-offset-2" href="#/widerruf">
          Widerruf
        </a>
        <a
          className="font-semibold text-accent-strong hover:text-accent underline underline-offset-2"
          href={COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          ⚡ Community · {COMMUNITY_LABEL}
        </a>
        <a
          className="font-semibold text-accent-strong hover:text-accent underline underline-offset-2"
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 {DISCORD_LABEL}
        </a>
        <span className="font-mono text-[1rem] basis-full">
          Datenquelle: Wochenprospekte · Stand {generatedLabel} · unabhängig, nicht von Monster, Red Bull, Rockstar oder GÖNRGY autorisiert.
        </span>
      </div>
    </footer>
  );
}

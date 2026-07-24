import { generatedAt } from "../lib/offers";
import { WRAP } from "../utils/helper";

export default function Footer() {
  const generatedLabel = new Date(generatedAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });


  return (
    <footer className="border-t border-border mt-10 pt-[22px] pb-10 text-muted text-[0.84rem]">
      <div
        className={`${WRAP} flex flex-wrap gap-x-[18px] gap-y-2 items-center`}
      >
        <span>EnergyHunt — Angebotsübersicht</span>
        <a
          className="hover:text-accent-strong underline underline-offset-2"
          href="#/impressum"
        >
          Impressum
        </a>
        <a
          className="hover:text-accent-strong underline underline-offset-2"
          href="#/datenschutz"
        >
          Datenschutz
        </a>
        <a
          className="hover:text-accent-strong underline underline-offset-2"
          href="#/agb"
        >
          AGB
        </a>
        <a
          className="hover:text-accent-strong underline underline-offset-2"
          href="#/widerruf"
        >
          Widerruf
        </a>
        <span className="font-mono text-[0.76rem] basis-full">
          Datenquelle: energy-scraper · captured/*.json · Stand {generatedLabel}
        </span>
      </div>
    </footer>
  );
}

import { WRAP } from "../lib/layout";

// Footer der Rechtsseiten: nur die Pflichtlinks, ohne die „Datenquelle"-Zeile
// des Haupt-Footers.
export default function LegalFooter() {
  return (
    <footer className="border-t border-border mt-10 pt-[1.375rem] pb-10 text-muted text-[1rem]">
      <div className={`${WRAP} flex flex-wrap gap-x-[1.125rem] gap-y-2 items-center`}>
        <span>EnergyHunt — Angebotsübersicht</span>
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
      </div>
    </footer>
  );
}

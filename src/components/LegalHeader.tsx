import { WRAP } from "../lib/layout";

// Reduzierter Kopf für die rechtlichen Pflichtseiten: nur das Logo (zurück zur
// Übersicht), ohne Preis-Alarm-/Theme-Buttons.
export default function LegalHeader() {
  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[0.5rem] backdrop-saturate-150 border-b border-border">
      <div className={`${WRAP} flex items-center gap-4 h-[3.875rem]`}>
        <a href="#" className="font-display flex items-center gap-2.5 text-[1.75rem] leading-none">
          <span
            className="w-[1.875rem] h-[1.875rem] flex-none grid place-items-center bg-fill text-on-fill rounded-lg text-[1.1rem]"
            aria-hidden="true"
          >
            ⚡
          </span>
          <span>
            Energy<em className="not-italic text-accent-strong">Hunt</em>
          </span>
        </a>
      </div>
    </header>
  );
}

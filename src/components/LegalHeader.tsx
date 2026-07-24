import { WRAP } from "../utils/helper";

// Reduzierter Kopf für die rechtlichen Pflichtseiten: nur das Logo (zurück zur
// Übersicht), ohne Preis-Alarm-/Theme-Buttons.
export default function LegalHeader() {
  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[8px] backdrop-saturate-150 border-b border-border">
      <div className={`${WRAP} flex items-center gap-4 h-[62px]`}>
        <a
          href="#"
          className="flex items-center gap-2.5 font-[750] tracking-[-0.02em] text-[1.12rem]"
        >
          <span
            className="w-[30px] h-[30px] flex-none grid place-items-center bg-accent text-white rounded-lg text-[1.1rem]"
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

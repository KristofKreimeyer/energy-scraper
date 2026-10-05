import { useRef } from "react";
import { WRAP } from "../lib/layout";
import DropletCan from "./DropletCan";
import { useCinematicScroll } from "../hooks/useCinematicScroll";
import type { Timeframe } from "../lib/offers";

// Kino-Hero: eine Bühne in Nachtblau, die beim Scrollen stehen bleibt (sticky).
// Titel → Dose zoomt heran, Blitze schlagen ein → Dose rückt zur Seite, Text erscheint.
// Die Choreografie steuert useCinematicScroll über CSS-Variablen; der Inhalt bleibt
// normales HTML (h1, Fließtext), damit er auch ohne Animation lesbar ist.

/** Großer Blitz als Fläche (Emblem), gelb mit Leuchten */
function BoltShape({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 220" className={`cine-bolt ${className}`} style={style} aria-hidden="true">
      <polygon points="74,0 8,124 56,124 36,220 112,86 64,86" fill="var(--sun)" />
    </svg>
  );
}

/** Zackiger Einschlag (Polylinie) – leuchtet nur im Moment des Blitzes auf */
function Strike({ d, className }: { d: string; className: string }) {
  return (
    <svg
      viewBox="0 0 200 800"
      preserveAspectRatio="none"
      className={`absolute top-0 h-full w-[12vw] max-w-[12rem] pointer-events-none ${className}`}
      style={{ opacity: "var(--flash)" }}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--sun)"
        strokeWidth="14"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.4"
        style={{ filter: "blur(6px)" }}
      />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function CinematicStage({ timeframe }: { timeframe: Timeframe }) {
  const ref = useRef<HTMLDivElement>(null);
  useCinematicScroll(ref);

  return (
    <div ref={ref} className="cine" aria-labelledby="page-title">
      <div className="cine-stage">
        {/* Hintergrund-Blitze mit Parallaxe (unterschiedliche Geschwindigkeiten) */}
        <BoltShape
          className="left-[52%] top-[10%] h-[40vh] opacity-20 blur-[2px]"
          style={{ transform: "translateY(calc(var(--bolt-a) * 1vh))" }}
        />
        <BoltShape
          className="left-[88%] top-[60%] h-[56vh] opacity-30"
          style={{ transform: "translateY(calc(var(--bolt-b) * 1vh)) rotate(12deg)" }}
        />
        <BoltShape
          className="left-[34%] top-[96%] h-[72vh] opacity-[0.12] blur-[4px]"
          style={{ transform: "translateY(calc(var(--bolt-c) * 1vh)) rotate(-8deg)" }}
        />
        <Strike className="left-[56%]" d="M120 0 L88 120 L132 210 L84 330 L140 430 L96 560 L120 800" />
        <Strike className="left-[18%]" d="M90 0 L130 140 L80 260 L124 380 L70 520 L110 660 L86 800" />
        <div className="cine-flash" />

        <DropletCan className="cine-can z-[2]" />

        <div className={`${WRAP} relative z-[3] flex h-full flex-col justify-center`}>
          <div className="cine-title">
            <p className="mb-4 font-mono text-[1rem] uppercase tracking-[0.2em] text-white/80">
              Energy-Drink-Angebote · {timeframe === "current" ? "Diese Woche" : "Nächste Woche · Vorschau"}
            </p>
            <h1
              id="page-title"
              className="text-[clamp(2.5rem,11vw,9rem)] leading-[0.9] tracking-[-0.01em] text-balance text-white max-w-[14ch]"
            >
              {timeframe === "current" ? (
                <>
                  Schnäppchenjagd auf <span className="text-sun [text-shadow:0_0_2rem_rgb(255_214_10/0.55)]">Energy&#8209;Drinks</span>.
                </>
              ) : (
                <>Der Ausblick: Energy&#8209;Deals der nächsten Woche.</>
              )}
            </h1>
          </div>

          <div className="cine-copy absolute bottom-[12%] left-0 w-full">
            <div className={`${WRAP}`}>
              <p className="max-w-[28ch] text-[clamp(1.5rem,3.4vw,2.5rem)] font-bold leading-tight text-white">
                Jede Woche alle Prospekte. <span className="text-sun">Ein Preis pro Liter.</span>
              </p>
              <p className="mt-4 max-w-[40ch] text-[1.125rem] text-white/80">
                Automatisch verglichen nach Grundpreis – das beste €/L steht ganz oben.
              </p>
            </div>
          </div>
        </div>

        <div
          className="cine-hint absolute bottom-6 right-8 z-[3] flex items-center gap-2 font-mono text-[1rem] uppercase tracking-[0.2em] text-white/80"
          aria-hidden="true"
        >
          Scrollen <span className="cine-hint-arrow">↓</span>
        </div>
        <div className="cine-progress" aria-hidden="true" />
      </div>
    </div>
  );
}

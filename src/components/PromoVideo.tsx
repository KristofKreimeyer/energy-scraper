import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { WRAP } from "../lib/layout";

// 15-Sekunden-Clip, direkt eingebunden (MP4 + WebM, kein Drittanbieter). Läuft
// stumm in Schleife, sobald er im Bild ist – außer bei „reduzierte Bewegung":
// dann startet er nur per Klick. Der Play/Pause-Knopf ist immer erreichbar.
// Quelle des Clips: tools/promo/scene.html (gerendert mit scripts/render-promo.mjs).

export default function PromoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <section className="bg-night-deep text-white py-16" aria-labelledby="promo-title">
      <div className={WRAP}>
        <p className="font-mono text-[1rem] uppercase tracking-[0.2em] text-sun">15 Sekunden</p>
        <h2 id="promo-title" className="mt-2 max-w-[16ch] text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">
          So fühlt sich <span className="text-sun">Sparen</span> an.
        </h2>

        <div className="relative mt-8 overflow-hidden border-[0.25rem] border-sun bg-night shadow-[0.5rem_0.5rem_0_var(--accent)]">
          <video
            ref={video}
            className="block aspect-video w-full"
            poster="/media/energyhunt-promo-poster.jpg"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Animierter Clip: EnergyHunt-Dose und bester Preis pro Liter"
            aria-describedby="promo-beschreibung"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src="/media/energyhunt-promo.webm" type="video/webm" />
            <source src="/media/energyhunt-promo.mp4" type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={toggle}
            className="absolute bottom-4 left-4 flex h-12 items-center gap-2 bg-sun px-4 text-[1rem] font-bold text-black cursor-pointer hover:opacity-90"
            aria-label={playing ? "Clip pausieren" : "Clip abspielen"}
          >
            {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            {playing ? "Pause" : "Abspielen"}
          </button>
        </div>
        <p id="promo-beschreibung" className="mt-4 max-w-[60ch] text-[1.125rem] text-white/80">
          Textfassung des Clips (ohne Ton): Blitze zucken über einen dunklen Hintergrund, dazu der Schriftzug „Fühl den Strom.“ Eine
          Energy-Drink-Dose von EnergyHunt erscheint, umkreist von Blitzen. Der Preis pro Liter fällt von 6,99 € auf 3,33 €, dazu
          Beispielkarten von Red Bull bei Aldi Nord, Aldi Süd und Rewe. Zum Schluss das Logo EnergyHunt mit dem Hinweis auf den besten Preis
          pro Liter.
        </p>
      </div>
    </section>
  );
}

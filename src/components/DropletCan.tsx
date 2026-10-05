import { useEffect, useRef } from "react";
import { drawDroplets } from "../lib/droplets";

// Dosenfoto mit animierten Kondenswasser-Tropfen. Das Canvas liegt über dem Foto und
// wird per CSS-Maske auf die Dosenform begrenzt (Alphakanal des Fotos), damit keine
// Tropfen neben der Dose erscheinen. Bei „reduzierte Bewegung" bleibt es beim Foto
// (die Perlen sind schon im Bild); die Animation pausiert, wenn die Dose nicht sichtbar ist.

const W = 610;
const H = 1500;

export default function DropletCan({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const frame = (now: number) => {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
      drawDroplets(ctx, W, H, (now - start) / 1000);
      if (visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(el);
    raf = requestAnimationFrame(frame);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={className}>
      <img src="/media/dose.webp" alt="" width={W} height={H} className="block h-auto w-full" fetchPriority="high" />
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{
          maskImage: "url(/media/dose.webp)",
          maskSize: "100% 100%",
          WebkitMaskImage: "url(/media/dose.webp)",
          WebkitMaskSize: "100% 100%",
        }}
      />
    </div>
  );
}

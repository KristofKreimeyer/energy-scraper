import { WRAP, useTheme } from "../utils/helper";

export default function Header({
  onOpenCreator,
}: {
  onOpenCreator: () => void;
}) {
  const { isDark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[8px] backdrop-saturate-150 border-b border-border">
      <div className={`${WRAP} flex items-center gap-4 h-[62px]`}>
        <div className="flex items-center gap-2.5 font-[750] tracking-[-0.02em] text-[1.12rem]">
          <span
            className="w-[30px] h-[30px] flex-none grid place-items-center bg-accent text-white rounded-lg text-[1.1rem]"
            aria-hidden="true"
          >
            ⚡
          </span>
          <span>
            Energy<em className="not-italic text-accent-strong">Hunt</em>
          </span>
        </div>
        <button
          className="flex-none ml-auto h-10 px-3.5 bg-accent text-white border border-accent rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-accent-strong"
          type="button"
          onClick={onOpenCreator}
        >
          <span aria-hidden="true">⏰</span>
          Preis-Alarm
        </button>
        <button
          className="flex-none h-10 min-w-[44px] px-3 bg-surface text-ink border border-border-strong rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-[7px] hover:bg-surface-2"
          type="button"
          aria-pressed={isDark}
          onClick={toggle}
        >
          <span aria-hidden="true">{isDark ? "◑" : "◐"}</span>
          {isDark ? "Hell" : "Dunkel"}
        </button>
      </div>
    </header>
  );
}

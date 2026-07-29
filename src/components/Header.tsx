import { WRAP, useTheme } from "../utils/helper";
import { AccountButton } from "./AccountButton";

export default function Header({
  onOpenCreator,
}: {
  onOpenCreator: () => void;
}) {
  const { isDark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-[8px] backdrop-saturate-150 border-b border-border">
      <div className={`${WRAP} flex items-center gap-2 sm:gap-4 h-[62px]`}>
        <div className="font-display flex items-center gap-2.5 font-[700] tracking-[-0.02em] text-[1.15rem] min-w-0">
          <span
            className="w-[30px] h-[30px] flex-none grid place-items-center bg-fill text-on-fill rounded-lg text-[1.1rem]"
            aria-hidden="true"
          >
            ⚡
          </span>
          <span className="truncate">
            Energy<em className="not-italic text-accent-strong">Hunt</em>
          </span>
        </div>
        <button
          className="flex-none ml-auto h-10 px-3 sm:px-3.5 bg-fill text-on-fill border border-fill rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:opacity-90"
          type="button"
          onClick={onOpenCreator}
        >
          <span aria-hidden="true">⏰</span>
          <span className="hidden sm:inline">Preis-Alarm</span>
        </button>
        <AccountButton />
        <button
          className="flex-none h-10 min-w-[44px] px-3 bg-surface text-ink border border-border-strong rounded-[10px] text-[0.85rem] font-semibold cursor-pointer inline-flex items-center gap-[7px] hover:bg-surface-2"
          type="button"
          aria-pressed={isDark}
          aria-label={isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
          onClick={toggle}
        >
          <span aria-hidden="true">{isDark ? "◑" : "◐"}</span>
          <span className="hidden sm:inline">{isDark ? "Hell" : "Dunkel"}</span>
        </button>
      </div>
    </header>
  );
}

// Pro-Code-Einlöse-Zeile (Eingabe + „Einlösen"). Geteilt von AlarmButton /
// AlarmCreator via ProPlans.
export default function RedeemCodeForm({
  code,
  onCodeChange,
  onRedeem,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onRedeem: () => void;
}) {
  return (
    <div className="flex gap-1.5">
      <input
        type="text"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="Pro-Code"
        className="flex-1 min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
      />
      <button
        type="button"
        onClick={onRedeem}
        className="flex-none h-9 px-3 text-[0.82rem] font-semibold text-good border border-[color-mix(in_srgb,var(--good)_40%,transparent)] rounded-lg cursor-pointer hover:bg-good-tint"
      >
        Einlösen
      </button>
    </div>
  );
}

import { useState } from "react";
import { PLANS, type Channel, type Plan } from "../lib/alarmApi";
import RedeemCodeForm from "./RedeemCodeForm";

// Pro freischalten: Kauf primär (E-Mail-Kanal, Stripe-Pläne), Code sekundär.
// Telegram → Hinweis auf Bot; Push → nur Code (an dieses Gerät gebunden).
// Geteilt von AlarmButton und AlarmCreator.
export default function ProPlans({
  channel,
  title = "Pro – mehrere Marken + Wunschpreis",
  onCheckout,
  code,
  onCodeChange,
  onRedeem,
}: {
  channel: Channel;
  title?: string;
  onCheckout: (plan: Plan) => void;
  code: string;
  onCodeChange: (value: string) => void;
  onRedeem: () => void;
}) {
  const [codeOpen, setCodeOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
      <span className="text-[0.74rem] font-semibold text-ink">{title}</span>

      {channel === "telegram" ? (
        <p className="text-[0.74rem] text-muted">
          Im Telegram-Bot freischalten: sende{" "}
          <span className="text-ink font-semibold">/redeem DEIN-CODE</span> an den
          Bot.
        </p>
      ) : channel === "push" ? (
        <>
          <RedeemCodeForm code={code} onCodeChange={onCodeChange} onRedeem={onRedeem} />
          <span className="text-[0.68rem] text-muted">
            Pro wird an dieses Gerät gebunden.
          </span>
        </>
      ) : (
        <>
          {PLANS.map((p) => (
            <button
              key={p.plan}
              type="button"
              onClick={() => onCheckout(p.plan)}
              className={`flex items-center justify-between gap-2 w-full h-11 px-3 rounded-lg border bg-surface text-left cursor-pointer hover:border-accent ${
                "highlight" in p ? "border-accent" : "border-border-strong"
              }`}
            >
              <span className="text-[0.9rem] font-bold text-ink">
                {p.price}{" "}
                <span className="text-[0.72rem] font-medium text-muted">
                  {p.period}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                {"badge" in p && p.badge && (
                  <span className="text-[0.62rem] font-bold uppercase tracking-wide text-accent-strong bg-accent-tint rounded px-1.5 py-0.5">
                    {p.badge}
                  </span>
                )}
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="self-start text-[0.7rem] text-muted underline underline-offset-2 hover:text-accent-strong cursor-pointer"
            onClick={() => setCodeOpen((v) => !v)}
          >
            Schon Supporter? Code einlösen
          </button>
          {codeOpen && (
            <RedeemCodeForm code={code} onCodeChange={onCodeChange} onRedeem={onRedeem} />
          )}
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { productKey, type GroupedOffer } from "../lib/offers";
import { authHeader } from "../auth/session";
import { Tag } from "lucide-react";
import { API_BASE } from "../lib/api";

// „Günstiger gesehen?" – anonyme Community-Preismeldung für ein bestehendes
// Angebot. Meldung geht als 'pending' an den Worker und wird erst nach
// Moderation als Community-Hinweis angezeigt.

type State =
  | { kind: "idle" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export function ReportPriceButton({ offer, embedded = false, onClose }: { offer: GroupedOffer; embedded?: boolean; onClose?: () => void }) {
  // Eingebettet startet das Formular direkt; „Abbrechen“ schließt das Panel.
  const [state, setState] = useState<State>(embedded ? { kind: "open" } : { kind: "idle" });
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const [note, setNote] = useState("");

  async function submit() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch(`${API_BASE}/api/report-price`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({
          productKey: productKey(offer),
          brand: offer.brand,
          title: offer.title,
          market: offer.market,
          price,
          storeLocation: store,
          note,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        setState({ kind: "done", message: data.message ?? "Danke für deine Meldung!" });
      } else {
        setState({ kind: "error", message: data.message ?? "Das hat nicht geklappt." });
      }
    } catch {
      setState({ kind: "error", message: "Keine Verbindung zum Dienst." });
    }
  }

  if (state.kind === "done") {
    return (
      <p className="relative z-10 mt-2 flex items-start gap-1.5 text-[0.76rem] text-good" role="status">
        <span aria-hidden="true">✅</span>
        {state.message}
      </p>
    );
  }

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        className="relative z-10 mt-2 self-start inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted hover:text-accent-strong cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setState({ kind: "open" });
        }}
      >
        <Tag size={13} strokeWidth={2} aria-hidden />
        Günstiger gesehen?
      </button>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <form
      className="relative z-10 mt-2 flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink">
        <Tag size={13} strokeWidth={2} aria-hidden />
        Günstiger gesehen bei {offer.market}?
      </span>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`report-price-${offer.id}`} className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-muted">
          Gesehener Preis (€)
        </label>
        <div className="flex items-center gap-1 h-9 px-2.5 bg-surface border border-border-strong rounded-lg">
          <input
            id={`report-price-${offer.id}`}
            type="number"
            inputMode="decimal"
            required
            autoFocus
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="z. B. 0,69"
            className="w-full min-w-0 bg-transparent text-ink text-[0.82rem] outline-none"
          />
          <span className="flex-none text-[0.72rem] text-muted">€</span>
        </div>
      </div>

      <input
        type="text"
        value={store}
        onChange={(e) => setStore(e.target.value)}
        placeholder="Filiale / Ort (optional)"
        maxLength={80}
        className="w-full min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notiz, z. B. Aktion bis Samstag (optional)"
        maxLength={200}
        className="w-full min-w-0 h-9 px-2.5 text-[0.82rem] bg-surface text-ink border border-border-strong rounded-lg outline-none"
      />

      {state.kind === "error" && (
        <p className="text-[0.74rem] text-warn-ink" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 text-[0.82rem] font-semibold text-on-fill bg-fill border border-fill rounded-lg cursor-pointer hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "…" : "Melden"}
        </button>
        <button
          type="button"
          onClick={() => (embedded ? onClose?.() : setState({ kind: "idle" }))}
          className="text-[0.76rem] text-muted hover:text-ink cursor-pointer"
        >
          Abbrechen
        </button>
      </div>
      <span className="text-[0.68rem] text-muted">Anonym · wird vor der Anzeige geprüft.</span>
    </form>
  );
}

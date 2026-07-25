import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

// Zielseite des Magic-Links (#/auth?token=…): tauscht den Einmal-Token gegen
// eine Session und leitet dann zur Startseite zurück.
export default function AuthCallback() {
  const { verifyToken } = useAuth();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.location.hash.split("?")[1] ?? "";
    const token = new URLSearchParams(query).get("token") ?? "";
    (async () => {
      const success = token ? await verifyToken(token) : false;
      setOk(success);
      // URL säubern und zurück zur Übersicht (erfolgreich schneller).
      setTimeout(() => {
        window.location.hash = "";
      }, success ? 900 : 2600);
    })();
    // Nur beim Mount ausführen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[60vh] grid place-items-center px-5 text-center">
      <div>
        <div className="text-2xl mb-3" aria-hidden="true">
          {ok === null ? "⏳" : ok ? "✅" : "⚠️"}
        </div>
        <p className="text-ink font-semibold">
          {ok === null ? "Anmeldung wird abgeschlossen …" : ok ? "Angemeldet! Weiter geht’s …" : "Anmeldelink ungültig oder abgelaufen."}
        </p>
        {ok === false && <p className="text-muted text-[0.85rem] mt-1">Fordere auf der Startseite einen neuen Link an.</p>}
      </div>
    </div>
  );
}

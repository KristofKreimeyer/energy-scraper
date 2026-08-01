import { H2, Pp } from "./legalParts";

export function AGB() {
  return (
    <>
      <H2>§ 1 Geltungsbereich und Anbieter</H2>
      <Pp>
        Diese Allgemeinen Geschäftsbedingungen gelten für die über EnergyHunt
        angebotenen kostenpflichtigen „Pro"-Leistungen zwischen dem im{" "}
        <a className="text-accent-strong underline" href="#/impressum">
          Impressum
        </a>{" "}
        genannten Anbieter und dir als Verbraucher. Der kostenlose Basisdienst
        (Angebotsübersicht, ein Alarm) ist von diesen Bedingungen unberührt.
      </Pp>

      <H2>§ 2 Leistungsbeschreibung</H2>
      <Pp>
        Pro erweitert den Bestpreis-Alarm um beliebig viele beobachtete Marken
        sowie individuelle Preiswecker mit Wunschpreis. EnergyHunt liefert
        Informationen über Angebote Dritter und verkauft die beworbenen Produkte
        nicht selbst. Ein bestimmter Erfolg (z. B. das Auftreten eines
        bestimmten Preises) wird nicht geschuldet.
      </Pp>

      <H2>§ 3 Vertragsschluss</H2>
      <Pp>
        Die Darstellung der Pro-Pläne ist eine Aufforderung zur Abgabe eines
        Angebots. Mit Auswahl eines Plans und Abschluss des Bezahlvorgangs über
        Stripe gibst du ein verbindliches Angebot ab; der Vertrag kommt mit
        unserer Bestätigung bzw. der Freischaltung der Pro-Funktion zustande.
      </Pp>

      <H2>§ 4 Preise und Zahlung</H2>
      <Pp>
        Es gelten die zum Zeitpunkt der Bestellung angezeigten Preise.
        Abrechnung und Zahlungsabwicklung erfolgen über Stripe. Bei Abo-Plänen
        (monatlich/jährlich) verlängert sich der Vertrag jeweils um die gewählte
        Laufzeit, sofern er nicht zum Laufzeitende gekündigt wird. Der
        Einmal-Kauf („Lifetime") ist eine einmalige Zahlung ohne wiederkehrende
        Abbuchung.
      </Pp>
      <Pp>
        Alle angezeigten Preise sind Endpreise. Als Kleinunternehmer gemäß § 19
        UStG wird keine Umsatzsteuer ausgewiesen.
      </Pp>

      <H2>§ 5 Laufzeit und Kündigung</H2>
      <Pp>
        Abo-Verträge können jederzeit zum Ende der laufenden Abrechnungsperiode
        gekündigt werden, z. B. per E-Mail an kontakt@kristof-kreimeyer.de. Bereits
        gezahlte Beträge für die laufende Periode werden nicht anteilig
        erstattet, soweit gesetzlich zulässig.
      </Pp>

      <H2>§ 6 Widerrufsrecht</H2>
      <Pp>
        Als Verbraucher steht dir ein gesetzliches Widerrufsrecht zu.
        Einzelheiten regelt die{" "}
        <a className="text-accent-strong underline" href="#/widerruf">
          Widerrufsbelehrung
        </a>
        .
      </Pp>

      <H2>§ 7 Haftung</H2>
      <Pp>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
        Verletzung von Leben, Körper oder Gesundheit. Bei einfacher
        Fahrlässigkeit haften wir nur bei Verletzung wesentlicher
        Vertragspflichten und begrenzt auf den vertragstypischen, vorhersehbaren
        Schaden. Für die Richtigkeit der von Dritten stammenden Angebotsdaten
        wird keine Haftung übernommen.
      </Pp>

      <H2>§ 8 Schlussbestimmungen</H2>
      <Pp>
        Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
        UN-Kaufrechts. Sollte eine Bestimmung unwirksam sein, bleibt die
        Wirksamkeit der übrigen unberührt.
      </Pp>
    </>
  );
}

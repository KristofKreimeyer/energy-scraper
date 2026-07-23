/**
 * Zweck: Rechtliche Pflichtseiten (Impressum, Datenschutz, AGB,
 *   Widerrufsbelehrung inkl. Muster-Widerrufsformular) als leichte Hash-Routen
 *   – ohne zusätzliche Router-Dependency.
 * Nutzung: useHashRoute() liefert die aktuelle Route; <LegalPage> rendert den
 *   passenden Text. Verlinkt wird über href="#/impressum" usw.
 *
 * WICHTIG: Ausgefüllt für den Betreiber (Einzelunternehmen, Kleinunternehmer
 * § 19 UStG), aber NICHT anwaltlich geprüft. Vor dem endgültigen Live-Gang
 * (echte Zahlungen) sollte ein Gegencheck erfolgen; die „Einzelunternehmen"-/
 * Gewerbeamt-Angaben setzen eine erfolgte Gewerbeanmeldung voraus.
 */

import { LEGAL_ROUTES, type LegalRoute } from "../lib/legalRoutes";

// --- Bausteine -------------------------------------------------------------

const WRAP = "mx-auto w-full max-w-[760px] px-5";
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[1.15rem] font-bold text-ink mt-8 mb-2">{children}</h2>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[0.98rem] font-semibold text-ink mt-5 mb-1.5">{children}</h3>
);
const Pp = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[0.9rem] leading-relaxed text-ink/90 mb-3">{children}</p>
);

const TODAY_YEAR = new Date().getFullYear();

// --- Inhalte ---------------------------------------------------------------

function Impressum() {
  return (
    <>
      <Pp>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz).</Pp>

      <H2>Diensteanbieter</H2>
      <Pp>
        Kristof Kreimeyer
        <br />
        Einzelunternehmen, handelnd als „EnergyHunt"
        <br />
        Bahnhofstr. 4
        <br />
        59439 Holzwickede
        <br />
        Deutschland
      </Pp>

      <H2>Kontakt</H2>
      <Pp>
        E-Mail: kontakt@energyhunt.de
        <br />
        Website: energyhunt.pages.dev
      </Pp>

      <H2>Rechtsform &amp; Aufsicht</H2>
      <Pp>
        Rechtsform: Einzelunternehmen. Zuständige Aufsichtsbehörde: Gewerbeamt Unna.
      </Pp>

      <H2>Redaktionell verantwortlich</H2>
      <Pp>
        Kristof Kreimeyer
        <br />
        Bahnhofstr. 4
        <br />
        59439 Holzwickede
      </Pp>

      <H2>Umsatzsteuer</H2>
      <Pp>Als Kleinunternehmer im Sinne von § 19 UStG wird keine Umsatzsteuer berechnet und ausgewiesen.</Pp>

      <H2>Verbraucherstreitbeilegung</H2>
      <Pp>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </Pp>

      <H2>Haftung für Inhalte und Preise</H2>
      <Pp>
        EnergyHunt bündelt öffentlich verfügbare Angebotsdaten der genannten Händler zu Informationszwecken.
        Für die Richtigkeit, Vollständigkeit und Aktualität der dargestellten Preise und Angebote wird keine
        Gewähr übernommen; maßgeblich ist stets das Angebot des jeweiligen Händlers am Point of Sale. EnergyHunt
        ist kein Verkäufer der beworbenen Produkte und steht in keiner Geschäftsbeziehung zu den genannten Marken
        oder Händlern.
      </Pp>

      <H2>Hinweis zu Marken</H2>
      <Pp>
        EnergyHunt ist ein unabhängiges, inoffizielles Projekt und wird von den genannten Marken nicht autorisiert,
        gesponsert oder geprüft – u. a. nicht von Monster Energy, Red Bull, Rockstar oder GÖNRGY. Alle Marken-,
        Produkt- und Händlernamen sowie Logos sind Eigentum ihrer jeweiligen Inhaber und dienen hier ausschließlich
        der Beschreibung der jeweiligen Angebote.
      </Pp>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <Pp>Stand: {TODAY_YEAR}. Diese Erklärung beschreibt, wie EnergyHunt personenbezogene Daten verarbeitet.</Pp>

      <H2>1. Verantwortlicher</H2>
      <Pp>
        Verantwortlich im Sinne der DSGVO ist der im <a className="text-accent-strong underline" href="#/impressum">Impressum</a> genannte
        Diensteanbieter. Kontakt für Datenschutzanliegen: kontakt@energyhunt.de.
      </Pp>

      <H2>2. Aufruf der Website (Hosting)</H2>
      <Pp>
        Die Website wird bei Cloudflare (Cloudflare, Inc. bzw. Cloudflare Germany GmbH) über Cloudflare Pages und
        Workers gehostet. Beim Aufruf verarbeitet Cloudflare technisch notwendige Verbindungsdaten (u. a. IP-Adresse,
        Zeitpunkt, angeforderte Ressource, User-Agent), um die Seite auszuliefern und die Sicherheit zu gewährleisten.
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem, stabilem Betrieb).
      </Pp>
      <Pp>
        Cloudflare kann Daten auch in Drittländern (u. a. USA) verarbeiten; Grundlage sind die EU-Standardvertragsklauseln.
        Auftragsverarbeitungsvertrag liegt vor.
      </Pp>

      <H2>3. Bestpreis-Alarm</H2>
      <H3>a) E-Mail</H3>
      <Pp>
        Meldest du dich für einen E-Mail-Alarm an, speichern wir deine E-Mail-Adresse sowie das/die beobachtete(n)
        Produkt(e)/Marke(n). Die Anmeldung erfolgt im Double-Opt-In: Du erhältst zunächst eine Bestätigungsmail und
        wirst erst nach Klick auf den Bestätigungslink in den Verteiler aufgenommen. Rechtsgrundlage ist deine
        Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst dich jederzeit über den Abmeldelink in jeder Mail abmelden.
        Der Versand der Transaktionsmails erfolgt über Brevo (Sendinblue GmbH, Köln); ein Auftragsverarbeitungsvertrag
        liegt vor.
      </Pp>
      <H3>b) Telegram</H3>
      <Pp>
        Aktivierst du den Alarm per Telegram, speichern wir deine Telegram-Chat-ID sowie die beobachteten Produkte/Marken,
        um dir Nachrichten zusenden zu können. Der Nachrichtenversand läuft über die Telegram Bot API (Telegram FZ-LLC).
        Für die Nutzung von Telegram gilt zusätzlich deren Datenschutzerklärung. Rechtsgrundlage ist deine Einwilligung
        (Art. 6 Abs. 1 lit. a DSGVO); mit <em>/stop</em> im Bot meldest du dich ab.
      </Pp>
      <H3>c) Push-Benachrichtigungen</H3>
      <Pp>
        Für Web-Push speichern wir die von deinem Browser erzeugte Push-Subscription (Endpunkt-URL und Schlüssel) sowie
        die beobachteten Produkte/Marken. Die Zustellung erfolgt über den Push-Dienst deines Browsers (z. B. Google FCM,
        Mozilla, Apple). Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du durch die
        Browser-Erlaubnis erteilst und in den Website-Einstellungen deines Browsers jederzeit widerrufen kannst.
      </Pp>
      <Pp>
        Die Abo-Daten werden in einer Cloudflare-D1-Datenbank gespeichert und nur zur Zustellung der von dir
        angeforderten Alarme genutzt. Wir löschen sie, sobald du dich abmeldest.
      </Pp>

      <H2>4. Zahlungsabwicklung (Pro)</H2>
      <Pp>
        Für kostenpflichtige Pro-Funktionen nutzen wir Stripe (Stripe Payments Europe, Ltd.). Bei einem Kauf werden die
        für die Zahlung erforderlichen Daten (u. a. E-Mail-Adresse, Zahlungsdaten) direkt an Stripe übermittelt und dort
        verarbeitet; wir selbst speichern keine vollständigen Zahlungsdaten. Rechtsgrundlage ist die Vertragserfüllung
        (Art. 6 Abs. 1 lit. b DSGVO). Es gilt zusätzlich die Datenschutzerklärung von Stripe.
      </Pp>

      <H2>5. Deine Rechte</H2>
      <Pp>
        Dir stehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung
        (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) zu. Erteilte Einwilligungen kannst du
        jederzeit mit Wirkung für die Zukunft widerrufen. Außerdem hast du ein Beschwerderecht bei einer
        Aufsichtsbehörde (Art. 77 DSGVO). Wende dich dafür an kontakt@energyhunt.de.
      </Pp>

      <H2>6. Speicherdauer</H2>
      <Pp>
        Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist bzw. bis zu
        deinem Widerruf/deiner Abmeldung. Für Zahlungen gelten gesetzliche Aufbewahrungsfristen.
      </Pp>
    </>
  );
}

function AGB() {
  return (
    <>
      <H2>§ 1 Geltungsbereich und Anbieter</H2>
      <Pp>
        Diese Allgemeinen Geschäftsbedingungen gelten für die über EnergyHunt angebotenen kostenpflichtigen
        „Pro"-Leistungen zwischen dem im <a className="text-accent-strong underline" href="#/impressum">Impressum</a> genannten
        Anbieter und dir als Verbraucher. Der kostenlose Basisdienst (Angebotsübersicht, ein Alarm) ist von diesen
        Bedingungen unberührt.
      </Pp>

      <H2>§ 2 Leistungsbeschreibung</H2>
      <Pp>
        Pro erweitert den Bestpreis-Alarm um beliebig viele beobachtete Marken sowie individuelle Preiswecker mit
        Wunschpreis. EnergyHunt liefert Informationen über Angebote Dritter und verkauft die beworbenen Produkte nicht
        selbst. Ein bestimmter Erfolg (z. B. das Auftreten eines bestimmten Preises) wird nicht geschuldet.
      </Pp>

      <H2>§ 3 Vertragsschluss</H2>
      <Pp>
        Die Darstellung der Pro-Pläne ist eine Aufforderung zur Abgabe eines Angebots. Mit Auswahl eines Plans und
        Abschluss des Bezahlvorgangs über Stripe gibst du ein verbindliches Angebot ab; der Vertrag kommt mit unserer
        Bestätigung bzw. der Freischaltung der Pro-Funktion zustande.
      </Pp>

      <H2>§ 4 Preise und Zahlung</H2>
      <Pp>
        Es gelten die zum Zeitpunkt der Bestellung angezeigten Preise. Abrechnung und Zahlungsabwicklung erfolgen über
        Stripe. Bei Abo-Plänen (monatlich/jährlich) verlängert sich der Vertrag jeweils um die gewählte Laufzeit, sofern
        er nicht zum Laufzeitende gekündigt wird. Der Einmal-Kauf („Lifetime") ist eine einmalige Zahlung ohne
        wiederkehrende Abbuchung.
      </Pp>
      <Pp>Alle angezeigten Preise sind Endpreise. Als Kleinunternehmer gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</Pp>

      <H2>§ 5 Laufzeit und Kündigung</H2>
      <Pp>
        Abo-Verträge können jederzeit zum Ende der laufenden Abrechnungsperiode gekündigt werden, z. B. per E-Mail an
        kontakt@energyhunt.de. Bereits gezahlte Beträge für die laufende Periode werden nicht anteilig erstattet, soweit
        gesetzlich zulässig.
      </Pp>

      <H2>§ 6 Widerrufsrecht</H2>
      <Pp>
        Als Verbraucher steht dir ein gesetzliches Widerrufsrecht zu. Einzelheiten regelt die{" "}
        <a className="text-accent-strong underline" href="#/widerruf">Widerrufsbelehrung</a>.
      </Pp>

      <H2>§ 7 Haftung</H2>
      <Pp>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder
        Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und
        begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Für die Richtigkeit der von Dritten stammenden
        Angebotsdaten wird keine Haftung übernommen.
      </Pp>

      <H2>§ 8 Schlussbestimmungen</H2>
      <Pp>
        Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Sollte eine Bestimmung
        unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.
      </Pp>
    </>
  );
}

function Widerruf() {
  return (
    <>
      <H2>Widerrufsrecht</H2>
      <Pp>
        Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die
        Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses. Um dein Widerrufsrecht auszuüben, musst
        du uns (Kristof Kreimeyer, Bahnhofstr. 4, 59439 Holzwickede, kontakt@energyhunt.de) mittels einer eindeutigen Erklärung (z. B. ein
        mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen,
        informieren. Du kannst dafür das nachstehende Muster-Widerrufsformular verwenden, das jedoch nicht
        vorgeschrieben ist.
      </Pp>
      <Pp>
        Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor
        Ablauf der Widerrufsfrist absendest.
      </Pp>

      <H2>Folgen des Widerrufs</H2>
      <Pp>
        Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich
        und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei
        uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen
        Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall
        werden dir wegen dieser Rückzahlung Entgelte berechnet.
      </Pp>

      <H2>Vorzeitiges Erlöschen des Widerrufsrechts</H2>
      <Pp>
        Bei einem Vertrag über die Bereitstellung digitaler Inhalte, die nicht auf einem körperlichen Datenträger
        geliefert werden, erlischt das Widerrufsrecht, wenn wir mit der Ausführung begonnen haben, nachdem du
        ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, und du deine
        Kenntnis davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der Ausführung dein Widerrufsrecht
        verlierst.
      </Pp>

      <H2>Muster-Widerrufsformular</H2>
      <Pp>
        (Wenn du den Vertrag widerrufen willst, fülle dieses Formular aus und sende es zurück.)
      </Pp>
      <div className="rounded-lg border border-border-strong bg-surface-2 p-4 text-[0.88rem] leading-relaxed text-ink/90 space-y-2">
        <p>An Kristof Kreimeyer, Bahnhofstr. 4, 59439 Holzwickede, kontakt@energyhunt.de:</p>
        <p>
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden
          Dienstleistung (*):
        </p>
        <p>________________________________________________</p>
        <p>Bestellt am (*) / erhalten am (*): __________________</p>
        <p>Name des/der Verbraucher(s): _____________________</p>
        <p>Anschrift des/der Verbraucher(s): _________________</p>
        <p>Datum, Unterschrift (nur bei Mitteilung auf Papier): _______________</p>
        <p className="text-muted text-[0.8rem]">(*) Unzutreffendes streichen.</p>
      </div>
    </>
  );
}

const CONTENT: Record<LegalRoute, () => React.ReactElement> = {
  "#/impressum": Impressum,
  "#/datenschutz": Datenschutz,
  "#/agb": AGB,
  "#/widerruf": Widerruf,
};

export function LegalPage({ route }: { route: LegalRoute }) {
  const Body = CONTENT[route];
  return (
    <main id="main" className="py-8">
      <div className={WRAP}>
        <a href="#" className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-accent-strong hover:text-accent mb-4">
          <span aria-hidden="true">←</span> Zurück zur Übersicht
        </a>
        <h1 className="text-[1.7rem] font-bold text-ink tracking-[-0.02em] mb-1">{LEGAL_ROUTES[route]}</h1>
        <Body />
      </div>
    </main>
  );
}

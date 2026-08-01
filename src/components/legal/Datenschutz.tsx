import { H2, H3, Pp } from "./legalParts";

const TODAY_YEAR = new Date().getFullYear();

export function Datenschutz() {
  return (
    <>
      <Pp>
        Stand: {TODAY_YEAR}. Diese Erklärung beschreibt, wie EnergyHunt
        personenbezogene Daten verarbeitet.
      </Pp>

      <H2>1. Verantwortlicher</H2>
      <Pp>
        Verantwortlich im Sinne der DSGVO ist der im{" "}
        <a className="text-accent-strong underline" href="#/impressum">
          Impressum
        </a>{" "}
        genannte Diensteanbieter. Kontakt für Datenschutzanliegen:
        kontakt@kristof-kreimeyer.de.
      </Pp>

      <H2>2. Aufruf der Website (Hosting)</H2>
      <Pp>
        Die Website wird bei Cloudflare (Cloudflare, Inc. bzw. Cloudflare
        Germany GmbH) über Cloudflare Pages und Workers gehostet. Beim Aufruf
        verarbeitet Cloudflare technisch notwendige Verbindungsdaten (u. a.
        IP-Adresse, Zeitpunkt, angeforderte Ressource, User-Agent), um die Seite
        auszuliefern und die Sicherheit zu gewährleisten. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem, stabilem
        Betrieb).
      </Pp>
      <Pp>
        Cloudflare kann Daten auch in Drittländern (u. a. USA) verarbeiten;
        Grundlage sind die EU-Standardvertragsklauseln.
        Auftragsverarbeitungsvertrag liegt vor.
      </Pp>

      <H2>3. Bestpreis-Alarm</H2>
      <H3>a) E-Mail</H3>
      <Pp>
        Meldest du dich für einen E-Mail-Alarm an, speichern wir deine
        E-Mail-Adresse sowie das/die beobachtete(n) Produkt(e)/Marke(n). Die
        Anmeldung erfolgt im Double-Opt-In: Du erhältst zunächst eine
        Bestätigungsmail und wirst erst nach Klick auf den Bestätigungslink in
        den Verteiler aufgenommen. Rechtsgrundlage ist deine Einwilligung (Art.
        6 Abs. 1 lit. a DSGVO). Du kannst dich jederzeit über den Abmeldelink in
        jeder Mail abmelden. Der Versand der Transaktionsmails erfolgt über
        Brevo (Sendinblue GmbH, Köln); ein Auftragsverarbeitungsvertrag liegt
        vor.
      </Pp>
      <H3>b) Telegram</H3>
      <Pp>
        Aktivierst du den Alarm per Telegram, speichern wir deine
        Telegram-Chat-ID sowie die beobachteten Produkte/Marken, um dir
        Nachrichten zusenden zu können. Der Nachrichtenversand läuft über die
        Telegram Bot API (Telegram FZ-LLC). Für die Nutzung von Telegram gilt
        zusätzlich deren Datenschutzerklärung. Rechtsgrundlage ist deine
        Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); mit <em>/stop</em> im Bot
        meldest du dich ab.
      </Pp>
      <H3>c) Push-Benachrichtigungen</H3>
      <Pp>
        Für Web-Push speichern wir die von deinem Browser erzeugte
        Push-Subscription (Endpunkt-URL und Schlüssel) sowie die beobachteten
        Produkte/Marken. Die Zustellung erfolgt über den Push-Dienst deines
        Browsers (z. B. Google FCM, Mozilla, Apple). Rechtsgrundlage ist deine
        Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du durch die
        Browser-Erlaubnis erteilst und in den Website-Einstellungen deines
        Browsers jederzeit widerrufen kannst.
      </Pp>
      <Pp>
        Die Abo-Daten werden in einer Cloudflare-D1-Datenbank gespeichert und
        nur zur Zustellung der von dir angeforderten Alarme genutzt. Wir löschen
        sie, sobald du dich abmeldest.
      </Pp>

      <H2>4. Zahlungsabwicklung (Pro)</H2>
      <Pp>
        Für kostenpflichtige Pro-Funktionen nutzen wir Stripe (Stripe Payments
        Europe, Ltd.). Bei einem Kauf werden die für die Zahlung erforderlichen
        Daten (u. a. E-Mail-Adresse, Zahlungsdaten) direkt an Stripe übermittelt
        und dort verarbeitet; wir selbst speichern keine vollständigen
        Zahlungsdaten. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1
        lit. b DSGVO). Es gilt zusätzlich die Datenschutzerklärung von Stripe.
      </Pp>

      <H2>5. Deine Rechte</H2>
      <Pp>
        Dir stehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16),
        Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art.
        20) und Widerspruch (Art. 21) zu. Erteilte Einwilligungen kannst du
        jederzeit mit Wirkung für die Zukunft widerrufen. Außerdem hast du ein
        Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO). Wende dich
        dafür an kontakt@kristof-kreimeyer.de.
      </Pp>

      <H2>6. Speicherdauer</H2>
      <Pp>
        Wir speichern personenbezogene Daten nur so lange, wie es für den
        jeweiligen Zweck erforderlich ist bzw. bis zu deinem Widerruf/deiner
        Abmeldung. Für Zahlungen gelten gesetzliche Aufbewahrungsfristen.
      </Pp>
    </>
  );
}

import { H2, Pp } from "./legalParts";

export function Widerruf() {
  return (
    <>
      <H2>Widerrufsrecht</H2>
      <Pp>
        Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen
        Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem
        Tag des Vertragsschlusses. Um dein Widerrufsrecht auszuüben, musst du
        uns (Kristof Kreimeyer, Bahnhofstr. 4, 59439 Holzwickede,
        kontakt@kristof-kreimeyer.de) mittels einer eindeutigen Erklärung (z. B. ein
        mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss,
        diesen Vertrag zu widerrufen, informieren. Du kannst dafür das
        nachstehende Muster-Widerrufsformular verwenden, das jedoch nicht
        vorgeschrieben ist.
      </Pp>
      <Pp>
        Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung
        über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist
        absendest.
      </Pp>

      <H2>Folgen des Widerrufs</H2>
      <Pp>
        Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir
        von dir erhalten haben, unverzüglich und spätestens binnen vierzehn
        Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen
        Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir
        dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion
        eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes
        vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte
        berechnet.
      </Pp>

      <H2>Vorzeitiges Erlöschen des Widerrufsrechts</H2>
      <Pp>
        Bei einem Vertrag über die Bereitstellung digitaler Inhalte, die nicht
        auf einem körperlichen Datenträger geliefert werden, erlischt das
        Widerrufsrecht, wenn wir mit der Ausführung begonnen haben, nachdem du
        ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist mit
        der Ausführung beginnen, und du deine Kenntnis davon bestätigt hast,
        dass du durch deine Zustimmung mit Beginn der Ausführung dein
        Widerrufsrecht verlierst.
      </Pp>

      <H2>Muster-Widerrufsformular</H2>
      <Pp>
        (Wenn du den Vertrag widerrufen willst, fülle dieses Formular aus und
        sende es zurück.)
      </Pp>
      <div className="rounded-lg border border-border-strong bg-surface-2 p-4 text-[0.88rem] leading-relaxed text-ink/90 space-y-2">
        <p>
          An Kristof Kreimeyer, Bahnhofstr. 4, 59439 Holzwickede,
          kontakt@kristof-kreimeyer.de:
        </p>
        <p>
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen
          Vertrag über den Kauf der folgenden Dienstleistung (*):
        </p>
        <p>________________________________________________</p>
        <p>Bestellt am (*) / erhalten am (*): __________________</p>
        <p>Name des/der Verbraucher(s): _____________________</p>
        <p>Anschrift des/der Verbraucher(s): _________________</p>
        <p>
          Datum, Unterschrift (nur bei Mitteilung auf Papier): _______________
        </p>
        <p className="text-muted text-[0.8rem]">
          (*) Unzutreffendes streichen.
        </p>
      </div>
    </>
  );
}

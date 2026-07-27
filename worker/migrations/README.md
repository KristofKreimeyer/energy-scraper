# D1-Migrationen – Konvention

`wrangler d1 migrations apply` führt die Statements eines Files **nicht
transaktional** aus: Bricht ein Statement in der Mitte ab, sind die davor schon
angewandt, das File gilt aber als **nicht** migriert. Beim nächsten Deploy läuft
es erneut – und stolpert über die bereits angelegten Objekte (`duplicate column
name`, `table already exists`). Der Deploy bleibt dann **dauerhaft** hängen, bis
man den Remote-Zustand von Hand geradezieht.

Damit das gar nicht erst passiert:

## Regeln beim Anlegen einer Migration

1. **Idempotent, wo SQLite es erlaubt.** Immer
   `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.
2. **Ein riskantes Statement pro File.** `ALTER TABLE … ADD COLUMN` kennt in
   SQLite **kein** `IF NOT EXISTS`. Solche Statements deshalb nicht mit anderem
   DDL in ein File mischen – je ein `ADD COLUMN` in ein eigenes, kleines
   Migrationsfile. Bricht dann etwas ab, ist der Schaden auf genau dieses eine
   Statement begrenzt und leicht zu reparieren.
3. **Nur anhängen, nie ändern.** Bereits deployte Files nicht nachträglich
   editieren – der Tracker (`d1_migrations`) erkennt sie nur am Namen, nicht am
   Inhalt. Korrekturen kommen als neues, höher nummeriertes File.
4. **Lokal testen vor dem Push:**
   `npm run db:migrate:local` gegen eine frische lokale DB.

## Recovery, wenn ein File halb angewandt feststeckt

Symptom: `deploy-worker` scheitert reproduzierbar mit `duplicate column name`
o. ä., und `SELECT name FROM d1_migrations` zeigt das File **nicht**.

Von Hand gegen die Remote-DB (Auth: `wrangler login` mit dem Account, dem die DB
gehört – **nicht** über eine leere `CLOUDFLARE_API_TOKEN`-Env, sonst `code 7403`):

```bash
cd worker
# 1) Fehlende Objekte nachziehen – schon vorhandene erzeugen "duplicate …",
#    das ist hier ok und wird ignoriert:
npx wrangler d1 execute energyHunt --remote --command "ALTER TABLE <tabelle> ADD COLUMN <spalte> <typ>;"
# 2) File als angewandt markieren (Name exakt wie im migrations/-Ordner):
npx wrangler d1 execute energyHunt --remote --command "INSERT INTO d1_migrations (name) VALUES ('<file>.sql');"
# 3) Kontrolle – das File muss jetzt gelistet sein:
npx wrangler d1 execute energyHunt --remote --command "SELECT name FROM d1_migrations ORDER BY id;"
```

Danach `deploy-worker` erneut anstoßen – die Migration wird übersprungen.

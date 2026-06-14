# S9Lab Status Page

Fertige statische Statusseite für GitHub Pages. Sie prüft dein Backend alle fünf Minuten über GitHub Actions, speichert den aktuellen Zustand und dokumentiert neue Ausfälle automatisch.

## Überwachte Endpunkte

- `GET /health`
- `GET /api/v1/cosmetics`

Nicht öffentlich überwacht werden geschützte Session-, Profil-, Shop- und Admin-Endpunkte. Admin-Secrets gehören niemals in dieses Repository.

## Veröffentlichung auf GitHub Pages

1. Erstelle ein neues öffentliches oder privates GitHub-Repository.
2. Lade den kompletten Inhalt dieses Ordners hoch und pushe ihn auf den Branch `main`.
3. Öffne im Repository **Settings → Pages**.
4. Wähle bei **Build and deployment** die Quelle **GitHub Actions**.
5. Öffne **Settings → Secrets and variables → Actions → Variables**.
6. Lege die Repository-Variable `S9LAB_BACKEND_URL` an, zum Beispiel:

```text
http://31.70.89.55:25614
```

7. Starte unter **Actions → Update status data → Run workflow** die erste Prüfung manuell.

Danach aktualisiert sich die Statusseite automatisch. GitHub kann geplante Workflows leicht verzögert ausführen; der Cron-Takt ist auf fünf Minuten gesetzt.

## Domain und sichtbare Texte ändern

In `config.js` kannst du Namen, Links und das Aktualisierungsintervall der Seite ändern. Die GitHub-Action verwendet für echte Prüfungen die Repository-Variable `S9LAB_BACKEND_URL`.

## Warum nicht direkt aus dem Browser?

GitHub Pages wird per HTTPS ausgeliefert. Browser blockieren direkte Requests von einer HTTPS-Seite an ein unverschlüsseltes HTTP-Backend als Mixed Content. Der GitHub-Runner kann dein HTTP-Backend trotzdem prüfen und schreibt das Ergebnis anschließend in `data/status.json`.

Für echte Live-Abfragen im Browser brauchst du später eine HTTPS-Domain bzw. einen Reverse Proxy mit TLS vor deinem Backend.

## Lokaler Test

```bash
node scripts/check-status.mjs
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Incident-Logik

- Wechselt der Gesamtstatus von online auf beeinträchtigt/ausgefallen, wird ein neuer Vorfall angelegt.
- Wird der Dienst wieder erreichbar, wird der offene Vorfall automatisch als behoben markiert.
- Die letzten 90 Tageseinträge und maximal 100 Vorfälle werden gespeichert.

# Einkaufsliste für die Familie

Gemeinsame Einkaufsliste im Browser. Jeder mit dem Link sieht dieselbe Liste live, kann eintragen, abhaken und löschen. Läuft als statische Seite auf GitHub Pages, die Daten liegen in einer Firebase Realtime Database (kostenloser Spark-Tarif reicht locker).

## Funktionen

- Artikel mit optionaler Menge eintragen
- Abhaken / wieder öffnen, mit „abgehakt von …“
- Löschen mit Rückgängig, „Erledigte löschen“ auf einen Klick
- Live-Sync auf allen Geräten, Offline-Änderungen werden nachgeholt
- Auf den Homescreen legbar (iPhone: Teilen → „Zum Home-Bildschirm“)
- Dark Mode automatisch

## Wie die Liste geteilt wird

Beim ersten Öffnen erzeugt die Seite einen langen Zufallscode und hängt ihn an die URL (`…/#x3m4d5kc…`). Diesen Link über den Teilen-Button an die Familie schicken – alle mit diesem Link landen in derselben Liste. Ohne den Code kommt niemand an die Daten (siehe Regeln unten).

## Einrichtung

### 1. GitHub Pages

Repo → **Settings → Pages** → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → Save. Nach 1–2 Minuten läuft die Seite unter `https://<benutzer>.github.io/<repo>/`.

Bis Schritt 2 erledigt ist, läuft sie im **Demo-Modus** (nur lokal auf dem Gerät).

### 2. Firebase (Datenbank für die gemeinsame Liste)

1. <https://console.firebase.google.com> → **Projekt hinzufügen** (Google Analytics kann aus).
2. Links **Build → Realtime Database → Datenbank erstellen** → Standort `europe-west1` → im **gesperrten Modus** starten.
3. Reiter **Regeln**: Inhalt von `database.rules.json` reinkopieren → **Veröffentlichen**.
4. **Projektübersicht → Web-App hinzufügen** (`</>`-Symbol), Name egal, kein Hosting. Die angezeigten Werte (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`) in `config.js` eintragen und committen.

Die Werte in `config.js` sind kein Geheimnis – Firebase-Web-Configs sind dafür gedacht, öffentlich im Frontend zu stehen. Geschützt wird über die Regeln.

### Sicherheitsmodell (kurz)

- Root ist komplett gesperrt, man kann also nicht alle Listen auflisten.
- Lesen/Schreiben nur unter `lists/<code>`, und der Code muss mindestens 16 Zeichen haben (die Seite erzeugt 18 aus 32 Zeichen ≈ 90 Bit, praktisch nicht zu erraten).
- Die Regeln prüfen Felder und Längen, damit niemand Müll oder riesige Datenmengen reinschreibt.
- Wer den Link hat, hat Zugriff. Für eine Familien-Einkaufsliste reicht das; wenn der Link mal rausgeht, einfach in einem privaten Tab ohne `#…` öffnen → neue Liste mit neuem Code.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | Die App |
| `config.js` | Firebase-Zugangsdaten (Schritt 2) |
| `database.rules.json` | Sicherheitsregeln für Firebase |
| `manifest.webmanifest`, `sw.js`, `icon*` | Homescreen-App und Offline-Start |

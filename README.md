# Dawam (دوام) — Attendance & Payroll Hours App

> PWA for employee attendance tracking, overtime calculations, late penalty cycles, and monthly payroll summaries.
> Built with pure HTML5, CSS3 (Logical Properties, Cyber/Neon Dark/Light), and Modern Vanilla ES Modules.
> Works 100% offline via Service Worker, installable on Android and iPhone home screens.

---

## 🔒 Security & Privacy Notice
> **Important**: This is a client-side application running on GitHub Pages or any static file server using static JSON and `localStorage`. There is no backend database or real server security. Keep this repository **PRIVATE** if it contains real employee records, personal data, or wage details. User passwords stored in the JSON database are salted SHA-256 hashes, never plain text.

---

## 🚀 Getting Started

### Running Locally
Because the app uses standard ES modules (`type="module"`), it must be served over HTTP/HTTPS rather than `file://`:

```bash
# Using python 3
python -m http.server 8080

# Or using Node http-server or npx serve
npx serve .
```

Open your browser at `http://localhost:8080`.

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123`
*(On first login, admin will be prompted to set a new password).*

---

## 📱 Mobile PWA Installation
1. Open the app URL in Chrome (Android) or Safari (iOS).
2. Android: Tap the three dots menu → **Add to Home screen** / **Install app**.
3. iOS: Tap the Share button → **Add to Home Screen**.
4. The app runs in standalone fullscreen mode and works completely offline.

---

## 💾 Data Backup & Sync
- **Local Storage**: Working data is stored in browser `localStorage`.
- **Export/Import**: Full JSON database can be exported as a backup or imported anytime.
- **GitHub Sync**: Connect to your private GitHub repository via Personal Access Token to commit and backup `data/db.json` automatically.

---

## 🛠️ Architecture
- `docs/PLAN.md` — Authoritative project specifications and rules.
- `js/core/store.js` — Single source of truth for all data reads/writes.
- `js/core/i18n.js` — Arabic (RTL default) and English (LTR) language system.
- `js/engine/calc.js` — Pure calculation functions (all calculations in integer minutes).
- `css/` — Cyber/Neon design system with CSS custom properties and logical properties.

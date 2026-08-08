# What changed and how to run this

## 1. Setup

```bash
npm install
node server.js
```

Site: http://localhost:3000
Admin panel: http://localhost:3000/admin

A `.env` file is already included so it runs out of the box.

**Default admin login (this audit round):**
- Username: `admin`
- Password: `ChangeMe#2026!`

⚠️ **Change this password before putting the site live.** Run:

```bash
node generateAdminHash.js YourNewPassword
```

Copy the printed hash into `.env` as `ADMIN_PASSWORD_HASH`.

Also fill in the email / Twilio WhatsApp settings in `.env` if you want
job-application and contact-form notifications to actually send.
`.env` is already in place — you don't need to create one. It is listed in
`.gitignore` so it will never get committed.

## 2. How the no-code section editor works

Log into `/admin` → go to the **Sections** tab.

- **Add Section**: fill the form and save. It's inserted at the **top** of
  the page automatically (existing sections shift down) and gets added to
  the top nav menu.
- **Edit**: click edit on any existing section, change it, save.
- **Delete**: click delete — it's removed from the page and the nav menu.
- Sections you add show up between the built-in sections and the Contact
  section on the live site, newest on top.

No coding needed for any of this — it's all driven by `data/sections.json`
and `data/navbar.json`, which the admin panel edits through the API.

## 3. Bugs I found and fixed

Your original zip had the admin-editing pieces mostly built, but several
things were broken or not wired together. Here's exactly what changed:

1. **No login protection.** `middleware/auth.js` (`requireAdmin`) existed
   but wasn't applied to any route — anyone who found the API URLs could
   create/edit/delete sections, jobs, or the nav menu without logging in.
   Now applied to the write routes in `routes/sections.js`, `routes/navbar.js`,
   and `routes/jobs.js`.

2. **New sections went to the bottom, not the top.** `routes/sections.js`
   now defaults new sections to position 0 and pushes everything else down,
   unless you explicitly pass an `order` value (used by the reorder feature).

3. **Login was hardcoded** to the password `admin123` directly in
   `routes/auth.js`, ignoring `.env` completely. Rewritten to check
   `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` from `.env` with bcrypt.

4. **Admin panel couldn't detect a logged-in session.** The frontend
   (`admin.js`) called `/api/auth/status` expecting `{ loggedIn }`, but the
   backend only had `/api/auth/check` returning `{ isAdmin }`. Added a
   matching `/status` route so the dashboard actually loads after login.

5. **`/api/navbar` route existed but was never mounted** in `server.js`.
   The public site's nav bar fetches this endpoint to show links to your
   dynamic sections — it was silently failing before. Now mounted.

6. **`data/sections.json` was in the wrong format** (a bare `[]` instead of
   `{ "sections": [] }`), which crashed section creation immediately. Fixed.

7. **No `.env` file was included**, so the session secret, admin password,
   and email/WhatsApp notification settings weren't configured at all.
   Added one with a random session secret and a working default login.

## 4. Full content editing (added in this round)

You asked for the admin to be able to edit or delete *all* existing content,
not just add new sections. That exposed a bigger problem: the site actually
had two disconnected content systems — the admin panel wrote to one file,
the live site read from a different one, and the API route that was
supposed to serve real content was just a stub returning
`{ "message": "Content API" }`. So almost nothing you edited in the old
admin panel ever showed up on the site. This is now fixed and consolidated
into one system, backed by `data/content.json` via `/api/content`.

The admin **Content** tab now has full editing for:
- **Hero** — headline, subheadline, button text/link, show/hide
- **Stats** — the 4 numbers in the hero bar, add/remove/edit any of them
- **About** — tag, title, description, company background, mission, image, show/hide
- **Values** — the 6 core-values cards, add/remove/edit any of them
- **Services** — section heading + the full services grid, add/remove/edit any card
- **Contact** — tag, title, subtitle, email, phone, address, show/hide
- **Footer** — company name, tagline, copyright text

Every section (except Hero/Footer, which are structural) has a **Visible**
checkbox — unticking it hides that whole section from the live site without
deleting your content, so it's easy to bring back later. This matches how
the dynamic sections you add already work.

**Icon keys**, used in Stats/Values/Services: `search, folder, user-plus,
credit-card, scale, shield-check, book-open, users, shield, star, zap,
heart, award, handshake, building, target, clock`. Any value not in that
list falls back to a default icon — type one of these exactly.

## 6. Login screen was completely missing (fixed this round)

You reported that `/admin` opened straight into the dashboard with no login,
and that your edits weren't showing up on the site. Both had the same root
cause: **the live admin panel had no login screen at all.** There was a
login form sitting in an unused file (`public/admin/admin.js`) that the
actual admin page never loaded — the real page just rendered the dashboard
immediately on load, with no way to authenticate. So every save you made
was being correctly rejected by the server as "not logged in," but you had
no way to log in to begin with.

Fixed: `/admin` now shows a real login screen first. It checks
`/api/auth/status` on load — if you're not logged in, you see a login
form; log in with your admin username/password and the dashboard appears.
There's also a **Log Out** link in the sidebar now, and if your session
ever expires while you're working, the next save attempt will bounce you
back to the login screen with a clear message instead of silently failing.

## 7. Where do added sections show up on the site?

Sections you create from the admin panel's **Sections** tab are inserted
into a container that sits **between the Services section and the Jobs
section** on the homepage (`<div id="dynamicSectionsContainer">` in
`public/index.html`). Within that container they're stacked in order —
and as covered above, a newly created section defaults to the top of that
stack, pushing earlier ones down.

They also get an automatic entry in the top navigation bar (you can turn
this off per-section with the "Show in Nav" toggle when creating/editing).

## 8. Things I didn't touch (worth knowing about)

- `routes/jobs.js` stores job listings **in memory only** — they disappear
  every time the server restarts. If you want job postings to persist,
  that route needs to be switched to read/write `data/jobs.json` like
  `sections.js` and `content.js` now do. Say the word and I'll do that too.
- `routes/posters.js` and `routes/heroImage.js` are still stub routes (they
  don't read/write the matching `data/*.json` files). If you want the
  admin panel's Posters and Hero Image tabs to actually save changes,
  those need the same treatment `content.js` just got.

## 9. Security & stability audit (this round)

A full audit was done across the backend, admin panel, and public site.
Full details are in the Fix Log delivered alongside this codebase. Summary
of what changed:

- **Stored XSS (critical):** admin-editable content (job titles, section
  text, values/services copy, poster captions, nav labels) was inserted
  into both the public site and the admin panel via `innerHTML` with no
  escaping. Any of those fields containing `<script>` would have executed
  for every visitor. All dynamic text now goes through an `escapeHtml()`
  helper; color values that get interpolated into `style=""` attributes go
  through a separate `sanitizeCssColor()` allow-list. Two fields
  (`about.description` and the "custom" section type's HTML) are left
  unescaped by design — they're admin-only rich-text/embed fields, same as
  before, just now clearly commented as such.
- **CSRF:** added a per-session CSRF token, issued via `/api/auth/status`
  and `/api/auth/login`, required as an `X-CSRF-Token` header on every
  admin write request. Session cookies are also now `sameSite: 'lax'`,
  which independently blocks most cross-site form submissions.
- **Session security:** cookies are `httpOnly`, `sameSite: 'lax'`, and
  `secure` in production. The session is regenerated on login (prevents
  session fixation). `SESSION_SECRET` now fails the app at startup in
  production if it's missing or still the placeholder value.
- **Rate limiting:** login is limited to 10 attempts / 15 minutes; the
  contact/apply/hire forms are limited to 20 submissions / 15 minutes per
  IP, to slow down brute-force and spam/notification-flooding abuse.
- **Security headers:** added via `helmet` — Content-Security-Policy,
  X-Frame-Options, X-Content-Type-Options, and friends.
- **File uploads:** poster and hero-image uploads are now restricted to a
  whitelist of real raster image mimetypes (JPG/PNG/GIF/WEBP) — SVG is
  excluded because it can carry `<script>` and was previously accepted.
  Resume uploads cross-check the file extension against its declared
  mimetype. Uploaded filenames are now randomized server-side rather than
  trusting the client's filename/extension.
- **Hardcoded credentials:** none were found hardcoded in source (the
  previous round already moved these to `.env`), but `.env` itself was
  missing from the delivered zip despite the README saying it was
  included. It's now present, with a freshly generated random
  `SESSION_SECRET` and a working default admin login (see above), and is
  listed in the new `.gitignore`.
- **Error handling:** API error responses no longer leak raw
  `err.message`/stack traces (which could include file paths) to the
  client; full details are still logged server-side via `console.error`.
- **Input validation:** contact/apply/hire forms now validate email format
  and cap field lengths server-side; navbar/content PUT endpoints validate
  the shape of the request body before writing to disk.
- **`heroImage` route was a non-functional stub** (`GET / -> {url:''}`,
  no POST/DELETE at all) — implemented properly, matching the pattern
  already used for posters. Note: the admin panel UI doesn't yet have a
  "Hero Image" tab to drive this — the backend is ready, but wiring up
  that tab is a small follow-up if you want it.
- **Dead code removed:** `public/admin/admin.js` was never loaded by
  `admin/index.html` (it references an old, incompatible content schema)
  — deleted to avoid confusion.
- **Mobile touch targets:** the hamburger menu button (`.mobile-toggle`)
  had no explicit size, so its actual tap target was just the glyph itself
  (~24px) — given an explicit 44×44px minimum tap area.
- **Removed the unused `cors` dependency** (frontend and API are served
  from the same origin, so it was never actually required) and lowered the
  JSON/urlencoded body size limit from 50mb to 1mb (uploads go through
  multer with their own explicit limits instead).

# Warehouse Runner App — Implementation Plan (v1)

**Project:** Concession restocking app for warehouse runners at Greater Nevada Field (Reno Aces), Reno, NV
**Purpose of this document:** A complete, hand-off-ready spec for Claude Code to implement v1. It covers the architecture, the full Supabase setup (with copy-paste SQL), the data model, every screen, the realtime queue logic, and a phased build order.

---

## 1. Overview & Goals

Warehouse runners restock concession stands throughout the ballpark from a centralized warehouse behind Concession Stand 1. The app supports two workflows:

1. **Pre-game restocking** — one runner surveys each stand (mostly empty stadium), enters judgment-based quantities needed per item, then pulls a cart pick list at the warehouse.
2. **In-game restocking** — stand workers or runners create restock requests; any available runner accepts a request (first-come, first-served), completes it, and marks it done.

### v1 design constraints (decided)
- **Platform:** Progressive Web App (PWA), installable to the home screen. Runs on personal phones (BYOD). No app stores.
- **Auth:** No passwords. Stand workers pick their stand; runners pick their name from a list. Managers get a lightweight gate (see §7).
- **Connectivity:** Reliable WiFi/cell throughout the stadium — always-online app, no offline sync required.
- **Database:** Supabase (Postgres + Realtime).
- **Master inventory:** Changes rarely; managers edit occasionally. Each stand carries a known **subset** (catalog) of the master list.
- **Quantities:** Judgment call by the runner — no par-level math.
- **Queue priority:** First-come, first-served. No urgency levels in v1.
- **Stand identification:** Both QR scan and pick-from-list, everywhere.

### Explicit non-goals for v1
Offline mode, push notifications, performance analytics, priority/urgency levels, real user accounts/passwords for workers and runners, native app, mid-game inventory edits.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Front-end | **React + Vite** | Fast dev, simple PWA setup |
| PWA | **vite-plugin-pwa** | Manifest + service worker, "Add to Home Screen" |
| Styling | **Tailwind CSS** | Mobile-first, large tap targets |
| Routing | **React Router** | A handful of routes |
| State/data | **@supabase/supabase-js** | DB queries + Realtime subscriptions |
| QR scanning | **html5-qrcode** (or `@yudiel/react-qr-scanner`) | Uses device camera in-browser |
| Backend/DB | **Supabase** | Postgres, Realtime, Row Level Security |
| Hosting | **Vercel** or **Netlify** | Free tier, connects to the GitHub repo, HTTPS (required for PWA + camera) |

**Important:** The camera (QR scanning) and PWA install both require **HTTPS**. Vercel/Netlify provide this automatically. Local dev works on `localhost` (treated as secure).

---

## 3. Supabase Setup — Step by Step

These are written for someone new to Supabase. Do them in order.

### 3.1 Create the project
1. Go to https://supabase.com and open your dashboard.
2. **New project** → name it e.g. `aces-warehouse-runner`. Choose a region close to Reno (e.g. **West US / Oregon**). Set a database password and save it in your password manager.
3. Wait for provisioning (~2 min).

### 3.2 Get your API keys
1. In the project, go to **Project Settings → API**.
2. Copy two values into a safe place — they go in the front-end `.env` file:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. The `anon` key is safe to ship in a client app **because** Row Level Security (RLS) controls what it can do (configured below).

### 3.3 Create the schema
1. Go to **SQL Editor → New query**.
2. Paste the full SQL in §4 and click **Run**. This creates all tables, indexes, and the realtime/RLS configuration.

### 3.4 Enable Realtime
The SQL in §4 already adds the `requests` and `request_items` tables to the realtime publication. To confirm: **Database → Replication → `supabase_realtime`** should list those tables. (If you prefer the UI: toggle Realtime on for those tables.)

### 3.5 Seed data
After the schema is in, load your master inventory and stands. Two options:
- **Manager screen** in the app (built in Phase 4) — recommended for ongoing edits.
- **CSV import** for the first bulk load: **Table Editor → select table → Insert → Import data from CSV**. See §8 for the exact CSV columns and a recommended order.

### 3.6 A note on RLS for v1
Because v1 has no real authentication, the app uses the public `anon` key and we set **permissive RLS policies** (anyone with the app can read/write the operational tables). This is acceptable for an internal proof-of-concept on a non-sensitive dataset. §10 describes how to tighten this when you add real auth.

---

## 4. Data Model (copy-paste SQL)

Run this whole block in the Supabase SQL Editor.

```sql
-- ============ EXTENSIONS ============
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ============ MASTER INVENTORY ============
create table items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text,                       -- e.g. 'soda','beer','candy','frozen','bakery'
  unit        text,                       -- e.g. 'case','each','bag','box'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============ STANDS ============
create table stands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,            -- 'Dippin Dots', 'Stand 3 (Blaze Pizza)'
  number        text,                     -- nullable; some stands are by name only
  stand_type    text not null default 'permanent',  -- 'permanent' | 'mobile' | 'third_party'
  location_note text,                     -- 'Main concourse, 3rd base side'
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============ PER-STAND CATALOG (which items each stand carries) ============
create table stand_items (
  stand_id  uuid not null references stands(id) on delete cascade,
  item_id   uuid not null references items(id)  on delete cascade,
  primary key (stand_id, item_id)
);

-- ============ RUNNERS (name-only roster for v1) ============
create table runners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ SURVEYS (pre-game) ============
-- One survey = one runner's pass over one stand, producing a pick list.
create table surveys (
  id          uuid primary key default gen_random_uuid(),
  stand_id    uuid not null references stands(id),
  runner_id   uuid references runners(id),
  status      text not null default 'open',   -- 'open' | 'picked' | 'done'
  created_at  timestamptz not null default now()
);

create table survey_items (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references surveys(id) on delete cascade,
  item_id    uuid not null references items(id),
  qty_needed integer not null check (qty_needed >= 0)
);

-- ============ REQUESTS (in-game queue) ============
create table requests (
  id            uuid primary key default gen_random_uuid(),
  stand_id      uuid not null references stands(id),
  created_by    text not null,                 -- 'stand:<name>' or 'runner:<name>' (free text label for v1)
  status        text not null default 'open',  -- 'open' | 'accepted' | 'done' | 'cancelled'
  accepted_by   uuid references runners(id),   -- the runner who claimed it
  note          text,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  completed_at  timestamptz
);

create table request_items (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests(id) on delete cascade,
  item_id     uuid not null references items(id),
  qty         integer not null check (qty > 0)
);

-- ============ INDEXES ============
create index on stand_items (stand_id);
create index on stand_items (item_id);
create index on requests (status, created_at);
create index on request_items (request_id);
create index on survey_items (survey_id);

-- ============ RLS (v1: permissive, anon key) ============
alter table items         enable row level security;
alter table stands        enable row level security;
alter table stand_items   enable row level security;
alter table runners       enable row level security;
alter table surveys       enable row level security;
alter table survey_items  enable row level security;
alter table requests      enable row level security;
alter table request_items enable row level security;

-- Allow the anon role full access for the proof-of-concept.
-- (Tighten these when real auth is added — see plan §10.)
do $$
declare t text;
begin
  foreach t in array array[
    'items','stands','stand_items','runners',
    'surveys','survey_items','requests','request_items'
  ]
  loop
    execute format(
      'create policy "anon_all_%1$s" on %1$I for all to anon using (true) with check (true);', t
    );
  end loop;
end $$;

-- ============ REALTIME ============
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table request_items;
```

### Key relationships
- `items` is the **master list**. `stands` are the physical stands. `stand_items` is the many-to-many that defines each stand's **catalog** (its subset). The app should only ever show a stand's catalog items when surveying or requesting for that stand.
- A **survey** belongs to a stand and has many `survey_items` (item + qty_needed). This is the pre-game pick list.
- A **request** belongs to a stand and has many `request_items`. `status` drives the in-game queue. `accepted_by` locks it to one runner.

---

## 4a. Scale & UI Sizing

Real-world v1 numbers:
- **~20 concession stands** (mix of permanent, mobile/kiosk, third-party).
- **5 runners total** on the roster; **3–4 per in-game shift**.
- Master inventory: likely dozens of items; each stand's catalog is a small subset.

Implications for the build — keep it dumb-simple, no scaling tricks:
- **Stand picker:** a plain scrollable list of ~20 items. A search/filter box is a nice-to-have, not required. No pagination or virtualization.
- **Runner picker:** 5 names as large tap buttons on one screen — no search needed.
- **In-game queue:** at 3–4 runners and one ballpark's worth of stands, the open-request list will rarely exceed a handful of cards at once. The "re-fetch on any realtime change" approach in §9 is more than fast enough; do not optimize prematurely.
- **Concurrency:** with only 3–4 runners, accept collisions are rare but still possible — keep the atomic conditional update; it costs nothing.
- **Survey / pick list:** a single runner surveys multiple of the ~20 stands pre-game; the combined cart list grouped by stand stays short and readable on a phone.

Net: prioritize big tap targets and legibility over any performance engineering.

---

## 5. App Architecture & Routes

Single React PWA. Role is chosen on the home screen and kept in memory + `localStorage` (so a refresh keeps you in role). No server-side sessions in v1.

```
/                       Home — choose role: Stand Worker | Runner | Manager
/stand                  Stand Worker home (after picking/scanning a stand)
/runner                 Runner home (after picking name) -> tabs: Survey | Queue
/runner/survey/:standId Survey entry for a stand (pick list builder)
/runner/picklist        Combined cart pick list from open surveys
/runner/queue           In-game request queue (realtime)
/manager                Manager: edit items, stands, stand catalogs, runners
/scan                   Shared QR scanner -> resolves to a stand, routes accordingly
```

### Client-side "session" object (localStorage)
```jsonc
{
  "role": "runner",            // 'stand' | 'runner' | 'manager'
  "runnerId": "uuid",          // if runner
  "runnerName": "Sam",
  "standId": "uuid",           // if stand worker
  "standName": "Dippin Dots",
  "day": "2026-05-30"          // used to expire the stand-worker selection daily
}
```
On app load, if `day` != today, clear `standId`/`runnerId` and return to role pick (this implements "persist until end of day").

---

## 6. Screen-by-Screen Spec

### 6.1 Home (`/`)
Three large buttons: **I'm a Stand Worker**, **I'm a Runner**, **Manager**. Footer: "Add to Home Screen" hint on first visit.

### 6.2 Stand Worker flow
1. **Pick your stand:** two options on one screen — **Scan QR** (camera) or **Choose from list** (searchable list of active stands). Selection saved to session for the day.
2. **Stand home (`/stand`):** shows the stand name + a primary button **Request Restock**.
3. **Create request:** shows only this stand's catalog items (`stand_items` join). Worker taps items, sets qty per item (stepper, default 1), optional note. Submit → inserts a `requests` row (`created_by = 'stand:<name>'`, status `open`) + `request_items`. Confirmation toast.
4. **My requests:** list of this stand's recent requests with live status (Open / Accepted by <runner> / Done).

### 6.3 Runner flow
1. **Pick your name** from the `runners` list (searchable). Saved for the day.
2. **Runner home (`/runner`)** with two tabs:

**Survey tab (pre-game):**
- Pick a stand (scan or list).
- **Survey screen** shows the stand's catalog. For each item, a qty stepper "needed." Runner fills in judgment quantities, can leave items at 0. Save → creates a `survey` + `survey_items`.
- **Combined pick list (`/runner/picklist`):** aggregates all this runner's `open` surveys into one cart list, grouped by stand (and optionally a flat "everything to load" view). Each line has a checkbox; checking all marks the survey `picked`/`done`. This is what the runner works from at the warehouse.

**Queue tab (in-game):**
- Realtime list of `open` requests, oldest first, each showing stand name, items+qty, note, age.
- **Accept** button → atomic claim (see §9). On success the card moves to "My active" with a **Mark Done** button.
- Separate sections: **Open**, **My Active** (accepted by me), and a collapsed **Recently Done**.
- Runner can also **create a request** here (for stock they spot themselves) — same item picker scoped to a chosen stand, `created_by = 'runner:<name>'`.

### 6.4 Manager (`/manager`)
- **Items:** list/add/edit/deactivate master items (name, category, unit, active).
- **Stands:** list/add/edit/deactivate stands (name, number, type, location note).
- **Stand catalog editor:** pick a stand → checklist of all items → check the ones it carries (writes `stand_items`). This is the core "subset" editor.
- **Runners:** add/edit/deactivate runner names.
- Light gate only (see §7).

---

## 7. Manager access (lightweight)

No full auth in v1, but the manager screen shouldn't be one tap from the home screen for everyone. Use a **shared PIN** stored as an env var (`VITE_MANAGER_PIN`) checked client-side. It's not real security — it just prevents accidental edits. Real per-user auth comes with Supabase Auth in a later version (§10).

---

## 8. Loading Inventory Data (in-app, via the Manager screen)

All inventory data is entered **through the app's Manager screen** — no CSV/spreadsheet step. Dave will enter most of it from memory at home, then fill gaps during a shift. Because data entry happens in-app, the **Manager screen must be built early** (see the reordered build plan in §11) so there's something to enter data into before the survey/queue features exist.

Enter data in this order (each step depends on the previous one existing):

1. **Items (master inventory)** — Manager → Items → Add. Fields: name, category (e.g. soda/beer/candy/frozen/food/bakery), unit (case/each/bag/box), active. Add every item across the whole park.
2. **Stands** — Manager → Stands → Add. Fields: name, number (optional — some stands are name-only), type (permanent/mobile/third_party), location note. Expect ~20.
3. **Stand catalogs (the subsets)** — Manager → pick a stand → **Stand catalog editor** → check the items that stand carries. Repeat per stand. This is the many-to-many that scopes what surveys/requests show for each stand (e.g. Stand 3 / Blaze Pizza gets only the sodas you supply; Dippin' Dots gets only its items).
4. **Runners** — Manager → Runners → Add the 5 names.

Manager data-entry UX requirements (so at-home bulk entry isn't tedious):
- **Items & Stands:** "Save & add another" button that keeps the form open and clears it, so you can rattle off many entries without round-trips.
- **Stand catalog editor:** a single checklist of all items with a search/filter box and a running "X selected" count; saves on toggle (no separate submit), so assigning a stand's subset is fast.
- **Inline edit + deactivate** (not hard delete) on every list, so corrections during a shift are quick and don't break historical requests/surveys.
- All Manager screens must work well on a **phone** (Dave may enter some data on the floor), but also fine on a laptop browser at home.

---

## 9. Realtime Queue & the Accept Race Condition

Two runners may tap **Accept** on the same request at nearly the same time. Handle it with a **conditional update** so only one wins — never read-then-write.

Claim logic (supabase-js):
```js
const { data, error } = await supabase
  .from('requests')
  .update({
    status: 'accepted',
    accepted_by: runnerId,
    accepted_at: new Date().toISOString()
  })
  .eq('id', requestId)
  .eq('status', 'open')          // <-- only succeeds if still open
  .select();

if (!error && data.length === 0) {
  // Someone else grabbed it first — refresh the queue, show "already taken".
}
```
Because the `WHERE status = 'open'` is evaluated atomically by Postgres, exactly one runner's update matches. The loser gets an empty `data` array and a friendly message.

**Realtime subscription** for the queue:
```js
supabase
  .channel('requests')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'requests' },
      payload => refreshQueue())
  .subscribe();
```
Keep it simple: on any change, re-fetch the open/active lists (small data volume). Optimize to incremental updates only if needed.

---

## 10. Future-proofing (note for later versions)

- **Real auth:** Swap the name/stand pickers for Supabase Auth (magic link or PIN-per-user). Replace the permissive `anon_all_*` RLS policies with role-aware policies (e.g., only authenticated users; managers gated by a `role` claim). The schema already separates `runners` so adding an `auth_user_id` column is straightforward.
- **Priority/urgency** on requests (add `priority` column + sort).
- **Push notifications** to runners for new requests (Web Push, or native shell).
- **Analytics:** request volume by stand, time-to-complete (the `accepted_at`/`completed_at` timestamps are already captured).
- **Native app:** wrap the PWA (Capacitor) or rebuild in React Native, reusing the Supabase backend unchanged.

---

## 11. Build Order for Claude Code (phased)

**Phase 0 — Scaffold**
Vite + React + Tailwind + React Router. Add `vite-plugin-pwa` with a manifest (name, icons, standalone display). Add `@supabase/supabase-js` and a `supabaseClient.js` reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Deploy a hello-world to Vercel to confirm HTTPS + install works.

**Phase 1 — Data layer**
Run the §4 SQL in Supabase. Build typed data-access helpers: items, stands, standCatalog(standId), runners, surveys, requests.

**Phase 2 — Manager screen (built early — it's how Dave enters all data)**
PIN gate, items CRUD, stands CRUD, **stand catalog editor**, runners CRUD, with the fast-entry UX from §8 ("Save & add another", checklist with search, inline edit/deactivate). Once this ships, Dave can load real inventory, which makes testing the rest realistic.

**Phase 3 — Role/session shell**
Home screen + role selection. Stand picker and runner picker (list + QR scan). localStorage session with daily expiry (§5).

**Phase 4 — In-game queue (highest operational value)**
Request creation (stand worker + runner), realtime queue, atomic Accept (§9), Mark Done, "my active" / "recently done" sections.

**Phase 5 — Pre-game survey**
Survey entry per stand (catalog-scoped), combined cart pick list, mark picked/done.

**Phase 6 — Polish**
Large tap targets, loading/empty/error states, toasts, "Add to Home Screen" prompt, basic offline-friendly caching of static assets (service worker default), QA on iOS Safari + Android Chrome.

---

## 12. Acceptance checklist for v1

- [ ] Installs to home screen on iPhone (Safari) and Android (Chrome).
- [ ] Stand worker can pick a stand (scan or list) that persists for the day.
- [ ] Stand worker sees only that stand's catalog when requesting.
- [ ] Runner can pick their name; survey a stand; build and view a combined cart pick list.
- [ ] Stand workers/runners can create in-game requests; queue updates live across phones.
- [ ] Only one runner can accept a given request; the other sees "already taken."
- [ ] Runner can mark a request done; status reflects everywhere in realtime.
- [ ] Manager (PIN) can add/edit items, stands, runners, and assign stand catalogs.
```
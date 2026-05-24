# Kyro FN Backend — Multi-Build Edition

A Fortnite private-server backend supporting **all builds from the fortnite-builds-archive** (Pre-Season through Season 39+).

---

## What's New vs Original

### Full Build Archive Compatibility
Every build from the [fortnite-builds-archive](https://github.com/llamaqwerty/fortnite-builds-archive) is now supported via a new `structs/buildcompat.js` module that:

- Detects the connecting client's build from the `User-Agent` header (handles `Release-X.Y`, 3-part versions like `1.8.2`, and CL-only very early builds)
- Falls back to Changelist (CL) ranges for pre-Season / S1–S2 builds that lack a `Release-` header
- Returns correct per-build **feature flags** (`hasItemShop`, `hasParty`, `hasXMPP`, `hasBattlePass`, `usesCommandRevision`, etc.)

### Version Detection Fixes (functions.js)
| Build era | Fix |
|---|---|
| Pre-Season (Cert, OT6.5–OT11) | CL-range fallback covers CLs 3532353–3541083 |
| Season 1 (1.8–1.10) | Correct CL ranges; lobby = `LobbySeason1` |
| Season 2 (1.11–2.5) | `LobbyWinterDecor` applied correctly |
| Season 10 | Lobby correctly set to `LobbySeason10` (not `seasonx` flag in lobby name) |
| Chapter 2 S1 winter builds (11.31, 11.40) | `LobbyWinter2019` applied |
| S19.01 winterfest | `LobbyWinter2021` + background image override |
| 3-part versions (e.g. `1.8.2`) | Parsed correctly as `1.82` build number |

### Timeline (calendar) Route
- Uses `buildcompat.getActiveEvents()` for correct per-season event flags
- Season 2 gets `LobbyWinterDecor` event; S6 gets `LobbyHalloween`; S7 & S11 winter builds get `LobbyWinter`
- Season 10 emits `LobbySeason10` flag instead of `seasonx`

### Item Shop
- Gated by `hasItemShop` flag — builds before Season 3 receive an empty `storefronts: []`
- OT6.5 (CL 2870186) prototype correctly 404s the catalog

### Party Service (main.js)
- Full party API stub endpoints for S5+ builds: create party, join, patch meta, kick, pings
- Pre-S5 builds that don't use the party API still work fine

### Cloud Storage (cloudstorage.js)
- Raw binary body parsing (`express.raw`) for client settings PUT requests — fixes corrupted settings files
- Skips client settings for builds < Season 4 that don't use them

### Matchmaking (matchmaking.js)
- Covers both the old `matchmakingservice/ticket` (S5–S11) and MMS v2 (S12+) endpoints
- Session response includes correct playlist name per build

### Version Route (version.js)
- Echoes back the connecting client's actual build/CL in the version response instead of always returning `18.30`
- Covers `/fortnite/api/v2/versioncheck*` used by newer builds

### MCP Operations (mcp.js)
Added silent stubs for all MCP operations sent by modern builds that were previously causing `operation_not_found` 404s:
- `FortRerollDailyQuest`, `SetChallengeBundle`, `UnlockRewardNode`, `ClaimQuestReward`
- `CopyCosmeticLoadout`, `DeleteCosmeticLoadout`, `UpdateCosmeticLoadout`, `RenameCosmeticLoadout`
- `SetPinnedQuests`, `PopulatePrerolledOffers`, `RequestRestedStateIncrease`
- `OpenCardPackBatch`, `ActivateConsumable`, `SetAffiliateName`, `SetPartyAssistQuest`
- and more

### Content Pages (contentpages.js)
- Added legacy path `/fortnite-game*` for older builds that don't use `/content/api/pages/...`

### Lightswitch
- Added `lightswitch/api/service/*/status` wildcard for EOS/modern builds

---

## Setup

### Requirements
- Node.js 16+
- MongoDB (local: `mongodb://127.0.0.1/lawindb`)

### Install & Run
```bat
INSTALL.bat       # installs npm packages
START.bat         # starts the backend
```

Or manually:
```bash
npm install
node index.js
```

### Config (`Config/config.json`)
```json
{
    "mongodb": { "database": "mongodb://127.0.0.1/lawindb" },
    "chat": { "EnableGlobalChat": false },
    "matchmakerIP": "127.0.0.1:80",
    "gameServerIP": "127.0.0.1:7777"
}
```

---

## Build Compatibility Table

| Season | Example Build | Item Shop | Battle Pass | Party | commandRevision |
|--------|--------------|-----------|-------------|-------|-----------------|
| Pre-Season / OT | Cert-CL-3532353 | ✗ | ✗ | ✗ | ✗ |
| Season 1 | 1.8–1.10 | ✗ | ✗ | ✗ | ✗ |
| Season 2 | 2.1–2.5 | ✗ | ✗ | ✗ | ✗ |
| Season 3 | 3.0–3.6 | ✓ | ✓ | ✗ | ✗ |
| Season 4 | 4.0–4.5 | ✓ | ✓ | ✗ | ✗ |
| Season 5 | 5.00–5.41 | ✓ | ✓ | ✓ | ✗ |
| Season 6–9 | 6.00–9.41 | ✓ | ✓ | ✓ | ✗ |
| Season 10 (X) | 10.00–10.40 | ✓ | ✓ | ✓ | ✗ |
| Season 11 (C2S1) | 11.00–11.50 | ✓ | ✓ | ✓ | ✗ |
| Season 12 (<12.20) | 12.00–12.10 | ✓ | ✓ | ✓ | ✗ |
| Season 12 (≥12.20) | 12.20–12.61 | ✓ | ✓ | ✓ | ✓ |
| Season 13–39+ | 13.00+ | ✓ | ✓ | ✓ | ✓ |

---

## Files Changed
- `structs/functions.js` — full rewrite with improved version detection
- `structs/buildcompat.js` — **new** build compatibility module
- `routes/timeline.js` — per-season active events
- `routes/version.js` — dynamic build echo + v2 versioncheck
- `routes/main.js` — party stubs, dynamic launcher assets
- `routes/matchmaking.js` — MMS v2 + correct playlist per build
- `routes/storefront.js` — build-gated item shop
- `routes/cloudstorage.js` — raw binary body parsing
- `routes/lightswitch.js` — EOS wildcard route
- `routes/contentpages.js` — legacy path support
- `routes/mcp.js` — expanded operation support
- `index.js` — raw body middleware for cloudstorage

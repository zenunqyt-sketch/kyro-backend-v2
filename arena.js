/**
 * arena.js  –  Arena / Tournament endpoints for Kyro FN Backend
 *
 * Serves the Arena event list, player Hype scores, and token state so that
 * build 13.40 (Ch2 S3) shows Arena Solo + Duos in the lobby and routes
 * matchmaking through Playlist_ShowdownAlt_Solo / _Duos on the game server.
 *
 * Endpoints served:
 *   GET  /api/v1/events/Fortnite/download/:accountId/:region/:platform
 *   GET  /fortnite/api/game/v2/events/tournamentandhistory/:accountId/:region/:platform
 *   POST /fortnite/api/game/v2/events/v2/setSubgroup/:accountId
 *   GET  /fortnite/api/game/v2/matchmakingservice/ticket/player/:accountId  (Arena bucket override)
 */

const express   = require("express");
const app       = express.Router();
const fs        = require("fs");
const path      = require("path");
const functions = require("../structs/functions.js");
const { verifyToken } = require("../tokenManager/tokenVerify.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Load arena config fresh each call so live edits take effect without restart. */
function getArenaConfig() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "Config", "arena.json")).toString());
}

/**
 * Build the player block for a given accountId.
 * In a real setup you would look up Hype from a DB; here we start everyone
 * at 0 Hype in Division 1 so they can climb from there.
 */
function buildPlayerBlock(accountId) {
    return {
        accountId,
        gameId: "Fortnite",
        persistentScores: { Hype: 0 },
        teams: { "floating:Hype": [accountId] },
        // Division1 token is always granted so the player can queue
        tokens: ["ARENA_S13_Division1"]
    };
}

// ─── Arena event list ─────────────────────────────────────────────────────────

// Legacy download endpoint (used by some 13.x builds)
app.get("/api/v1/events/Fortnite/download/:accountId/:region/:platform", verifyToken, (req, res) => {
    const arena = getArenaConfig();
    res.json({
        events:    arena.events,
        player:    buildPlayerBlock(req.params.accountId),
        templates: arena.templates
    });
});

// Main events endpoint used by build 13.40
app.get(
    "/fortnite/api/game/v2/events/tournamentandhistory/:accountId/:region/:platform",
    verifyToken,
    (req, res) => {
        const arena = getArenaConfig();
        res.json({
            events:    arena.events,
            player:    buildPlayerBlock(req.params.accountId),
            templates: arena.templates
        });
    }
);

// Wildcard fallback so any region/platform combo is covered
app.get(
    "/fortnite/api/game/v2/events/tournamentandhistory/*",
    verifyToken,
    (req, res) => {
        const arena = getArenaConfig();
        // Try to extract accountId from the URL segments
        const parts     = req.path.split("/").filter(Boolean);
        // path is: fortnite/api/game/v2/events/tournamentandhistory/<accountId>/...
        const accountId = parts[6] || (req.user && req.user.accountId) || "unknown";
        res.json({
            events:    arena.events,
            player:    buildPlayerBlock(accountId),
            templates: arena.templates
        });
    }
);

// ─── Subgroup (division bucket) setter  ──────────────────────────────────────
// The client calls this when the player selects a division; we just acknowledge.
app.post("/fortnite/api/game/v2/events/v2/setSubgroup/:accountId", verifyToken, (req, res) => {
    res.status(204).end();
});

// ─── Matchmaking ticket – Arena playlist override for build 13.40 ─────────────
//
// When the client queues for Arena it sends a bucketId that contains the
// playlist name, e.g.  "Playlist_ShowdownAlt_Solo:1:1:13.40:..."
// We detect that here and point the websocket at the game server; the
// matchmaker already handles the actual connection in matchmaker.js.
//
// This handler sits BEFORE the generic ticket handler in matchmaking.js
// because express resolves routes in the order they are registered, and
// arena.js is loaded via readdirSync (alphabetically before matchmaking.js).

app.get(
    "/fortnite/api/game/v2/matchmakingservice/ticket/player/:accountId",
    verifyToken,
    (req, res, next) => {
        const bucketId = req.query.bucketId || "";

        // Only intercept Arena playlists
        const isArena =
            bucketId.includes("ShowdownAlt") ||
            bucketId.includes("Showdown_Solo") ||
            bucketId.includes("Showdown_Duos");

        if (!isArena) {
            // Not an Arena queue – let the generic matchmaking route handle it
            return next();
        }

        const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

        // Store the bucketId so the session endpoint can echo it back
        // (reuse the same global the matchmaking route uses)
        if (!global._arenaBucketIds) global._arenaBucketIds = {};
        global._arenaBucketIds[req.user.accountId] = bucketId.split(":")[0];

        res.json({
            serviceUrl:  `ws://${config.matchmakerIP}`,
            ticketType:  "mms-player",
            payload:     "69=",
            signature:   "420="
        });
    }
);

// ─── Arena session info – returns the game server address for Arena matches ──
//
// After the matchmaker assigns a session the client fetches session details.
// We patch the PLAYLISTNAME_s attribute to match the Arena playlist so the
// game server boots the correct game mode.
app.get(
    "/fortnite/api/matchmaking/session/:sessionId",
    verifyToken,
    (req, res, next) => {
        // Only override if this looks like an Arena session (accountId had an arena bucket)
        const bucketEntry =
            global._arenaBucketIds &&
            global._arenaBucketIds[req.user.accountId];

        if (!bucketEntry) return next(); // fall through to generic session handler

        const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

        let serverAddress = "127.0.0.1";
        let serverPort    = 7777;
        try {
            const parts = config.gameServerIP.split(":");
            if (parts[0]) serverAddress = parts[0];
            const p = Number(parts[1]);
            if (!Number.isNaN(p) && p > 0) serverPort = p;
        } catch {}

        // Determine Solo vs Duos from the bucket string
        const playlist = bucketEntry.includes("Duos")
            ? "Playlist_ShowdownAlt_Duos"
            : "Playlist_ShowdownAlt_Solo";

        res.json({
            id:               req.params.sessionId,
            ownerId:          functions.MakeID().replace(/-/ig, "").toUpperCase(),
            ownerName:        "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
            serverName:       "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
            serverAddress,
            serverPort,
            maxPublicPlayers: 220,
            openPublicPlayers: 175,
            maxPrivatePlayers: 0,
            openPrivatePlayers: 0,
            attributes: {
                REGION_s:              "EU",
                GAMEMODE_s:            "FORTATHENA",
                ALLOWBROADCASTING_b:   true,
                SUBREGION_s:           "GB",
                DCID_s:                "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
                tenant_s:              "Fortnite",
                MATCHMAKINGPOOL_s:     "Any",
                STORMSHIELDDEFENSETYPE_i: 0,
                HOTFIXVERSION_i:       0,
                PLAYLISTNAME_s:        playlist,   // ← Arena playlist injected here
                SESSIONKEY_s:          functions.MakeID().replace(/-/ig, "").toUpperCase(),
                TENANT_s:              "Fortnite",
                BEACONPORT_i:          15009
            },
            publicPlayers:  [],
            privatePlayers: [],
            totalPlayers:   45,
            allowJoinInProgress:            false,
            shouldAdvertise:                false,
            isDedicated:                    false,
            usesStats:                      false,
            allowInvites:                   false,
            usesPresence:                   false,
            allowJoinViaPresence:           true,
            allowJoinViaPresenceFriendsOnly: false,
            buildUniqueId: bucketEntry || "0",
            lastUpdated:   new Date().toISOString(),
            started:       false
        });
    }
);

module.exports = app;

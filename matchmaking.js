const express   = require("express");
const app       = express.Router();
const fs        = require("fs");
const functions = require("../structs/functions.js");
const buildcompat = require("../structs/buildcompat.js");

const { verifyToken } = require("../tokenManager/tokenVerify.js");

// Track per-account bucket/build IDs for session responses
let buildUniqueId = {};

// ─── Old-style matchmaking (pre-S12 / ticket endpoint) ───────────────────────
app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
    res.status(200).end();
});

// Ticket endpoint used by S5–S11 builds
app.get("/fortnite/api/game/v2/matchmakingservice/ticket/player/*", verifyToken, (req, res) => {
    if (typeof req.query.bucketId !== "string") return res.status(400).end();
    if (req.query.bucketId.split(":").length < 2) return res.status(400).end();

    buildUniqueId[req.user.accountId] = req.query.bucketId.split(":")[0];

    const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

    res.json({
        "serviceUrl": `ws://${config.matchmakerIP}`,
        "ticketType": "mms-player",
        "payload": "69=",
        "signature": "420="
    });
});

// Session info – used when client queries a session by ID
app.get("/fortnite/api/matchmaking/session/:sessionId", verifyToken, (req, res) => {
    const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
    const memory = functions.GetVersionInfo(req);

    let serverAddress = "127.0.0.1";
    let serverPort    = 7777;

    try {
        const parts = config.gameServerIP.split(":");
        if (parts[0]) serverAddress = parts[0];
        const p = Number(parts[1]);
        if (!Number.isNaN(p) && p > 0) serverPort = p;
    } catch {}

    const playlist = buildcompat.getDefaultPlaylist(memory.build);

    res.json({
        "id": req.params.sessionId,
        "ownerId": functions.MakeID().replace(/-/ig, "").toUpperCase(),
        "ownerName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverAddress": serverAddress,
        "serverPort": serverPort,
        "maxPublicPlayers": 220,
        "openPublicPlayers": 175,
        "maxPrivatePlayers": 0,
        "openPrivatePlayers": 0,
        "attributes": {
            "REGION_s": "EU",
            "GAMEMODE_s": "FORTATHENA",
            "ALLOWBROADCASTING_b": true,
            "SUBREGION_s": "GB",
            "DCID_s": "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
            "tenant_s": "Fortnite",
            "MATCHMAKINGPOOL_s": "Any",
            "STORMSHIELDDEFENSETYPE_i": 0,
            "HOTFIXVERSION_i": 0,
            "PLAYLISTNAME_s": playlist,
            "SESSIONKEY_s": functions.MakeID().replace(/-/ig, "").toUpperCase(),
            "TENANT_s": "Fortnite",
            "BEACONPORT_i": 15009
        },
        "publicPlayers": [],
        "privatePlayers": [],
        "totalPlayers": 45,
        "allowJoinInProgress": false,
        "shouldAdvertise": false,
        "isDedicated": false,
        "usesStats": false,
        "allowInvites": false,
        "usesPresence": false,
        "allowJoinViaPresence": true,
        "allowJoinViaPresenceFriendsOnly": false,
        "buildUniqueId": buildUniqueId[req.user.accountId] || "0",
        "lastUpdated": new Date().toISOString(),
        "started": false
    });
});

// Account-level session lookup (S10+ style)
app.get("/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId", (req, res) => {
    res.json({
        "accountId": req.params.accountId,
        "sessionId": req.params.sessionId,
        "key": "none"
    });
});

// Join / request stubs
app.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
    res.status(204).end();
});
app.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
    res.json([]);
});

// ─── MMS (matchmaking service) v2 used by S12+ builds ────────────────────────
app.get("/fortnite/api/game/v2/matchmakingservice/ticket/player*", verifyToken, (req, res) => {
    const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
    res.json({
        "serviceUrl": `ws://${config.matchmakerIP}`,
        "ticketType": "mms-player",
        "payload": "69=",
        "signature": "420="
    });
});

module.exports = app;

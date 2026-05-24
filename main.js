const express = require("express");
const fs   = require("fs");
const app  = express.Router();
const path = require("path");

const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");
const functions  = require("../structs/functions.js");
const buildcompat = require("../structs/buildcompat.js");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

// ─── Chat ────────────────────────────────────────────────────────────────────
app.post("/fortnite/api/game/v2/chat/*/*/*/pc", (req, res) => {
    const resp = config.chat.EnableGlobalChat
        ? { "GlobalChatRooms": [{ "roomName": "lawinserverglobal" }] }
        : {};
    res.json(resp);
});

app.post("/fortnite/api/game/v2/chat/*/recommendGeneralChatRooms/pc", (req, res) => {
    res.json({});
});

// ─── Platform ────────────────────────────────────────────────────────────────
app.post("/fortnite/api/game/v2/tryPlayOnPlatform/account/*", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(true);
});

// ─── Distribution / Launcher ─────────────────────────────────────────────────
app.get("/launcher/api/public/distributionpoints/", (req, res) => {
    res.json({
        "distributions": [
            "https://download.epicgames.com/",
            "https://download2.epicgames.com/",
            "https://download3.epicgames.com/",
            "https://download4.epicgames.com/",
            "https://epicgames-download1.akamaized.net/"
        ]
    });
});

// Dynamic launcher assets – returns the correct buildVersion for the connecting client
app.get("/launcher/api/public/assets/*", async (req, res) => {
    const memory = functions.GetVersionInfo(req);
    const buildVersion = buildcompat.getLauncherBuildVersion(memory);

    res.json({
        "appName": "FortniteContentBuilds",
        "labelName": "LawinServer",
        "buildVersion": buildVersion,
        "catalogItemId": "5cb97847cee34581afdbc445400e2f77",
        "expires": "9999-12-31T23:59:59.999Z",
        "items": {
            "MANIFEST": {
                "signature": "LawinServer",
                "distribution": "https://lawinserver.ol.epicgames.com/",
                "path": "Builds/Fortnite/Content/CloudDir/LawinServer.manifest",
                "hash": "55bb954f5596cadbe03693e1c06ca73368d427f3",
                "additionalDistributions": []
            },
            "CHUNKS": {
                "signature": "LawinServer",
                "distribution": "https://lawinserver.ol.epicgames.com/",
                "path": "Builds/Fortnite/Content/CloudDir/LawinServer.manifest",
                "additionalDistributions": []
            }
        },
        "assetId": "FortniteContentBuilds"
    });
});

// ─── Cloud storage (manifests/chunks/ini) ─────────────────────────────────────
app.get("/Builds/Fortnite/Content/CloudDir/*.manifest", async (req, res) => {
    res.set("Content-Type", "application/octet-stream");
    const manifest = fs.readFileSync(path.join(__dirname, "..", "responses", "CloudDir", "LawinServer.manifest"));
    res.status(200).send(manifest).end();
});

app.get("/Builds/Fortnite/Content/CloudDir/*.chunk", async (req, res) => {
    res.set("Content-Type", "application/octet-stream");
    const chunk = fs.readFileSync(path.join(__dirname, "..", "responses", "CloudDir", "LawinServer.chunk"));
    res.status(200).send(chunk).end();
});

app.get("/Builds/Fortnite/Content/CloudDir/*.ini", async (req, res) => {
    const ini = fs.readFileSync(path.join(__dirname, "..", "responses", "CloudDir", "Full.ini"));
    res.status(200).send(ini).end();
});

// ─── Waiting room ─────────────────────────────────────────────────────────────
app.get("/waitingroom/api/waitingroom", (req, res) => {
    res.status(204).end();
});

// ─── Social ban ───────────────────────────────────────────────────────────────
app.get("/socialban/api/public/v1/*", (req, res) => {
    res.json({ "bans": [], "warnings": [] });
});

// Tournament / Events – handled by routes/arena.js

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get("/fortnite/api/statsv2/account/:accountId", (req, res) => {
    res.json({ "startTime": 0, "endTime": 0, "stats": {}, "accountId": req.params.accountId });
});
app.get("/statsproxy/api/statsv2/account/:accountId", (req, res) => {
    res.json({ "startTime": 0, "endTime": 0, "stats": {}, "accountId": req.params.accountId });
});
app.get("/fortnite/api/stats/accountId/:accountId/bulk/window/alltime", (req, res) => {
    res.json({ "startTime": 0, "endTime": 0, "stats": {}, "accountId": req.params.accountId });
});
app.post("/fortnite/api/statsv2/query", (req, res) => { res.json([]); });
app.post("/statsproxy/api/statsv2/query", (req, res) => { res.json([]); });

// ─── Misc game endpoints ──────────────────────────────────────────────────────
app.post("/fortnite/api/feedback/*", (req, res) => { res.status(200).end(); });
app.post("/fortnite/api/game/v2/events/v2/setSubgroup/*", (req, res) => { res.status(204).end(); });
app.get("/fortnite/api/game/v2/enabled_features", (req, res) => { res.json([]); });
// Arena download endpoint handled by routes/arena.js

app.get("/fortnite/api/game/v2/twitch/*", (req, res) => { res.status(200).end(); });
app.get("/fortnite/api/game/v2/world/info", (req, res) => { res.json({}); });
app.get("/fortnite/api/receipts/v1/account/*/receipts", (req, res) => { res.json([]); });
app.get("/fortnite/api/game/v2/leaderboards/cohort/*", (req, res) => { res.json([]); });
app.post("/datarouter/api/v1/public/data", (req, res) => { res.status(204).end(); });

// ─── Party service stubs (used by S5+ builds) ────────────────────────────────
// Full party support is handled in xmpp; these stubs prevent 404 errors.
app.get("/party/api/v1/Fortnite/user/:accountId", verifyToken, (req, res) => {
    res.json({
        current: [],
        pending: [],
        invites: [],
        pings: []
    });
});

app.post("/party/api/v1/Fortnite/parties", verifyToken, (req, res) => {
    const partyId = require("uuid").v4().replace(/-/g, "");
    res.json({
        id: partyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        config: {
            type: "DEFAULT",
            joinability: "OPEN",
            discoverability: "ALL",
            sub_type: "default",
            max_size: 16,
            invite_ttl: 14400,
            join_confirmation: false
        },
        members: [],
        applicants: [],
        meta: req.body.meta || {},
        invites: [],
        revision: 0,
        intentions: []
    });
});

app.patch("/party/api/v1/Fortnite/parties/:partyId", verifyToken, (req, res) => {
    res.json({ id: req.params.partyId, revision: 1 });
});

app.post("/party/api/v1/Fortnite/parties/:partyId/members/:accountId/join", verifyToken, (req, res) => {
    res.json({ status: "JOINED", party_id: req.params.partyId });
});

app.delete("/party/api/v1/Fortnite/parties/:partyId/members/:accountId", verifyToken, (req, res) => {
    res.status(204).end();
});

app.post("/party/api/v1/Fortnite/user/:accountId/pings/:pingerId", verifyToken, (req, res) => {
    res.status(204).end();
});

app.delete("/party/api/v1/Fortnite/user/:accountId/pings/:pingerId", verifyToken, (req, res) => {
    res.status(204).end();
});

app.get("/party/api/v1/Fortnite/parties/:partyId", verifyToken, (req, res) => {
    res.json({
        id: req.params.partyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        config: { type: "DEFAULT", joinability: "OPEN", max_size: 16 },
        members: [],
        meta: {},
        invites: [],
        revision: 0
    });
});

// ─── Voice chat token (S11+) ──────────────────────────────────────────────────
app.get("/fortnite/api/game/v2/voice/token/voicechat-token", verifyToken, (req, res) => {
    res.json({ token: "kyro-voice-stub", server: "" });
});

// ─── Content pages ────────────────────────────────────────────────────────────
app.get("/content/api/pages/fortnite-game*", (req, res) => {
    res.json(functions.getContentPages(req));
});

module.exports = app;

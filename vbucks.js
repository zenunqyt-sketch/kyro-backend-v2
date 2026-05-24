const express = require("express");
const app = express.Router();
const fs = require("fs");

const User = require("../model/user.js");
const Profile = require("../model/profiles.js");
const log = require("../structs/log.js");

const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

// ── /api/reload/vbucks ────────────────────────────────────────────────────────
// Called by the Erbium game server (via libcurl) when a player gets a kill or win.
// Query params:
//   apikey   – must match config.apiKey
//   username – the player's display name
//   reason   – "Kill" or "Win"
//
app.get("/api/reload/vbucks", async (req, res) => {
    const { apikey, username, reason } = req.query;

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (!apikey || apikey !== config.apiKey) {
        return res.status(403).json({ error: "Invalid or missing API key." });
    }

    // ── Validate params ───────────────────────────────────────────────────────
    if (!username || typeof username !== "string" || username.trim().length === 0) {
        return res.status(400).json({ error: "Missing username." });
    }

    const reasonKey = (reason || "").toLowerCase();
    if (reasonKey !== "kill" && reasonKey !== "win") {
        return res.status(400).json({ error: "reason must be 'Kill' or 'Win'." });
    }

    // ── Work out how many vbucks to award ─────────────────────────────────────
    const vbucksConfig = config.vbucks || { kill: 25, win: 100 };
    const amount = reasonKey === "kill" ? vbucksConfig.kill : vbucksConfig.win;

    try {
        // ── Find user by username (case-insensitive) ──────────────────────────
        const user = await User.findOne({ username_lower: username.trim().toLowerCase() });
        if (!user) {
            log.backend(`[VBucks] Unknown user: ${username}`);
            return res.status(404).json({ error: `Player '${username}' not found.` });
        }

        // ── Load their profile ────────────────────────────────────────────────
        const profileDoc = await Profile.findOne({ accountId: user.accountId });
        if (!profileDoc) {
            return res.status(404).json({ error: "Profile not found for player." });
        }

        const profiles = profileDoc.profiles;
        const common_core = profiles["common_core"];

        if (!common_core || !common_core.items || !common_core.items["Currency:MtxPurchased"]) {
            return res.status(500).json({ error: "common_core profile is missing MtxPurchased item." });
        }

        // ── Add vbucks ────────────────────────────────────────────────────────
        common_core.items["Currency:MtxPurchased"].quantity += amount;
        common_core.rvn += 1;
        common_core.commandRevision += 1;
        common_core.updated = new Date().toISOString();

        await profileDoc.updateOne({
            $set: { "profiles.common_core": common_core }
        });

        log.backend(`[VBucks] +${amount} vbucks → ${username} (${reason}). New balance: ${common_core.items["Currency:MtxPurchased"].quantity}`);

        return res.json({
            success: true,
            username: user.username,
            reason: reason,
            awarded: amount,
            newBalance: common_core.items["Currency:MtxPurchased"].quantity
        });

    } catch (err) {
        log.error(`[VBucks] Error rewarding ${username}: ${err.message}`);
        return res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = app;

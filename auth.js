const express = require("express");
const app = express.Router();
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const error = require("../structs/error.js");
const functions = require("../structs/functions.js");
const { createProfiles } = require("../structs/profile.js");
const tokenCreation = require("../tokenManager/tokenCreation.js");
const { verifyToken } = require("../tokenManager/tokenVerify.js");
const User = require("../model/user.js");
const Profiles = require("../model/profiles.js");

function DateAddHours(date, hours) {
    date.setHours(date.getHours() + hours);
    return date;
}

async function getDiscordUser(accessToken) {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    return res.json();
}

async function getOrCreateAccount(discordUser) {
    let user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
        const accountId = uuidv4().replace(/-/g, "");
        const username = discordUser.global_name || discordUser.username;
        user = new User({
            created: new Date(),
            banned: false,
            discordId: discordUser.id,
            accountId,
            username,
            username_lower: username.toLowerCase(),
            email: `${discordUser.id}@kyro.gg`,
            password: "discord-oauth"
        });
        await user.save();
        const profiles = new Profiles({ created: new Date(), accountId, profiles: createProfiles(accountId) });
        await profiles.save();
        console.log(`[KYRO] New account: ${username} (${discordUser.id})`);
    }

    if (user.banned) return { banned: true };
    return user;
}

app.post("/account/api/oauth/token", async (req, res) => {
    let clientId;
    try {
        clientId = functions.DecodeBase64(req.headers["authorization"].split(" ")[1]).split(":");
        if (!clientId[1]) throw new Error();
        clientId = clientId[0];
    } catch {
        return error.createError("errors.com.epicgames.common.oauth.invalid_client", "Invalid Authorization header.", [], 1011, "invalid_client", 400, res);
    }

    switch (req.body.grant_type) {
        case "client_credentials": {
            const token = tokenCreation.createClient(clientId, req.body.grant_type, req.ip, 4);
            functions.UpdateTokens();
            const dec = jwt.decode(token);
            return res.json({
                access_token: `eg1~${token}`,
                expires_in: Math.round(((DateAddHours(new Date(dec.creation_date), dec.hours_expire).getTime()) - Date.now()) / 1000),
                expires_at: DateAddHours(new Date(dec.creation_date), dec.hours_expire).toISOString(),
                token_type: "bearer", client_id: clientId, internal_client: true, client_service: "fortnite"
            });
        }

        case "discord_token": {
            if (!req.body.discord_token) return error.createError("errors.com.epicgames.common.oauth.invalid_request", "discord_token required.", [], 1013, "invalid_request", 400, res);
            const dUser = await getDiscordUser(req.body.discord_token);
            if (!dUser) return error.createError("errors.com.epicgames.account.invalid_account_credentials", "Invalid Discord token.", [], 18031, "invalid_grant", 400, res);
            const account = await getOrCreateAccount(dUser);
            if (account.banned) return error.createError("errors.com.epicgames.account.account_not_active", "Your account has been banned.", [], 18006, "account_not_active", 400, res);
            req.user = account;
            break;
        }

        case "exchange_code": {
            if (!req.body.exchange_code) return error.createError("errors.com.epicgames.common.oauth.invalid_request", "Exchange code required.", [], 1013, "invalid_request", 400, res);
            const exchange = global.exchangeCodes.find(e => e.code === req.body.exchange_code);
            if (!exchange) return error.createError("errors.com.epicgames.account.oauth.exchange_code_not_found", "Exchange code not found or expired.", [], 18057, "exchange_code_not_found", 400, res);
            global.exchangeCodes.splice(global.exchangeCodes.indexOf(exchange), 1);
            req.user = await User.findOne({ accountId: exchange.accountId }).lean();
            if (!req.user) return error.createError("errors.com.epicgames.account.invalid_account_credentials", "Account not found.", [], 18031, "invalid_grant", 400, res);
            break;
        }

        case "refresh_token": {
            if (!req.body.refresh_token) return error.createError("errors.com.epicgames.common.oauth.invalid_request", "Refresh token required.", [], 1013, "invalid_request", 400, res);
            const dec = jwt.decode(req.body.refresh_token.replace("eg1~", ""));
            const idx = global.refreshTokens.findIndex(i => i.token === req.body.refresh_token || i.token === `eg1~${req.body.refresh_token.replace("eg1~", "")}`);
            if (idx === -1) return error.createError("errors.com.epicgames.account.auth_token.invalid_refresh_token", "Refresh token not found.", [], 18036, "invalid_token", 400, res);
            global.refreshTokens.splice(idx, 1);
            req.user = await User.findOne({ accountId: dec.sub }).lean();
            if (!req.user) return error.createError("errors.com.epicgames.account.invalid_account_credentials", "Account not found.", [], 18031, "invalid_grant", 400, res);
            break;
        }

        default:
            return error.createError("errors.com.epicgames.common.oauth.unsupported_grant_type", `Unsupported: ${req.body.grant_type}`, [], 1016, "unsupported_grant_type", 400, res);
    }

    const existing = global.accessTokens.findIndex(i => i.accountId === req.user.accountId);
    if (existing !== -1) global.accessTokens.splice(existing, 1);

    const deviceId = uuidv4().replace(/-/g, "");
    const accessToken = tokenCreation.createAccess(req.user, clientId, req.body.grant_type, deviceId, 8);
    const refreshToken = tokenCreation.createRefresh(req.user, clientId, req.body.grant_type, deviceId, 24);
    functions.UpdateTokens();

    const dA = jwt.decode(accessToken);
    const dR = jwt.decode(refreshToken);

    return res.json({
        access_token: `eg1~${accessToken}`,
        expires_in: Math.round(((DateAddHours(new Date(dA.creation_date), dA.hours_expire).getTime()) - Date.now()) / 1000),
        expires_at: DateAddHours(new Date(dA.creation_date), dA.hours_expire).toISOString(),
        refresh_token: `eg1~${refreshToken}`,
        refresh_expires: Math.round(((DateAddHours(new Date(dR.creation_date), dR.hours_expire).getTime()) - Date.now()) / 1000),
        refresh_expires_at: DateAddHours(new Date(dR.creation_date), dR.hours_expire).toISOString(),
        account_id: req.user.accountId,
        client_id: clientId, internal_client: true, client_service: "fortnite",
        displayName: req.user.username, app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: uuidv4().replace(/-/g, ""),
        token_type: "bearer", username: req.user.email
    });
});

app.get("/account/api/oauth/exchange", verifyToken, async (req, res) => {
    const code = uuidv4().replace(/-/g, "");
    global.exchangeCodes.push({ code, accountId: req.user.accountId });
    setTimeout(() => { const i = global.exchangeCodes.findIndex(e => e.code === code); if (i !== -1) global.exchangeCodes.splice(i, 1); }, 300000);
    const decodedAccessToken = jwt.decode((req.headers["authorization"] || "").replace(/^bearer eg1~/i, ""));
    res.json({ expiresInSeconds: 300, code, creatingClientId: decodedAccessToken ? decodedAccessToken.clid : "" });
});

app.delete("/account/api/oauth/sessions/kill", verifyToken, async (req, res) => {
    const i = global.accessTokens.findIndex(i => i.accountId === req.user.accountId);
    if (i !== -1) global.accessTokens.splice(i, 1);
    functions.UpdateTokens();
    res.status(204).send();
});

app.delete("/account/api/oauth/sessions/kill/:token", verifyToken, async (req, res) => {
    const i = global.accessTokens.findIndex(i => i.token === req.params.token.replace("eg1~", ""));
    if (i !== -1) global.accessTokens.splice(i, 1);
    functions.UpdateTokens();
    res.status(204).send();
});

module.exports = app;

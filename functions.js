const XMLBuilder = require("xmlbuilder");
const uuid = require("uuid");
const bcrypt = require("bcrypt");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const User = require("../model/user.js");
const Profile = require("../model/profiles.js");
const profileManager = require("../structs/profile.js");
const Friends = require("../model/friends.js");
const buildcompat = require("../structs/buildcompat.js");

async function sleep(ms) {
    await new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    })
}

function GetVersionInfo(req) {
    let memory = {
        season: 0,
        build: 0.0,
        CL: "0",
        lobby: ""
    }

    if (!req.headers["user-agent"]) return memory;

    const ua = req.headers["user-agent"];
    let CL = "";

    // --- Extract changelist (CL) ---
    // Handles patterns like:
    //   "...Fortnite/++Fortnite+Release-1.8-CL-3724489-Windows..."
    //   "...FortniteClient-Win64-Shipping 3724489,..."
    //   "...FortniteClient-Win64-Shipping-3724489+..."
    try {
        let BuildID = ua.split("-")[3].split(",")[0];
        if (!Number.isNaN(Number(BuildID))) CL = BuildID;
        else {
            BuildID = ua.split("-")[3].split(" ")[0];
            if (!Number.isNaN(Number(BuildID))) CL = BuildID;
        }
    } catch {
        try {
            let BuildID = ua.split("-")[1].split("+")[0];
            if (!Number.isNaN(Number(BuildID))) CL = BuildID;
        } catch {}
    }

    // Also try extracting CL directly from "CL-XXXXXXX" pattern
    if (!CL || CL === "0") {
        try {
            const clMatch = ua.match(/CL-(\d+)/);
            if (clMatch) CL = clMatch[1];
        } catch {}
    }

    // --- Extract build number from Release-X.Y ---
    try {
        let Build = ua.split("Release-")[1].split("-")[0];

        // Handle 3-part version like "1.8.2" -> "1.82"
        if (Build.split(".").length === 3) {
            const Value = Build.split(".");
            Build = Value[0] + "." + Value[1] + Value[2];
        }

        // Handle 2-part version "10.00" -> keep as "10.00" = 10.0
        memory.season = Number(Build.split(".")[0]);
        memory.build  = Number(Build);
        memory.CL     = CL;

        if (Number.isNaN(memory.season) || Number.isNaN(memory.build)) throw new Error("Bad build parse");

        // Default lobby based on season
        memory.lobby = getSeasonLobby(memory.season, memory.build, memory.CL);
        return memory;
    } catch {}

    // --- CL-only fallback for very old builds (pre-Season / S1-S2) ---
    const clNum = Number(CL);
    memory.CL = CL;

    // Map using the CL_RANGES table in buildcompat
    const match = buildcompat.CL_RANGES.find(r => clNum >= r.min && clNum <= r.max);
    if (match) {
        memory.season = match.season;
        memory.build  = match.build;
        memory.lobby  = match.lobby;
        return memory;
    }

    // Last-resort numeric CL thresholds (original logic, extended)
    if (clNum < 3532353) {
        memory.season = 0; memory.build = 0.0; memory.lobby = "LobbySeason0";
    } else if (clNum < 3724489) {
        memory.season = 0; memory.build = 0.0; memory.lobby = "LobbyPreSeason";
    } else if (clNum <= 3790078) {
        memory.season = 1; memory.build = 1.0; memory.lobby = "LobbySeason1";
    } else if (clNum <= 3899000) {
        memory.season = 2; memory.build = 2.0; memory.lobby = "LobbyWinterDecor";
    } else {
        memory.season = 0; memory.build = 0.0; memory.lobby = "LobbySeason0";
    }

    return memory;
}

/**
 * Returns the correct lobby string for a given season/build/CL.
 * Handles all known lobby name quirks across the build archive.
 */
function getSeasonLobby(season, build, CL) {
    // Season 10 is "seasonx"
    if (season === 10) return "LobbySeason10";

    // Winter lobbies
    if (season === 2)  return "LobbyWinterDecor";
    if (season === 7)  return "LobbySeason7";

    // Chapter 2 S1 winter holiday builds
    if (season === 11) {
        if (build === 11.31 || build === 11.40) return "LobbyWinter2019";
        return "LobbySeason11";
    }

    // S19 has a winterfest lobby
    if (season === 19) {
        if (build <= 19.01) return "LobbyWinter2021";
        return "LobbySeason19";
    }

    return `LobbySeason${season}`;
}

function getContentPages(req) {
    const memory = GetVersionInfo(req);
    const contentpages = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "responses", "contentpages.json")).toString());

    let Language = "en";
    try {
        if (req.headers["accept-language"]) {
            const lang = req.headers["accept-language"];
            if (lang.includes("-") && lang !== "es-419") Language = lang.split("-")[0];
            else Language = lang;
        }
    } catch {}

    const modes = ["saveTheWorldUnowned", "battleRoyale", "creative", "saveTheWorld"];
    const news  = ["savetheworldnews", "battleroyalenews"];

    try {
        modes.forEach(mode => {
            if (!contentpages.subgameselectdata?.[mode]?.message) return;
            contentpages.subgameselectdata[mode].message.title = contentpages.subgameselectdata[mode].message.title[Language] || contentpages.subgameselectdata[mode].message.title["en"];
            contentpages.subgameselectdata[mode].message.body  = contentpages.subgameselectdata[mode].message.body[Language]  || contentpages.subgameselectdata[mode].message.body["en"];
        });
    } catch {}

    try {
        // Very old builds (pre S5.30) get a simplified news image
        if (memory.build < 5.30) {
            news.forEach(mode => {
                if (!contentpages[mode]?.news?.messages) return;
                contentpages[mode].news.messages[0].image = "https://cdn.discordapp.com/attachments/927739901540188200/930879507496308736/discord.png";
                if (contentpages[mode].news.messages[1])
                    contentpages[mode].news.messages[1].image = "https://cdn.discordapp.com/attachments/927739901540188200/930879519882088508/lawin.png";
            });
        }
    } catch {}

    try {
        if (!contentpages.dynamicbackgrounds?.backgrounds?.backgrounds) throw new Error();

        const bgs = contentpages.dynamicbackgrounds.backgrounds.backgrounds;

        // Default: season stage
        let stage = `season${memory.season}`;
        if (memory.season === 10) stage = "seasonx";

        // Build-specific overrides
        if (memory.build === 11.31 || memory.build === 11.40) stage = "Winter19";
        if (memory.season === 19 && memory.build <= 19.01)    stage = "winter2021";

        bgs[0].stage = stage;
        if (bgs[1]) bgs[1].stage = stage;

        // Background image overrides per season/build
        const bgImages = {
            "19.01": { img: "https://cdn.discordapp.com/attachments/927739901540188200/930880158167085116/t-bp19-lobby-xmas-2048x1024-f85d2684b4af.png" },
            "20.40": { img: "https://cdn2.unrealengine.com/t-bp20-40-armadillo-glowup-lobby-2048x2048-2048x2048-3b83b887cc7f.jpg" },
            "20":    { img: "https://cdn2.unrealengine.com/t-bp20-lobby-2048x1024-d89eb522746c.png" },
            "21":    { img: "https://cdn2.unrealengine.com/s21-lobby-background-2048x1024-2e7112b25dc3.jpg" },
        };

        if (memory.build === 19.01) {
            bgs[0].backgroundimage = bgImages["19.01"].img;
            if (contentpages.subgameinfo?.battleroyale)
                contentpages.subgameinfo.battleroyale.image = "https://cdn.discordapp.com/attachments/927739901540188200/930880421514846268/19br-wf-subgame-select-512x1024-16d8bb0f218f.jpg";
            if (contentpages.specialoffervideo)
                contentpages.specialoffervideo.bSpecialOfferEnabled = "true";
        } else if (memory.season === 20) {
            bgs[0].backgroundimage = (memory.build === 20.40) ? bgImages["20.40"].img : bgImages["20"].img;
        } else if (memory.season === 21) {
            bgs[0].backgroundimage = bgImages["21"].img;
        }
    } catch {}

    return contentpages;
}

function getItemShop() {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "responses", "catalog.json")).toString());
    const CatalogConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "Config", "catalog_config.json")).toString());

    try {
        for (let value in CatalogConfig) {
            if (!Array.isArray(CatalogConfig[value].itemGrants)) continue;
            if (CatalogConfig[value].itemGrants.length === 0) continue;

            const CatalogEntry = {
                "devName": "", "offerId": "", "fulfillmentIds": [], "dailyLimit": -1,
                "weeklyLimit": -1, "monthlyLimit": -1, "categories": [],
                "prices": [{ "currencyType": "MtxCurrency", "currencySubType": "", "regularPrice": 0,
                    "finalPrice": 0, "saleExpiration": "9999-12-02T01:12:00Z", "basePrice": 0 }],
                "meta": { "SectionId": "Featured", "TileSize": "Small" },
                "matchFilter": "", "filterWeight": 0, "appStoreId": [], "requirements": [],
                "offerType": "StaticPrice",
                "giftInfo": { "bIsEnabled": true, "forcedGiftBoxTemplateId": "", "purchaseRequirements": [], "giftRecordIds": [] },
                "refundable": false,
                "metaInfo": [{ "key": "SectionId", "value": "Featured" }, { "key": "TileSize", "value": "Small" }],
                "displayAssetPath": "", "itemGrants": [], "sortPriority": 0, "catalogGroupPriority": 0
            };

            const isDaily = value.toLowerCase().startsWith("daily");
            const storefrontName = isDaily ? "BRDailyStorefront" : "BRWeeklyStorefront";
            let i = catalog.storefronts.findIndex(p => p.name === storefrontName);
            if (i === -1) continue;

            if (isDaily) {
                CatalogEntry.sortPriority = -1;
            } else {
                CatalogEntry.meta.TileSize = "Normal";
                CatalogEntry.metaInfo[1].value = "Normal";
            }

            for (let itemGrant of CatalogConfig[value].itemGrants) {
                if (typeof itemGrant !== "string" || itemGrant.length === 0) continue;
                CatalogEntry.requirements.push({ "requirementType": "DenyOnItemOwnership", "requiredId": itemGrant, "minQuantity": 1 });
                CatalogEntry.itemGrants.push({ "templateId": itemGrant, "quantity": 1 });
            }

            CatalogEntry.prices = [{
                "currencyType": "MtxCurrency", "currencySubType": "",
                "regularPrice": CatalogConfig[value].price, "finalPrice": CatalogConfig[value].price,
                "saleExpiration": "9999-12-02T01:12:00Z", "basePrice": CatalogConfig[value].price
            }];

            if (CatalogEntry.itemGrants.length > 0) {
                const uniqueId = crypto.createHash("sha1").update(`${JSON.stringify(CatalogConfig[value].itemGrants)}_${CatalogConfig[value].price}`).digest("hex");
                CatalogEntry.devName = uniqueId;
                CatalogEntry.offerId = uniqueId;
                catalog.storefronts[i].catalogEntries.push(CatalogEntry);
            }
        }
    } catch {}

    return catalog;
}

function getOfferID(offerId) {
    const catalog = getItemShop();
    for (let storefront of catalog.storefronts) {
        const found = storefront.catalogEntries.find(i => i.offerId === offerId);
        if (found) return { name: storefront.name, offerId: found };
    }
}

function MakeID() {
    return uuid.v4();
}

function sendXmppMessageToAll(body) {
    if (!global.Clients) return;
    if (typeof body === "object") body = JSON.stringify(body);
    global.Clients.forEach(ClientData => {
        ClientData.client.send(XMLBuilder.create("message")
            .attribute("from", `xmpp-admin@${global.xmppDomain}`)
            .attribute("xmlns", "jabber:client")
            .attribute("to", ClientData.jid)
            .element("body", `${body}`).up().toString());
    });
}

function sendXmppMessageToId(body, toAccountId) {
    if (!global.Clients) return;
    if (typeof body === "object") body = JSON.stringify(body);
    const receiver = global.Clients.find(i => i.accountId === toAccountId);
    if (!receiver) return;
    receiver.client.send(XMLBuilder.create("message")
        .attribute("from", `xmpp-admin@${global.xmppDomain}`)
        .attribute("to", receiver.jid)
        .attribute("xmlns", "jabber:client")
        .element("body", `${body}`).up().toString());
}

function getPresenceFromUser(fromId, toId, offline) {
    if (!global.Clients) return;
    const SenderData = global.Clients.find(i => i.accountId === fromId);
    const ClientData = global.Clients.find(i => i.accountId === toId);
    if (!SenderData || !ClientData) return;

    let xml = XMLBuilder.create("presence")
        .attribute("to", ClientData.jid)
        .attribute("xmlns", "jabber:client")
        .attribute("from", SenderData.jid)
        .attribute("type", offline ? "unavailable" : "available");

    if (SenderData.lastPresenceUpdate.away)
        xml = xml.element("show", "away").up().element("status", SenderData.lastPresenceUpdate.status).up();
    else
        xml = xml.element("status", SenderData.lastPresenceUpdate.status).up();

    ClientData.client.send(xml.toString());
}

async function registerUser(discordId, username, email, plainPassword) {
    email = email.toLowerCase();
    if (!discordId || !username || !email || !plainPassword) return { message: "Username/email/password is required.", status: 400 };
    if (await User.findOne({ discordId })) return { message: "You already created an account!", status: 400 };

    const accountId = MakeID().replace(/-/ig, "");
    const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailFilter.test(email)) return { message: "You did not provide a valid email address!", status: 400 };
    if (username.length >= 25)  return { message: "Your username must be less than 25 characters long.", status: 400 };
    if (username.length < 3)    return { message: "Your username must be at least 3 characters long.", status: 400 };
    if (plainPassword.length >= 128) return { message: "Your password must be less than 128 characters long.", status: 400 };
    if (plainPassword.length < 8)    return { message: "Your password must be at least 8 characters long.", status: 400 };

    const allowedCharacters = (" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~").split("");
    for (let character of username) {
        if (!allowedCharacters.includes(character)) return { message: "Your username has special characters, please remove them and try again.", status: 400 };
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    try {
        await User.create({
            created: new Date().toISOString(), discordId, accountId,
            username, username_lower: username.toLowerCase(), email, password: hashedPassword
        }).then(async (i) => {
            await Profile.create({ created: i.created, accountId: i.accountId, profiles: profileManager.createProfiles(i.accountId) });
            await Friends.create({ created: i.created, accountId: i.accountId });
        });
    } catch (err) {
        if (err.code === 11000) return { message: "Username or email is already in use.", status: 400 };
        return { message: "An unknown error has occurred, please try again later.", status: 400 };
    }

    return { message: `Successfully created an account with the username ${username}`, status: 200 };
}

function DecodeBase64(str) {
    return Buffer.from(str, "base64").toString();
}

function UpdateTokens() {
    fs.writeFileSync("./tokenManager/tokens.json", JSON.stringify({
        accessTokens: global.accessTokens,
        refreshTokens: global.refreshTokens,
        clientTokens: global.clientTokens
    }, null, 2));
}

module.exports = {
    sleep,
    GetVersionInfo,
    getContentPages,
    getItemShop,
    getOfferID,
    MakeID,
    sendXmppMessageToAll,
    sendXmppMessageToId,
    getPresenceFromUser,
    registerUser,
    DecodeBase64,
    UpdateTokens,
    getSeasonLobby,
};

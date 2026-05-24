const express = require("express");
const app = express.Router();
const functions = require("../structs/functions.js");

// Dynamic version check – returns NO_UPDATE for all builds
app.get("/fortnite/api/version", (req, res) => {
    const memory = functions.GetVersionInfo(req);

    // Return version info reflecting the connecting client's season where possible
    const build = memory.build > 0 ? String(memory.build) : "18.30";
    const cl    = memory.CL    !== "0" ? memory.CL : "17951730";

    res.json({
        "app": "fortnite",
        "serverDate": new Date().toISOString(),
        "overridePropertiesVersion": "unknown",
        "cln": cl,
        "build": "444",
        "moduleName": "Fortnite-Core",
        "buildDate": "2021-10-27T21:00:51.697Z",
        "version": build,
        "branch": `Release-${build}`,
        "modules": {
            "Epic-LightSwitch-AccessControlCore": {
                "cln": "17237679", "build": "b2130",
                "buildDate": "2021-08-19T18:56:08.144Z",
                "version": "1.0.0", "branch": "trunk"
            },
            "epic-xmpp-api-v1-base": {
                "cln": "5131a23c1470acbd9c94fae695ef7d899c1a41d6",
                "build": "b3595", "buildDate": "2019-07-30T09:11:06.587Z",
                "version": "0.0.1", "branch": "master"
            },
            "epic-common-core": {
                "cln": "17909521", "build": "3217",
                "buildDate": "2021-10-25T18:41:12.496Z",
                "version": "3.0", "branch": "TRUNK"
            }
        }
    });
});

// All version-check endpoints return NO_UPDATE regardless of build
app.get("/fortnite/api*/versioncheck*", (req, res) => {
    res.json({ "type": "NO_UPDATE" });
});

// Catch-all for any other versioncheck-style routes used by newer builds
app.get("/fortnite/api/v2/versioncheck*", (req, res) => {
    res.json({ "type": "NO_UPDATE" });
});

module.exports = app;

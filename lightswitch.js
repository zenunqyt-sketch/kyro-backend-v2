const express = require("express");
const app     = express.Router();
const functions = require("../structs/functions.js");

const serviceStatus = {
    "serviceInstanceId": "fortnite",
    "status": "UP",
    "message": "Fortnite is online",
    "maintenanceUri": null,
    "overrideCatalogIds": ["a7f138b2e51945ffbfdacc1af0541053"],
    "allowedActions": ["PLAY", "DOWNLOAD"],
    "banned": false,
    "launcherInfoDTO": {
        "appName": "Fortnite",
        "catalogItemId": "4fe75bbc5a674f4f9b356b5c90567da5",
        "namespace": "fn"
    }
};

app.get("/lightswitch/api/service/Fortnite/status", (req, res) => {
    res.json({ ...serviceStatus, "allowedActions": [] });
});

app.get("/lightswitch/api/service/bulk/status", (req, res) => {
    res.json([serviceStatus]);
});

// EOS / newer lightswitch route used by S13+ builds
app.get("/lightswitch/api/service/*/status", (req, res) => {
    res.json({ ...serviceStatus, "allowedActions": [] });
});

module.exports = app;

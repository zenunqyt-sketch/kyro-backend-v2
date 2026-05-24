const express   = require("express");
const app       = express.Router();
const functions = require("../structs/functions.js");

// All known content pages / news endpoints across build history
app.get("/content/api/pages/fortnite-game*", (req, res) => {
    res.json(functions.getContentPages(req));
});

// Older builds (pre-S5) used a different path
app.get("/fortnite-game*", (req, res) => {
    res.json(functions.getContentPages(req));
});

module.exports = app;

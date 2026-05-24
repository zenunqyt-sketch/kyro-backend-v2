const express = require("express");
const app     = express.Router();
const fs      = require("fs");
const path    = require("path");
const crypto  = require("crypto");

const { verifyToken } = require("../tokenManager/tokenVerify.js");
const functions = require("../structs/functions.js");

const CloudStorageDir    = path.join(__dirname, "..", "CloudStorage");
const ClientSettingsDir  = path.join(__dirname, "..", "ClientSettings");

// Ensure ClientSettings dir exists at startup
if (!fs.existsSync(ClientSettingsDir)) fs.mkdirSync(ClientSettingsDir);

// List system cloud storage files
app.get("/fortnite/api/cloudstorage/system", (req, res) => {
    let files = [];
    try {
        fs.readdirSync(CloudStorageDir).forEach(file => {
            const filePath = path.join(CloudStorageDir, file);
            const stat     = fs.statSync(filePath);
            const content  = fs.readFileSync(filePath);
            files.push({
                uniqueFilename: file,
                filename: file,
                hash: crypto.createHash("sha1").update(content).digest("hex"),
                hash256: crypto.createHash("sha256").update(content).digest("hex"),
                length: stat.size,
                contentType: "application/octet-stream",
                uploaded: stat.mtime.toISOString(),
                storageType: "S3",
                doNotCache: false
            });
        });
    } catch {}
    res.json(files);
});

// Serve individual cloud storage files
app.get("/fortnite/api/cloudstorage/system/:file", (req, res) => {
    const filePath = path.join(CloudStorageDir, req.params.file);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.set("Content-Type", "application/octet-stream");
    res.send(fs.readFileSync(filePath));
});

// List user cloud storage (ClientSettings)
app.get("/fortnite/api/cloudstorage/user/:accountId", verifyToken, (req, res) => {
    let files = [];
    const dir  = path.join(ClientSettingsDir, req.user.accountId);

    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            const filePath = path.join(dir, file);
            const stat     = fs.statSync(filePath);
            const content  = fs.readFileSync(filePath);
            files.push({
                uniqueFilename: file,
                filename: file,
                hash: crypto.createHash("sha1").update(content).digest("hex"),
                hash256: crypto.createHash("sha256").update(content).digest("hex"),
                length: stat.size,
                contentType: "application/octet-stream",
                uploaded: stat.mtime.toISOString(),
                storageType: "S3",
                doNotCache: true
            });
        });
    }
    res.json(files);
});

// Get individual user settings file
app.get("/fortnite/api/cloudstorage/user/:accountId/:file", verifyToken, (req, res) => {
    const filePath = path.join(ClientSettingsDir, req.user.accountId, req.params.file);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.set("Content-Type", "application/octet-stream");
    res.send(fs.readFileSync(filePath));
});

// Upload / update user settings file
app.put("/fortnite/api/cloudstorage/user/:accountId/:file", verifyToken, (req, res) => {
    const memory = functions.GetVersionInfo(req);

    // Very old builds (pre-S4) don't use client settings
    if (memory.build < 4.0) return res.status(204).end();

    const dir = path.join(ClientSettingsDir, req.user.accountId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, req.params.file);

    try {
        // body may be raw buffer or parsed by express
        let body = req.body;
        if (Buffer.isBuffer(body)) {
            fs.writeFileSync(filePath, body);
        } else if (typeof body === "object" && body !== null && Object.keys(body).length > 0) {
            fs.writeFileSync(filePath, JSON.stringify(body));
        } else {
            // collect raw chunks
            let rawData = [];
            req.on("data", chunk => rawData.push(chunk));
            req.on("end", () => {
                fs.writeFileSync(filePath, Buffer.concat(rawData));
                return res.status(204).end();
            });
            return;
        }
    } catch {}

    res.status(204).end();
});

module.exports = app;

/**
 * buildcompat.js - Multi-build compatibility layer for Kyro FN Backend
 * Supports all builds from the fortnite-builds-archive (Pre-Season through Season 39+)
 * 
 * Build ranges sourced from: https://github.com/llamaqwerty/fortnite-builds-archive
 */

// CL (changelist) to season/build mapping for very early builds that lack Release-X.Y user-agent
const CL_RANGES = [
    // Pre-Season / Cert builds
    { min: 3532353, max: 3541083, season: 0,  build: 0.0,  label: "Pre-Season (Cert)",      lobby: "LobbyPreSeason" },
    // Season 1
    { min: 3724489, max: 3741772, season: 1,  build: 1.8,  label: "Season 1 (1.8.x)",       lobby: "LobbySeason1" },
    { min: 3757339, max: 3757339, season: 1,  build: 1.9,  label: "Season 1 (1.9.0)",       lobby: "LobbySeason1" },
    { min: 3775276, max: 3785438, season: 1,  build: 1.91, label: "Season 1 (1.9.1+)",      lobby: "LobbySeason1" },
    { min: 3790078, max: 3806000, season: 1,  build: 1.10, label: "Season 1 (1.10.0)",      lobby: "LobbySeason1" },
    // Season 2
    { min: 3807424, max: 3807424, season: 2,  build: 1.11, label: "Season 2 (1.11.0)",      lobby: "LobbyWinterDecor" },
    { min: 3825894, max: 3870737, season: 2,  build: 2.0,  label: "Season 2 (2.x)",         lobby: "LobbyWinterDecor" },
    { min: 3889387, max: 3899000, season: 2,  build: 2.5,  label: "Season 2 (2.5.0)",       lobby: "LobbyWinterDecor" },
];

/**
 * Build-specific feature flags & quirks per season/build range
 * These are used in routes to tailor responses per build.
 */
const BUILD_QUIRKS = {
    // Very early builds (OT6.5 and pre-Season) - no party/friends UI
    preSeason: { maxBuild: 0.5, hasParty: false, hasXMPP: false, hasBattlePass: false, hasItemShop: false, hasClientSettings: false },

    season1: { minBuild: 1.0, maxBuild: 1.99,
        hasParty: false, hasXMPP: true, hasBattlePass: false, hasItemShop: false,
        hasClientSettings: false, mcp_uses_rvn: false },

    season2: { minBuild: 2.0, maxBuild: 2.99,
        hasParty: false, hasXMPP: true, hasBattlePass: false, hasItemShop: false,
        hasClientSettings: false, mcp_uses_rvn: false },

    season3: { minBuild: 3.0, maxBuild: 3.99,
        hasParty: false, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: false, mcp_uses_rvn: false },

    season4: { minBuild: 4.0, maxBuild: 4.99,
        hasParty: false, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season5: { minBuild: 5.0, maxBuild: 5.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season6: { minBuild: 6.0, maxBuild: 6.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season7: { minBuild: 7.0, maxBuild: 7.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season8: { minBuild: 8.0, maxBuild: 8.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season9: { minBuild: 9.0, maxBuild: 9.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    // S10 / "Season X"
    season10: { minBuild: 10.0, maxBuild: 10.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false, lobbyOverride: "seasonx" },

    // Chapter 2 starts at build 11
    season11: { minBuild: 11.0, maxBuild: 11.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: false },

    season12: { minBuild: 12.0, maxBuild: 12.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: true },

    // commandRevision introduced at 12.20
    season12_20plus: { minBuild: 12.20, maxBuild: 12.99,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: true, usesCommandRevision: true },

    // All builds 13+
    modern: { minBuild: 13.0, maxBuild: 9999,
        hasParty: true, hasXMPP: true, hasBattlePass: true, hasItemShop: true,
        hasClientSettings: true, mcp_uses_rvn: true, usesCommandRevision: true },
};

/**
 * Returns the feature flags for a given build number.
 * @param {number} build - e.g. 12.41
 * @returns {object} quirk flags
 */
function getBuildQuirks(build) {
    if (build <= 0.5) return BUILD_QUIRKS.preSeason;
    if (build < 2.0)  return BUILD_QUIRKS.season1;
    if (build < 3.0)  return BUILD_QUIRKS.season2;
    if (build < 4.0)  return BUILD_QUIRKS.season3;
    if (build < 5.0)  return BUILD_QUIRKS.season4;
    if (build < 6.0)  return BUILD_QUIRKS.season5;
    if (build < 7.0)  return BUILD_QUIRKS.season6;
    if (build < 8.0)  return BUILD_QUIRKS.season7;
    if (build < 9.0)  return BUILD_QUIRKS.season8;
    if (build < 10.0) return BUILD_QUIRKS.season9;
    if (build < 11.0) return BUILD_QUIRKS.season10;
    if (build < 12.0) return BUILD_QUIRKS.season11;
    if (build < 12.20) return BUILD_QUIRKS.season12;
    if (build < 13.0) return BUILD_QUIRKS.season12_20plus;
    return BUILD_QUIRKS.modern;
}

/**
 * Build the correct timeline event list for older seasons that need specific event flags.
 * @param {object} memory - result of GetVersionInfo()
 * @returns {Array} activeEvents array
 */
function getActiveEvents(memory) {
    const events = [];
    const season = memory.season;
    const build  = memory.build;

    // Season flag - always present
    events.push({
        eventType: season === 10 ? "EventFlag.LobbySeason10" : `EventFlag.Season${season}`,
        activeUntil: "9999-01-01T00:00:00.000Z",
        activeSince: "2020-01-01T00:00:00.000Z"
    });

    // Lobby / dynamic background flag
    const lobby = memory.lobby;
    if (lobby) {
        events.push({
            eventType: `EventFlag.${lobby}`,
            activeUntil: "9999-01-01T00:00:00.000Z",
            activeSince: "2020-01-01T00:00:00.000Z"
        });
    }

    // Season-specific bonus events
    if (season === 2) {
        events.push({ eventType: "EventFlag.LobbyWinterDecor", activeUntil: "9999-01-01T00:00:00.000Z", activeSince: "2020-01-01T00:00:00.000Z" });
    }
    if (season === 6) {
        events.push({ eventType: "EventFlag.LobbyHalloween", activeUntil: "9999-01-01T00:00:00.000Z", activeSince: "2020-01-01T00:00:00.000Z" });
    }
    if (season === 7 || (season === 11 && (build === 11.31 || build === 11.40))) {
        events.push({ eventType: "EventFlag.LobbyWinter", activeUntil: "9999-01-01T00:00:00.000Z", activeSince: "2020-01-01T00:00:00.000Z" });
    }
    if (season === 14 || season === 19) {
        // Halloween / Winterfest seasons
        events.push({ eventType: "EventFlag.LobbyHalloween", activeUntil: "9999-01-01T00:00:00.000Z", activeSince: "2020-01-01T00:00:00.000Z" });
    }

    return events;
}

/**
 * Return the correct season template ID string used in timeline state.
 * OG seasons 1-10 and chapter 2+ have different patterns.
 */
function getSeasonTemplateId(season) {
    return `AthenaSeason:athenaseason${season}`;
}

/**
 * Returns the correct playlist name for a given build.
 * Pre-S5 builds don't support named playlists the same way.
 * For build 13.x (Ch2 S3) the default non-Arena mode is DefaultSolo;
 * Arena playlists are injected by arena.js at session-response time.
 */
function getDefaultPlaylist(build) {
    if (build < 5.0)  return "Playlist_DefaultSolo";
    if (build < 11.0) return "Playlist_DefaultSolo";
    // Ch2 builds use ShowdownAlt naming for the generic default
    return "Playlist_DefaultSolo";
}

/**
 * Returns the correct Arena playlist for a given build and mode.
 * @param {number} build  - e.g. 13.40
 * @param {string} mode   - "Solo" | "Duos"
 */
function getArenaPlaylist(build, mode) {
    // All Ch2 builds that have Arena use ShowdownAlt
    if (build >= 11.0) {
        return `Playlist_ShowdownAlt_${mode}`;
    }
    // Ch1 S6–S10 used Showdown (no Alt)
    return `Playlist_Showdown_${mode}`;
}

/**
 * Returns correct buildVersion string for launcher/assets API per build.
 */
function getLauncherBuildVersion(memory) {
    const season = memory.season;
    const build  = memory.build;
    const cl     = memory.CL;

    if (!cl || cl === "0") return `++Fortnite+Release-${build}-CL-00000000-Windows`;
    return `++Fortnite+Release-${build}-CL-${cl}-Windows`;
}

module.exports = {
    CL_RANGES,
    BUILD_QUIRKS,
    getBuildQuirks,
    getActiveEvents,
    getSeasonTemplateId,
    getDefaultPlaylist,
    getArenaPlaylist,
    getLauncherBuildVersion,
};

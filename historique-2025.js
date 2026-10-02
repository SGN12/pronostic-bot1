const data = require("./test-2025-26.json");

// IDs API-Football des équipes de Premier League 2025/26
const IDS = {
    "AFC Bournemouth": 35,
    "Arsenal FC": 42,
    "Aston Villa FC": 66,
    "Brentford FC": 55,
    "Brighton & Hove Albion FC": 51,
    "Burnley FC": 44,
    "Chelsea FC": 49,
    "Crystal Palace FC": 52,
    "Everton FC": 45,
    "Fulham FC": 36,
    "Leeds United FC": 63,
    "Liverpool FC": 40,
    "Manchester City FC": 50,
    "Manchester United FC": 33,
    "Newcastle United FC": 34,
    "Nottingham Forest FC": 65,
    "Sunderland AFC": 746,
    "Tottenham Hotspur FC": 47,
    "West Ham United FC": 48,
    "Wolverhampton Wanderers FC": 39
};

function convertirMatch(match) {
    const homeId = IDS[match.team1];
    const awayId = IDS[match.team2];

    if (!homeId || !awayId) {
        return null;
    }

    if (
        !match.score ||
        !Array.isArray(match.score.ft) ||
        match.score.ft.length !== 2
    ) {
        return null;
    }

    const homeGoals = match.score.ft[0];
    const awayGoals = match.score.ft[1];

    if (
        typeof homeGoals !== "number" ||
        typeof awayGoals !== "number"
    ) {
        return null;
    }

    return {
        date: new Date(
            `${match.date}T${match.time || "00:00"}:00`
        ),

        homeId,
        awayId,

        homeName: match.team1,
        awayName: match.team2,

        homeGoals,
        awayGoals
    };
}

const matchs = data.matches
    .map(convertirMatch)
    .filter(Boolean);

console.log("=================================");
console.log("📊 HISTORIQUE PREMIER LEAGUE");
console.log("=================================");
console.log("📅 Saison : 2025/26");
console.log("📦 Matchs dans le fichier :", data.matches.length);
console.log("✅ Matchs exploitables :", matchs.length);
console.log(
    "⏳ Matchs sans score final :",
    data.matches.length - matchs.length
);
console.log("=================================");

module.exports = matchs;

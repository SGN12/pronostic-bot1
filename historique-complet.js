const axios = require("axios");
require("dotenv").config();

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LEAGUE = 39;

const HEADERS = {
    "x-apisports-key":
        process.env.API_FOOTBALL_KEY
};

const historique2025 =
    require("./historique-2025");

async function chargerSaisonAPI(saison) {
    console.log(`⏳ Chargement saison ${saison}...`);

    const response = await axios.get(
        API_URL,
        {
            params: {
                league: LEAGUE,
                season: saison,
                status: "FT"
            },
            headers: HEADERS,
            timeout: 30000
        }
    );

    const matchs =
        (response.data.response || [])
            .map(match => ({
                date: new Date(
                    match.fixture.date
                ),

                homeId:
                    match.teams.home.id,

                awayId:
                    match.teams.away.id,

                homeName:
                    match.teams.home.name,

                awayName:
                    match.teams.away.name,

                homeGoals:
                    match.goals.home,

                awayGoals:
                    match.goals.away
            }))
            .filter(match =>
                match.homeGoals !== null &&
                match.awayGoals !== null
            );

    console.log(
        `✅ Saison ${saison} : ${matchs.length} matchs`
    );

    return matchs;
}

async function chargerHistoriqueComplet() {

    const saisons = [
        2022,
        2023,
        2024
    ];

    let historique = [];

    for (const saison of saisons) {
        const matchs =
            await chargerSaisonAPI(saison);

        historique.push(...matchs);
    }

    historique.push(...historique2025);

    historique.sort(
        (a, b) =>
            a.date - b.date
    );

    console.log(
        "================================="
    );

    console.log(
        "📊 HISTORIQUE COMPLET"
    );

    console.log(
        "📦 Total :",
        historique.length,
        "matchs"
    );

    console.log(
        "📅 Saisons : 2022 → 2025/26"
    );

    console.log(
        "================================="
    );

    return historique;
}

module.exports = {
    chargerHistoriqueComplet
};

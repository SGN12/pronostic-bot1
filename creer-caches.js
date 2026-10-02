const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const API_URL = "https://v3.football.api-sports.io/fixtures";

const competitions = {
    afriqueDuSud: { nom: "Premier Soccer League", leagueId: 380 },
    grece: { nom: "Super League", leagueId: 197 },
    autriche: { nom: "Bundesliga", leagueId: 218 },
    danemark: { nom: "Superliga", leagueId: 119 },
    suede: { nom: "Allsvenskan", leagueId: 113 },
    norvege: { nom: "Eliteserien", leagueId: 103 },
    roumanie: { nom: "Liga I", leagueId: 283 }
};

const saisons = [2022, 2023, 2024];

const headers = {
    "x-apisports-key": process.env.API_FOOTBALL_KEY
};

function normaliserMatch(match) {
    return {
        id: match.fixture?.id,
        date: new Date(match.fixture?.date),

        homeId: match.teams?.home?.id,
        awayId: match.teams?.away?.id,

        homeName: match.teams?.home?.name,
        awayName: match.teams?.away?.name,

        homeGoals: match.goals?.home,
        awayGoals: match.goals?.away
    };
}

async function chargerCompetition(code, config) {
    console.log(`\n🏆 ${config.nom}`);

    let historique = [];

    for (const saison of saisons) {
        console.log(`⏳ Saison ${saison}...`);

        try {
            const response = await axios.get(API_URL, {
                params: {
                    league: config.leagueId,
                    season: saison,
                    status: "FT"
                },
                headers,
                timeout: 30000
            });

            if (response.data.errors &&
                Object.keys(response.data.errors).length) {

                console.log(
                    `❌ Erreur API ${saison}:`,
                    response.data.errors
                );

                continue;
            }

            const matchs = (response.data.response || [])
                .map(normaliserMatch)
                .filter(m =>
                    m.homeId &&
                    m.awayId &&
                    m.homeGoals !== null &&
                    m.awayGoals !== null
                );

            console.log(`✅ ${matchs.length} matchs`);

            historique.push(...matchs);

        } catch (error) {
            console.log(
                `❌ Erreur ${saison}:`,
                error.response?.data || error.message
            );
        }
    }

    historique.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    const fichier = path.join(
        __dirname,
        "data",
        `${code}.json`
    );

    fs.writeFileSync(
        fichier,
        JSON.stringify(historique, null, 2)
    );

    console.log(
        `💾 ${fichier} → ${historique.length} matchs`
    );
}

async function main() {
    if (!process.env.API_FOOTBALL_KEY) {
        console.error("❌ API_FOOTBALL_KEY introuvable dans .env");
        process.exit(1);
    }

    for (const [code, config] of Object.entries(competitions)) {
        await chargerCompetition(code, config);
    }

    console.log("\n🎉 Création des caches terminée.");
}

main();

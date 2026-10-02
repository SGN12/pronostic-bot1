const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const HEADERS = {
    "x-apisports-key":
        process.env.API_FOOTBALL_KEY
};

const COMPETITIONS = {
    premierLeague: {
        nom: "Premier League",
        leagueId: 39
    },

    laLiga: {
        nom: "La Liga",
        leagueId: 140
    },

    serieA: {
        nom: "Serie A",
        leagueId: 135
    },

    bundesliga: {
        nom: "Bundesliga",
        leagueId: 78
    },

    ligue1: {
        nom: "Ligue 1",
        leagueId: 61
    },

    championsLeague: {
        nom: "Champions League",
        leagueId: 2
    },

    primeiraLiga: {
        nom: "Primeira Liga",
        leagueId: 94
    },

    eredivisie: {
        nom: "Eredivisie",
        leagueId: 88
    },

    jupilerProLeague: {
        nom: "Jupiler Pro League",
        leagueId: 144
    },

    superLig: {
        nom: "Süper Lig",
        leagueId: 203
    },

    saudiProLeague: {
        nom: "Saudi Pro League",
        leagueId: 307
    },

    brasileirao: {
        nom: "Brasileirão",
        leagueId: 71
    },

    ligaArgentina: {
        nom: "Liga Argentina",
        leagueId: 128
    },

    mls: {
        nom: "MLS",
        leagueId: 253
    },

    europaLeague: {
        nom: "Europa League",
        leagueId: 3
    },

    conferenceLeague: {
        nom: "Conference League",
        leagueId: 848
    }
};

const SAISONS = [2022, 2023, 2024];

const DATA_DIR =
    path.join(__dirname, "data");

function normaliserMatch(match) {
    return {
        date: match.fixture.date,

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
    };
}

async function chargerSaison(
    competition,
    saison
) {
    const config =
        COMPETITIONS[competition];

    console.log(
        `⏳ ${config.nom} — saison ${saison}...`
    );

    const response =
        await axios.get(
            API_URL,
            {
                params: {
                    league:
                        config.leagueId,

                    season:
                        saison,

                    status: "FT"
                },

                headers:
                    HEADERS,

                timeout: 30000
            }
        );

    const matchs =
        (response.data.response || [])
            .map(normaliserMatch)
            .filter(match =>
                match.homeGoals !== null &&
                match.awayGoals !== null
            );

    console.log(
        `✅ ${config.nom} ${saison} : ${matchs.length} matchs`
    );

    return matchs;
}

function attendre(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function chargerSaisonAvecProtection(
    competition,
    saison
) {
    const config = COMPETITIONS[competition];

    for (let tentative = 1; tentative <= 3; tentative++) {
        try {
            return await chargerSaison(
                competition,
                saison
            );
        } catch (error) {
            const data = error.response?.data;

            const rateLimit =
                data?.errors?.rateLimit ||
                data?.errors?.rate_limit;

            if (!rateLimit) {
                throw error;
            }

            console.log("");
            console.log(
                `⚠️ Limite API atteinte pour ${config.nom} ${saison}.`
            );
            console.log(
                `⏳ Attente de 20 secondes... tentative ${tentative}/3`
            );

            await attendre(20000);
        }
    }

    throw new Error(
        `Impossible de charger ${competition} ${saison} après 3 tentatives.`
    );
}

async function remplirCache(
    competition
) {
    const config =
        COMPETITIONS[competition];

    if (!config) {
        throw new Error(
            `Compétition inconnue : ${competition}`
        );
    }

    const fichier =
        path.join(
            DATA_DIR,
            `${competition}.json`
        );

    // Ne gaspille aucune requête si le cache existe déjà.
    if (fs.existsSync(fichier)) {
        try {
            const contenu =
                JSON.parse(
                    fs.readFileSync(
                        fichier,
                        "utf8"
                    )
                );

            if (
                Array.isArray(contenu) &&
                contenu.length > 0
            ) {
                console.log("");
                console.log(
                    `⏭️ ${config.nom} déjà en cache : ${contenu.length} matchs`
                );
                console.log(
                    "🚫 Aucune requête API utilisée."
                );
                return;
            }
        } catch (e) {
            console.log(
                "⚠️ Cache existant invalide, téléchargement nécessaire."
            );
        }
    }

    let historique = [];

    for (
        let i = 0;
        i < SAISONS.length;
        i++
    ) {
        const saison =
            SAISONS[i];

        const matchs =
            await chargerSaisonAvecProtection(
                competition,
                saison
            );

        historique.push(...matchs);

        // Pause entre les requêtes API.
        if (i < SAISONS.length - 1) {
            console.log(
                "⏱️ Pause de 4 secondes avant la prochaine requête..."
            );

            await attendre(4000);
        }
    }

    historique.sort(
        (a, b) =>
            new Date(a.date) -
            new Date(b.date)
    );

    fs.writeFileSync(
        fichier,
        JSON.stringify(
            historique,
            null,
            2
        ),
        "utf8"
    );

    console.log("");
    console.log(
        `💾 Cache enregistré : ${fichier}`
    );

    console.log(
        `📊 Total : ${historique.length} matchs`
    );
}

async function main() {
    const competition =
        process.argv[2];

    if (!competition) {
        console.log("");
        console.log(
            "Utilisation :"
        );
        console.log(
            "node remplir-cache.js premierLeague"
        );
        console.log("");
        console.log(
            "Compétitions disponibles :"
        );

        Object.keys(
            COMPETITIONS
        ).forEach(c =>
            console.log(" -", c)
        );

        return;
    }

    try {
        await remplirCache(
            competition
        );
    } catch (error) {
        console.error("");
        console.error(
            "❌ Erreur :"
        );

        console.error(
            error.response?.data ||
            error.message
        );
    }
}

main();

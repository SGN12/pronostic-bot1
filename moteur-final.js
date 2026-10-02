const axios = require("axios");
require("dotenv").config();

const API_URL = "https://v3.football.api-sports.io/fixtures";
const LEAGUE = 39;

const HEADERS = {
    "x-apisports-key": process.env.API_FOOTBALL_KEY
};

// ==========================================
// CONFIGURATION
// ==========================================

const HOME_TEAM_ID = 49; // Chelsea
const AWAY_TEAM_ID = 42; // Arsenal

const SEASON = 2024;

// ==========================================
// OUTILS
// ==========================================

function moyenne(tab) {
    if (!tab.length) return 0;

    return tab.reduce((a, b) => a + b, 0) / tab.length;
}

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

function factorial(n) {
    if (n <= 1) return 1;

    let resultat = 1;

    for (let i = 2; i <= n; i++) {
        resultat *= i;
    }

    return resultat;
}

function poisson(k, lambda) {

    if (lambda <= 0) {
        return k === 0 ? 1 : 0;
    }

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
    );
}

// ==========================================
// RÉCUPÉRATION DES MATCHS
// ==========================================

async function chargerMatchs() {

    console.log("⏳ Récupération des matchs...");

    const response = await axios.get(API_URL, {
        params: {
            league: LEAGUE,
            season: SEASON,
            status: "FT"
        },
        headers: HEADERS,
        timeout: 30000
    });

    return response.data.response || [];
}

// ==========================================
// NORMALISATION
// ==========================================

function normaliserMatch(match) {

    return {
        id: match.fixture.id,

        date: new Date(match.fixture.date),

        homeId: match.teams.home.id,
        awayId: match.teams.away.id,

        homeName: match.teams.home.name,
        awayName: match.teams.away.name,

        homeGoals: match.goals.home,
        awayGoals: match.goals.away
    };
}

// ==========================================
// HISTORIQUE ÉQUIPE
// ==========================================

function historiqueEquipe(
    matchs,
    teamId
) {

    return matchs
        .filter(m =>
            m.homeId === teamId ||
            m.awayId === teamId
        )
        .sort(
            (a, b) =>
                b.date - a.date
        );
}

// ==========================================
// STATISTIQUES ÉQUIPE
// ==========================================

function statistiquesEquipe(
    matchs,
    teamId
) {

    const historiques =
        historiqueEquipe(
            matchs,
            teamId
        );

    if (historiques.length < 5) {
        return null;
    }

    const butsPour = [];
    const butsContre = [];

    for (const match of historiques) {

        const domicile =
            match.homeId === teamId;

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsPour.push(pour);
        butsContre.push(contre);
    }

    const derniers =
        historiques.slice(0, 5);

    const butsRecentsPour = [];
    const butsRecentsContre = [];

    let points = 0;

    for (const match of derniers) {

        const domicile =
            match.homeId === teamId;

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsRecentsPour.push(pour);
        butsRecentsContre.push(contre);

        if (pour > contre) {
            points += 3;
        }
        else if (pour === contre) {
            points += 1;
        }
    }

    return {

        attaque:
            moyenne(butsPour),

        defense:
            moyenne(butsContre),

        attaqueRecente:
            moyenne(butsRecentsPour),

        defenseRecente:
            moyenne(butsRecentsContre),

        formePoints:
            points /
            (derniers.length * 3)
    };
}

// ==========================================
// DOMICILE / EXTÉRIEUR
// ==========================================

function statistiquesLieu(
    matchs,
    teamId,
    domicile
) {

    const historiques =
        historiqueEquipe(
            matchs,
            teamId
        )
        .filter(m =>
            domicile
                ? m.homeId === teamId
                : m.awayId === teamId
        );

    if (historiques.length < 3) {
        return null;
    }

    const butsPour = [];
    const butsContre = [];

    for (const match of historiques) {

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsPour.push(pour);
        butsContre.push(contre);
    }

    return {

        attaque:
            moyenne(butsPour),

        defense:
            moyenne(butsContre)
    };
}

// ==========================================
// PRONOSTIC V25
// ==========================================

function calculerPronostic(
    matchs,
    homeId,
    awayId
) {

    const homeStats =
        statistiquesEquipe(
            matchs,
            homeId
        );

    const awayStats =
        statistiquesEquipe(
            matchs,
            awayId
        );

    const homeVenue =
        statistiquesLieu(
            matchs,
            homeId,
            true
        );

    const awayVenue =
        statistiquesLieu(
            matchs,
            awayId,
            false
        );

    if (
        !homeStats ||
        !awayStats ||
        !homeVenue ||
        !awayVenue
    ) {
        throw new Error(
            "Pas assez de données historiques."
        );
    }

    // Attaque / défense

    const attaqueHome =
        homeStats.attaque * 0.50 +
        homeStats.attaqueRecente * 0.20 +
        homeVenue.attaque * 0.30;

    const defenseHome =
        homeStats.defense * 0.50 +
        homeStats.defenseRecente * 0.20 +
        homeVenue.defense * 0.30;

    const attaqueAway =
        awayStats.attaque * 0.50 +
        awayStats.attaqueRecente * 0.20 +
        awayVenue.attaque * 0.30;

    const defenseAway =
        awayStats.defense * 0.50 +
        awayStats.defenseRecente * 0.20 +
        awayVenue.defense * 0.30;

    // Matchup

    let lambdaHome =
        Math.sqrt(
            attaqueHome *
            defenseAway
        );

    let lambdaAway =
        Math.sqrt(
            attaqueAway *
            defenseHome
        );

    // Avantage domicile

    lambdaHome *= 1.05;

    // Forme récente

    const differenceForme =
        homeStats.formePoints -
        awayStats.formePoints;

    const ajustementForme =
        clamp(
            differenceForme * 0.10,
            -0.10,
            0.10
        );

    lambdaHome *=
        1 + ajustementForme;

    lambdaAway *=
        1 - ajustementForme;

    lambdaHome =
        clamp(
            lambdaHome,
            0.15,
            4.5
        );

    lambdaAway =
        clamp(
            lambdaAway,
            0.15,
            4.5
        );

    // ======================================
    // GRILLE DES SCORES
    // ======================================

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    let meilleurScore = null;
    let meilleureProba = 0;

    let over25 = 0;
    let btts = 0;

    for (let home = 0; home <= 7; home++) {

        for (let away = 0; away <= 7; away++) {

            const probability =
                poisson(home, lambdaHome) *
                poisson(away, lambdaAway);

            if (home > away) {
                pHome += probability;
            }
            else if (home === away) {
                pDraw += probability;
            }
            else {
                pAway += probability;
            }

            if (home + away >= 3) {
                over25 += probability;
            }

            if (home >= 1 && away >= 1) {
                btts += probability;
            }

            if (
                probability >
                meilleureProba
            ) {
                meilleureProba =
                    probability;

                meilleurScore = {
                    home,
                    away
                };
            }
        }
    }

    const total =
        pHome +
        pDraw +
        pAway;

    pHome /= total;
    pDraw /= total;
    pAway /= total;

    const probabilites = [
        {
            resultat: "1",
            proba: pHome
        },
        {
            resultat: "N",
            proba: pDraw
        },
        {
            resultat: "2",
            proba: pAway
        }
    ];

    probabilites.sort(
        (a, b) =>
            b.proba - a.proba
    );

    const prediction =
        probabilites[0];

    return {

        prediction:
            prediction.resultat,

        probabilite:
            prediction.proba,

        home:
            pHome,

        draw:
            pDraw,

        away:
            pAway,

        lambdaHome,
        lambdaAway,

        scoreProbable:
            `${meilleurScore.home}-${meilleurScore.away}`,

        over25,

        btts
    };
}

// ==========================================
// AFFICHAGE
// ==========================================

function afficherPronostic(
    homeName,
    awayName,
    pronostic
) {

    console.log("");
    console.log("==========================================");
    console.log("⚽ PRONOSTIC BOT");
    console.log("==========================================");

    console.log("");
    console.log(
        `${homeName} 🆚 ${awayName}`
    );

    console.log("");

    console.log(
        `🏠 ${homeName} : ${(pronostic.home * 100).toFixed(1)}%`
    );

    console.log(
        `🤝 Nul : ${(pronostic.draw * 100).toFixed(1)}%`
    );

    console.log(
        `✈️ ${awayName} : ${(pronostic.away * 100).toFixed(1)}%`
    );

    console.log("");

    console.log(
        `🎯 Pronostic : ${pronostic.prediction}`
    );

    console.log(
        `🔥 Confiance : ${(pronostic.probabilite * 100).toFixed(1)}%`
    );

    console.log(
        `⚽ Score probable : ${pronostic.scoreProbable}`
    );

    console.log(
        `📈 Over 2.5 : ${(pronostic.over25 * 100).toFixed(1)}%`
    );

    console.log(
        `🔄 BTTS : ${(pronostic.btts * 100).toFixed(1)}%`
    );

    console.log("");

    console.log(
        `Buts attendus : ` +
        `${pronostic.lambdaHome.toFixed(2)} - ` +
        `${pronostic.lambdaAway.toFixed(2)}`
    );

    console.log("");

    console.log("==========================================");
}

// ==========================================
// PROGRAMME PRINCIPAL
// ==========================================

async function main() {

    try {

        const data =
            await chargerMatchs();

        const matchs =
            data
                .map(normaliserMatch)
                .filter(m =>
                    m.homeGoals !== null &&
                    m.awayGoals !== null
                );

        console.log(
            `✅ ${matchs.length} matchs disponibles`
        );

        const home =
            matchs.find(
                m =>
                    m.homeId === HOME_TEAM_ID
            );

        const away =
            matchs.find(
                m =>
                    m.awayId === AWAY_TEAM_ID
            );

        if (!home && !away) {
            throw new Error(
                "Les équipes demandées sont absentes des données."
            );
        }

        const homeName =
            home
                ? home.homeName
                : "Équipe domicile";

        const awayName =
            away
                ? away.awayName
                : "Équipe extérieure";

        const pronostic =
            calculerPronostic(
                matchs,
                HOME_TEAM_ID,
                AWAY_TEAM_ID
            );

        afficherPronostic(
            homeName,
            awayName,
            pronostic
        );

    }
    catch (error) {

        console.error("");
        console.error(
            "❌ ERREUR :",
            error.message
        );
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    calculerPronostic,
    normaliserMatch
};

require("dotenv").config();
const axios = require("axios");

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LIGUE = 39;
const SAISON = 2024;

const EQUIPES = [
    {
        id: 49,
        nom: "Chelsea"
    },
    {
        id: 42,
        nom: "Arsenal"
    }
];

const LIMITE_MATCHS = 20;

// ========================================
// API
// ========================================

async function obtenirMatchs(teamId) {
    const response = await axios.get(API_URL, {
        headers: {
            "x-apisports-key":
                process.env.API_FOOTBALL_KEY
        },
        params: {
            league: LIGUE,
            season: SAISON,
            team: teamId
        },
        timeout: 20000
    });

    return response.data.response.filter(match =>
        match.fixture.status.short === "FT" &&
        match.goals.home !== null &&
        match.goals.away !== null
    );
}

// ========================================
// OUTILS
// ========================================

function butsDuMatch(match, teamId) {
    const domicile =
        match.teams.home.id === teamId;

    return {
        pour: domicile
            ? match.goals.home
            : match.goals.away,

        contre: domicile
            ? match.goals.away
            : match.goals.home
    };
}

function statistiques(matchs, teamId) {

    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let marques = 0;
    let encaisses = 0;

    for (const match of matchs) {

        const buts =
            butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;

        if (buts.pour > buts.contre) {
            victoires++;
        }
        else if (buts.pour === buts.contre) {
            nuls++;
        }
        else {
            defaites++;
        }
    }

    const total = matchs.length;

    return {
        matchs: total,

        victoires,
        nuls,
        defaites,

        moyenneMarques:
            total ? marques / total : 0,

        moyenneEncaisses:
            total ? encaisses / total : 0
    };
}

// ========================================
// FORME RÉCENTE
// ========================================

function formeRecente(matchs, teamId) {

    const derniers =
        matchs.slice(-5);

    let points = 0;
    let marques = 0;
    let encaisses = 0;

    for (const match of derniers) {

        const buts =
            butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;

        if (buts.pour > buts.contre) {
            points += 3;
        }
        else if (buts.pour === buts.contre) {
            points += 1;
        }
    }

    const total = derniers.length;

    return {
        points,

        moyenneMarques:
            total ? marques / total : 0,

        moyenneEncaisses:
            total ? encaisses / total : 0
    };
}

// ========================================
// DOMICILE / EXTÉRIEUR
// ========================================

function statistiquesLieu(
    matchs,
    teamId,
    domicileRecherche
) {

    const rencontres =
        matchs.filter(match => {

            const domicile =
                match.teams.home.id === teamId;

            return domicile === domicileRecherche;
        });

    return statistiques(
        rencontres,
        teamId
    );
}

// ========================================
// MOTEUR V3
// ========================================

function pronostiquer(
    stats1,
    stats2,
    forme1,
    forme2,
    lieu1,
    lieu2
) {

    const attaque1 =
        stats1.moyenneMarques * 0.30 +
        forme1.moyenneMarques * 0.40 +
        lieu1.moyenneMarques * 0.30;

    const attaque2 =
        stats2.moyenneMarques * 0.30 +
        forme2.moyenneMarques * 0.40 +
        lieu2.moyenneMarques * 0.30;

    const defense1 =
        stats1.moyenneEncaisses * 0.30 +
        forme1.moyenneEncaisses * 0.40 +
        lieu1.moyenneEncaisses * 0.30;

    const defense2 =
        stats2.moyenneEncaisses * 0.30 +
        forme2.moyenneEncaisses * 0.40 +
        lieu2.moyenneEncaisses * 0.30;

    const force1 =
        attaque1 * 0.45 +
        (2 - defense1) * 0.25 +
        (forme1.points / 15) * 0.30;

    const force2 =
        attaque2 * 0.45 +
        (2 - defense2) * 0.25 +
        (forme2.points / 15) * 0.30;

    const f1 =
        Math.max(force1, 0.1);

    const f2 =
        Math.max(force2, 0.1);

    let nul =
        30 - Math.abs(f1 - f2) * 8;

    nul =
        Math.max(
            15,
            Math.min(30, nul)
        );

    const total =
        f1 + f2;

    const victoire1 =
        (f1 / total) * (100 - nul);

    const victoire2 =
        (f2 / total) * (100 - nul);

    const buts1 =
        Math.max(
            0,
            (attaque1 + defense2) / 2
        );

    const buts2 =
        Math.max(
            0,
            (attaque2 + defense1) / 2
        );

    return {
        victoire1,
        nul,
        victoire2,

        buts1,
        buts2,

        score1:
            Math.round(buts1),

        score2:
            Math.round(buts2)
    };
}

// ========================================
// RÉSULTAT RÉEL
// ========================================

function resultatReel(
    match,
    equipe1Id,
    equipe2Id
) {

    const domicile =
        match.teams.home.id === equipe1Id;

    let buts1;
    let buts2;

    if (domicile) {

        buts1 = match.goals.home;
        buts2 = match.goals.away;

    } else {

        buts1 = match.goals.away;
        buts2 = match.goals.home;
    }

    let resultat;

    if (buts1 > buts2) {
        resultat = "1";
    }
    else if (buts1 === buts2) {
        resultat = "N";
    }
    else {
        resultat = "2";
    }

    return {
        buts1,
        buts2,
        resultat
    };
}

// ========================================
// PRÉDICTION 1N2
// ========================================

function prediction1N2(prono) {

    if (
        prono.victoire1 >= prono.nul &&
        prono.victoire1 >= prono.victoire2
    ) {
        return "1";
    }

    if (
        prono.victoire2 >= prono.nul &&
        prono.victoire2 >= prono.victoire1
    ) {
        return "2";
    }

    return "N";
}

// ========================================
// BACKTEST
// ========================================

async function lancer() {

    console.log("");
    console.log("🤖 PRONOSTIC BOT V4");
    console.log("==============================");

    console.log("");
    console.log("📥 Récupération des matchs...");

    const [chelsea, arsenal] =
        await Promise.all([
            obtenirMatchs(49),
            obtenirMatchs(42)
        ]);

    // Tous les matchs où Chelsea
    // et Arsenal se rencontrent.

    const matchsCommuns =
        chelsea.filter(match => {

            const home =
                match.teams.home.id;

            const away =
                match.teams.away.id;

            return (
                (home === 49 && away === 42) ||
                (home === 42 && away === 49)
            );
        });

    if (matchsCommuns.length === 0) {

        console.log(
            "❌ Aucun Chelsea-Arsenal trouvé."
        );

        return;
    }

    console.log("");
    console.log(
        `🔎 ${matchsCommuns.length} confrontation(s) trouvée(s).`
    );

    let bonsPronostics = 0;
    let totalTests = 0;

    console.log("");
    console.log("📊 BACKTEST");
    console.log("==============================");

    for (
        const match of matchsCommuns
    ) {

        if (totalTests >= LIMITE_MATCHS) {
            break;
        }

        const dateMatch =
            new Date(match.fixture.date);

        // Données AVANT le match

        const matchs1 =
            chelsea
                .filter(m =>
                    new Date(m.fixture.date)
                        .getTime() <
                    dateMatch.getTime()
                )
                .sort((a, b) =>
                    new Date(a.fixture.date) -
                    new Date(b.fixture.date)
                );

        const matchs2 =
            arsenal
                .filter(m =>
                    new Date(m.fixture.date)
                        .getTime() <
                    dateMatch.getTime()
                )
                .sort((a, b) =>
                    new Date(a.fixture.date) -
                    new Date(b.fixture.date)
                );

        if (
            matchs1.length < 5 ||
            matchs2.length < 5
        ) {
            continue;
        }

        const stats1 =
            statistiques(
                matchs1,
                49
            );

        const stats2 =
            statistiques(
                matchs2,
                42
            );

        const forme1 =
            formeRecente(
                matchs1,
                49
            );

        const forme2 =
            formeRecente(
                matchs2,
                42
            );

        const lieu1 =
            statistiquesLieu(
                matchs1,
                49,
                match.teams.home.id === 49
            );

        const lieu2 =
            statistiquesLieu(
                matchs2,
                42,
                match.teams.home.id === 42
            );

        const prono =
            pronostiquer(
                stats1,
                stats2,
                forme1,
                forme2,
                lieu1,
                lieu2
            );

        const reel =
            resultatReel(
                match,
                49,
                42
            );

        const prediction =
            prediction1N2(prono);

        const correct =
            prediction === reel.resultat;

        if (correct) {
            bonsPronostics++;
        }

        totalTests++;

        const date =
            dateMatch
                .toISOString()
                .split("T")[0];

        console.log("");

        console.log(
            `${date} | ` +
            `Prono: ${prediction} | ` +
            `Réel: ${reel.resultat} | ` +
            `Score: ${reel.buts1}-${reel.buts2} | ` +
            `${correct ? "✅" : "❌"}`
        );
    }

    console.log("");
    console.log("📈 RÉSULTAT DU BACKTEST");
    console.log("==============================");

    console.log(
        "Matchs testés :",
        totalTests
    );

    console.log(
        "Pronostics corrects :",
        bonsPronostics
    );

    if (totalTests > 0) {

        const precision =
            (bonsPronostics /
                totalTests) *
            100;

        console.log(
            "Précision 1N2 :",
            precision.toFixed(2) + "%"
        );
    }

    console.log("");
    console.log(
        "⚠️ Ce backtest mesure uniquement"
    );

    console.log(
        "la performance historique du prototype."
    );

    console.log(
        "Il ne garantit pas les résultats futurs."
    );
}

lancer().catch(error => {

    console.log("");
    console.log("❌ ERREUR");

    if (error.response) {
        console.log(
            error.response.data
        );
    } else {
        console.log(
            error.message
        );
    }
});

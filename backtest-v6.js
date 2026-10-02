require("dotenv").config();

const axios = require("axios");

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LIGUE = 39;
const SAISON = 2024;
const LIMITE = 100;

const MAX_GOALS = 7;

// ========================================
// API
// ========================================

async function obtenirTousLesMatchs() {

    const response = await axios.get(API_URL, {
        headers: {
            "x-apisports-key":
                process.env.API_FOOTBALL_KEY
        },

        params: {
            league: LIGUE,
            season: SAISON,
            status: "FT"
        },

        timeout: 30000
    });

    return response.data.response.filter(match =>
        match.goals.home !== null &&
        match.goals.away !== null
    );
}

// ========================================
// BUTS
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

// ========================================
// STATISTIQUES
// ========================================

function statistiques(matchs, teamId) {

    let marques = 0;
    let encaisses = 0;

    for (const match of matchs) {

        const buts =
            butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;
    }

    const total = matchs.length;

    return {
        matchs: total,

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

    let marques = 0;
    let encaisses = 0;

    for (const match of derniers) {

        const buts =
            butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;
    }

    const total = derniers.length;

    return {
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
// FACTORIELLE
// ========================================

function factorielle(n) {

    let resultat = 1;

    for (let i = 2; i <= n; i++) {
        resultat *= i;
    }

    return resultat;
}

// ========================================
// POISSON
// ========================================

function poisson(k, lambda) {

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorielle(k)
    );
}

// ========================================
// MODÈLE V6
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

    let lambda1 =
        (attaque1 + defense2) / 2;

    let lambda2 =
        (attaque2 + defense1) / 2;

    lambda1 =
        Math.max(0.15, lambda1);

    lambda2 =
        Math.max(0.15, lambda2);

    let victoire1 = 0;
    let nul = 0;
    let victoire2 = 0;

    let over25 = 0;
    let btts = 0;

    let meilleurScore = "0-0";
    let meilleureProbabilite = 0;

    for (
        let buts1 = 0;
        buts1 <= MAX_GOALS;
        buts1++
    ) {

        const p1 =
            poisson(buts1, lambda1);

        for (
            let buts2 = 0;
            buts2 <= MAX_GOALS;
            buts2++
        ) {

            const p2 =
                poisson(buts2, lambda2);

            const probabilite =
                p1 * p2;

            if (buts1 > buts2) {
                victoire1 += probabilite;
            }
            else if (buts1 === buts2) {
                nul += probabilite;
            }
            else {
                victoire2 += probabilite;
            }

            if (buts1 + buts2 >= 3) {
                over25 += probabilite;
            }

            if (
                buts1 > 0 &&
                buts2 > 0
            ) {
                btts += probabilite;
            }

            if (
                probabilite >
                meilleureProbabilite
            ) {

                meilleureProbabilite =
                    probabilite;

                meilleurScore =
                    `${buts1}-${buts2}`;
            }
        }
    }

    return {
        victoire1,
        nul,
        victoire2,

        over25,
        btts,

        lambda1,
        lambda2,

        meilleurScore,
        meilleureProbabilite
    };
}

// ========================================
// PRÉDICTION
// ========================================

function choisirPrediction(prono) {

    if (
        prono.victoire1 >= prono.nul &&
        prono.victoire1 >= prono.victoire2
    ) {
        return "1";
    }

    if (
        prono.nul >= prono.victoire1 &&
        prono.nul >= prono.victoire2
    ) {
        return "N";
    }

    return "2";
}

// ========================================
// BACKTEST
// ========================================

async function lancer() {

    console.log("");
    console.log("🤖 PRONOSTIC BOT V6");
    console.log("==============================");

    console.log("");
    console.log(
        "📥 Récupération des matchs..."
    );

    const matchs =
        await obtenirTousLesMatchs();

    matchs.sort((a, b) =>
        new Date(a.fixture.date) -
        new Date(b.fixture.date)
    );

    console.log(
        `✅ ${matchs.length} matchs récupérés.`
    );

    let testes = 0;
    let corrects = 0;

    let correctDomicile = 0;
    let correctNuls = 0;
    let correctExterieur = 0;

    let erreursButs = 0;

    console.log("");
    console.log(
        "📊 BACKTEST V6"
    );
    console.log("==============================");

    for (const match of matchs) {

        if (testes >= LIMITE) {
            break;
        }

        const dateMatch =
            new Date(match.fixture.date);

        const equipe1 =
            match.teams.home.id;

        const equipe2 =
            match.teams.away.id;

        const matchs1 =
            matchs.filter(m =>
                new Date(m.fixture.date) <
                dateMatch &&
                (
                    m.teams.home.id === equipe1 ||
                    m.teams.away.id === equipe1
                )
            );

        const matchs2 =
            matchs.filter(m =>
                new Date(m.fixture.date) <
                dateMatch &&
                (
                    m.teams.home.id === equipe2 ||
                    m.teams.away.id === equipe2
                )
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
                equipe1
            );

        const stats2 =
            statistiques(
                matchs2,
                equipe2
            );

        const forme1 =
            formeRecente(
                matchs1,
                equipe1
            );

        const forme2 =
            formeRecente(
                matchs2,
                equipe2
            );

        const lieu1 =
            statistiquesLieu(
                matchs1,
                equipe1,
                true
            );

        const lieu2 =
            statistiquesLieu(
                matchs2,
                equipe2,
                false
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

        const prediction =
            choisirPrediction(prono);

        const buts1 =
            match.goals.home;

        const buts2 =
            match.goals.away;

        let reel;

        if (buts1 > buts2) {
            reel = "1";
        }
        else if (buts1 === buts2) {
            reel = "N";
        }
        else {
            reel = "2";
        }

        const correct =
            prediction === reel;

        if (correct) {

            corrects++;

            if (reel === "1") {
                correctDomicile++;
            }

            if (reel === "N") {
                correctNuls++;
            }

            if (reel === "2") {
                correctExterieur++;
            }
        }

        const butsEstimes =
            prono.lambda1 +
            prono.lambda2;

        const butsReels =
            buts1 + buts2;

        erreursButs +=
            Math.abs(
                butsEstimes - butsReels
            );

        testes++;

        const date =
            dateMatch
                .toISOString()
                .split("T")[0];

        console.log(
            `${date} | ` +
            `${match.teams.home.name} - ` +
            `${match.teams.away.name} | ` +
            `P:${prediction} | ` +
            `R:${reel} | ` +
            `${buts1}-${buts2} | ` +
            `${correct ? "✅" : "❌"}`
        );
    }

    console.log("");
    console.log("📈 RÉSULTATS V6");
    console.log("==============================");

    console.log(
        "Matchs analysés :",
        testes
    );

    console.log(
        "Pronostics corrects :",
        corrects
    );

    if (testes > 0) {

        const precision =
            corrects /
            testes *
            100;

        const erreurMoyenne =
            erreursButs /
            testes;

        console.log(
            "Précision 1N2 :",
            precision.toFixed(2) + "%"
        );

        console.log(
            "Erreur moyenne buts :",
            erreurMoyenne.toFixed(2)
        );
    }

    console.log("");
    console.log(
        "🎯 BONS PRONOSTICS"
    );

    console.log(
        "Domicile :",
        correctDomicile
    );

    console.log(
        "Nuls :",
        correctNuls
    );

    console.log(
        "Extérieur :",
        correctExterieur
    );

    console.log("");
    console.log(
        "⚠️ Test historique uniquement."
    );

    console.log(
        "Les probabilités ne sont pas encore calibrées."
    );
}

lancer().catch(error => {

    console.log("");
    console.log("❌ ERREUR");

    if (error.response) {
        console.log(
            error.response.data
        );
    }
    else {
        console.log(
            error.message
        );
    }
});

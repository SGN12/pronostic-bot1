require("dotenv").config();
const axios = require("axios");

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LIGUE = 39;
const SAISON = 2024;

// Nombre maximum de matchs à tester
const LIMITE = 100;

// ========================================
// RÉCUPÉRER TOUS LES MATCHS DE LA LIGUE
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
// BUTS D'UNE ÉQUIPE
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
// FORME DES 5 DERNIERS MATCHS
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
        buts2
    };
}

// ========================================
// RÉSULTAT RÉEL
// ========================================

function resultatReel(match) {

    const buts1 =
        match.goals.home;

    const buts2 =
        match.goals.away;

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
// MEILLEURE PROBABILITÉ
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
    console.log("🤖 PRONOSTIC BOT V5");
    console.log("==============================");

    console.log("");
    console.log(
        "📥 Récupération de la Premier League 2024..."
    );

    const matchs =
        await obtenirTousLesMatchs();

    console.log(
        `✅ ${matchs.length} matchs récupérés.`
    );

    // Trier chronologiquement
    matchs.sort((a, b) =>
        new Date(a.fixture.date) -
        new Date(b.fixture.date)
    );

    let testes = 0;
    let corrects = 0;

    let domicileCorrect = 0;
    let nulCorrect = 0;
    let exterieurCorrect = 0;

    let totalErreurButs = 0;

    console.log("");
    console.log("📊 BACKTEST EN COURS...");
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

        // --------------------------------
        // DONNÉES DISPONIBLES AVANT MATCH
        // --------------------------------

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

        // Il faut au minimum 5 matchs
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
            prediction1N2(prono);

        const reel =
            resultatReel(match);

        const correct =
            prediction === reel.resultat;

        if (correct) {
            corrects++;
        }

        // Statistiques par type de résultat
        if (reel.resultat === "1" && correct) {
            domicileCorrect++;
        }

        if (reel.resultat === "N" && correct) {
            nulCorrect++;
        }

        if (reel.resultat === "2" && correct) {
            exterieurCorrect++;
        }

        // Erreur absolue sur les buts
        const butsEstimes =
            prono.buts1 + prono.buts2;

        const butsReels =
            reel.buts1 + reel.buts2;

        totalErreurButs +=
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
            `R:${reel.resultat} | ` +
            `${correct ? "✅" : "❌"}`
        );
    }

    // ========================================
    // RÉSULTATS
    // ========================================

    console.log("");
    console.log("📈 RÉSULTATS V5");
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
            (corrects / testes) * 100;

        const erreurMoyenne =
            totalErreurButs / testes;

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
    console.log("🎯 BONS PRONOSTICS PAR RÉSULTAT");

    console.log(
        "Victoire domicile correcte :",
        domicileCorrect
    );

    console.log(
        "Match nul correct :",
        nulCorrect
    );

    console.log(
        "Victoire extérieur correcte :",
        exterieurCorrect
    );

    console.log("");
    console.log(
        "⚠️ Les probabilités du moteur ne sont pas encore calibrées."
    );

    console.log(
        "Ce test mesure uniquement la performance historique du prototype."
    );
}

lancer().catch(error => {

    console.log("");
    console.log("❌ ERREUR");

    if (error.response) {
        console.log(error.response.data);
    } else {
        console.log(error.message);
    }
});

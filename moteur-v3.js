require("dotenv").config();
const axios = require("axios");

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LIGUE = 39;
const SAISON = 2024;

// Match historique à analyser
const EQUIPE1 = {
    id: 49,
    nom: "Chelsea"
};

const EQUIPE2 = {
    id: 42,
    nom: "Arsenal"
};

// Date du match à prédire
const DATE_MATCH = "2024-11-10T16:30:00Z";


// ==============================
// RÉCUPÉRER LES MATCHS
// ==============================

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


// ==============================
// FILTRER LES MATCHS ANTÉRIEURS
// ==============================

function matchsAvantDate(matchs, date) {
    const limite = new Date(date).getTime();

    return matchs
        .filter(match =>
            new Date(match.fixture.date).getTime()
                < limite
        )
        .sort((a, b) =>
            new Date(a.fixture.date) -
            new Date(b.fixture.date)
        );
}


// ==============================
// EXTRAIRE LES BUTS D'UNE ÉQUIPE
// ==============================

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


// ==============================
// STATISTIQUES GÉNÉRALES
// ==============================

function statistiques(matchs, teamId) {
    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let marques = 0;
    let encaisses = 0;

    for (const match of matchs) {
        const buts = butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;

        if (buts.pour > buts.contre) {
            victoires++;
        } else if (buts.pour === buts.contre) {
            nuls++;
        } else {
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


// ==============================
// FORME DES 5 DERNIERS MATCHS
// ==============================

function formeRecente(matchs, teamId) {
    const derniers = matchs.slice(-5);

    let points = 0;
    let marques = 0;
    let encaisses = 0;
    const forme = [];

    for (const match of derniers) {
        const buts = butsDuMatch(match, teamId);

        marques += buts.pour;
        encaisses += buts.contre;

        if (buts.pour > buts.contre) {
            points += 3;
            forme.push("🟢");
        } else if (buts.pour === buts.contre) {
            points += 1;
            forme.push("🟡");
        } else {
            forme.push("🔴");
        }
    }

    const total = derniers.length;

    return {
        points,
        forme,

        matchs: total,

        moyenneMarques:
            total ? marques / total : 0,

        moyenneEncaisses:
            total ? encaisses / total : 0
    };
}


// ==============================
// STATISTIQUES DOMICILE / EXTÉRIEUR
// ==============================

function statistiquesLieu(
    matchs,
    teamId,
    domicileRecherche
) {
    const rencontres = matchs.filter(match => {
        const domicile =
            match.teams.home.id === teamId;

        return domicile === domicileRecherche;
    });

    return statistiques(rencontres, teamId);
}


// ==============================
// MOTEUR DE PRÉDICTION
// ==============================

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

    const f1 = Math.max(force1, 0.1);
    const f2 = Math.max(force2, 0.1);

    let nul = 30 - Math.abs(f1 - f2) * 8;
    nul = Math.max(15, Math.min(30, nul));

    const total = f1 + f2;

    const victoire1 =
        (f1 / total) * (100 - nul);

    const victoire2 =
        (f2 / total) * (100 - nul);

    const buts1 =
        Math.max(0, (attaque1 + defense2) / 2);

    const buts2 =
        Math.max(0, (attaque2 + defense1) / 2);

    const butsAttendus = buts1 + buts2;

    return {
        victoire1: Math.round(victoire1),
        nul: Math.round(nul),
        victoire2: Math.round(victoire2),

        buts1: buts1.toFixed(2),
        buts2: buts2.toFixed(2),

        butsAttendus: butsAttendus.toFixed(2),

        score:
            `${Math.round(buts1)}-${Math.round(buts2)}`
    };
}


// ==============================
// LANCEMENT
// ==============================

async function lancer() {
    try {
        console.log("");
        console.log("🤖 PRONOSTIC BOT V3");
        console.log("==============================");

        console.log(
            "Match :",
            EQUIPE1.nom,
            "vs",
            EQUIPE2.nom
        );

        console.log(
            "Date :",
            DATE_MATCH
        );

        console.log("");
        console.log("⏳ Récupération des données...");

        const [bruts1, bruts2] = await Promise.all([
            obtenirMatchs(EQUIPE1.id),
            obtenirMatchs(EQUIPE2.id)
        ]);

        // IMPORTANT :
        // on exclut les matchs à la date choisie
        // et tous les matchs postérieurs.

        const matchs1 = matchsAvantDate(
            bruts1,
            DATE_MATCH
        );

        const matchs2 = matchsAvantDate(
            bruts2,
            DATE_MATCH
        );

        if (matchs1.length < 5 || matchs2.length < 5) {
            throw new Error(
                "Pas assez de matchs antérieurs à cette date."
            );
        }

        const stats1 = statistiques(
            matchs1,
            EQUIPE1.id
        );

        const stats2 = statistiques(
            matchs2,
            EQUIPE2.id
        );

        const forme1 = formeRecente(
            matchs1,
            EQUIPE1.id
        );

        const forme2 = formeRecente(
            matchs2,
            EQUIPE2.id
        );

        const lieu1 = statistiquesLieu(
            matchs1,
            EQUIPE1.id,
            true
        );

        const lieu2 = statistiquesLieu(
            matchs2,
            EQUIPE2.id,
            false
        );

        const resultat = pronostiquer(
            stats1,
            stats2,
            forme1,
            forme2,
            lieu1,
            lieu2
        );

        console.log("");
        console.log("📊 DONNÉES AVANT LE MATCH");
        console.log("==============================");

        console.log(
            `${EQUIPE1.nom} : ${stats1.matchs} matchs`
        );

        console.log(
            `${EQUIPE2.nom} : ${stats2.matchs} matchs`
        );

        console.log("");
        console.log("🔥 FORME RÉCENTE");

        console.log(
            EQUIPE1.nom,
            forme1.forme.join(""),
            `(${forme1.points}/15)`
        );

        console.log(
            EQUIPE2.nom,
            forme2.forme.join(""),
            `(${forme2.points}/15)`
        );

        console.log("");
        console.log("🎯 ESTIMATION HISTORIQUE");
        console.log("==============================");

        console.log(
            `${EQUIPE1.nom} : ${resultat.victoire1}%`
        );

        console.log(
            `Nul : ${resultat.nul}%`
        );

        console.log(
            `${EQUIPE2.nom} : ${resultat.victoire2}%`
        );

        console.log(
            "Buts attendus :",
            resultat.butsAttendus
        );

        console.log(
            "Score estimé :",
            resultat.score
        );

        console.log("");
        console.log(
            "⚠️ Prototype statistique : estimation non calibrée."
        );

        console.log(
            "Aucun match postérieur à la date cible n'a été utilisé."
        );

    } catch (error) {
        console.log("");
        console.log("❌ ERREUR");

        if (error.response) {
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

lancer();

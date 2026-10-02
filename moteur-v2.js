require("dotenv").config();
const axios = require("axios");

const API_URL = "https://v3.football.api-sports.io/fixtures";
const SAISON = 2024;
const LIGUE = 39;

async function obtenirMatchs(teamId) {
    const response = await axios.get(API_URL, {
        headers: {
            "x-apisports-key": process.env.API_FOOTBALL_KEY
        },
        params: {
            league: LIGUE,
            season: SAISON,
            team: teamId
        }
    });

    return response.data.response.filter(
        match => match.fixture.status.short === "FT"
    );
}

function statsGenerales(matchs, teamId) {
    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    matchs.forEach(match => {
        const domicile = match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        if (pour == null || contre == null) return;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            victoires++;
        } else if (pour === contre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const total = victoires + nuls + defaites;

    return {
        matchs: total,
        victoires,
        nuls,
        defaites,
        moyenneMarques: total ? butsMarques / total : 0,
        moyenneEncaisses: total ? butsEncaisses / total : 0
    };
}

function formeRecente(matchs, teamId) {
    const derniers = [...matchs]
        .sort(
            (a, b) =>
                new Date(b.fixture.date) -
                new Date(a.fixture.date)
        )
        .slice(0, 5);

    let points = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;
    const forme = [];

    derniers.forEach(match => {
        const domicile = match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            points += 3;
            forme.push("🟢");
        } else if (pour === contre) {
            points += 1;
            forme.push("🟡");
        } else {
            forme.push("🔴");
        }
    });

    return {
        points,
        forme,
        moyenneMarques: derniers.length
            ? butsMarques / derniers.length
            : 0,
        moyenneEncaisses: derniers.length
            ? butsEncaisses / derniers.length
            : 0
    };
}

function statsLieu(matchs, teamId, domicileRecherche) {
    const rencontres = matchs.filter(match => {
        const domicile = match.teams.home.id === teamId;
        return domicile === domicileRecherche;
    });

    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    rencontres.forEach(match => {
        const domicile = match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            victoires++;
        } else if (pour === contre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const total = rencontres.length;

    return {
        matchs: total,
        victoires,
        nuls,
        defaites,
        moyenneMarques: total
            ? butsMarques / total
            : 0,
        moyenneEncaisses: total
            ? butsEncaisses / total
            : 0
    };
}

function pronostiquer(
    saison1,
    saison2,
    forme1,
    forme2,
    lieu1,
    lieu2
) {
    const attaque1 =
        saison1.moyenneMarques * 0.30 +
        forme1.moyenneMarques * 0.40 +
        lieu1.moyenneMarques * 0.30;

    const attaque2 =
        saison2.moyenneMarques * 0.30 +
        forme2.moyenneMarques * 0.40 +
        lieu2.moyenneMarques * 0.30;

    const defense1 =
        saison1.moyenneEncaisses * 0.30 +
        forme1.moyenneEncaisses * 0.40 +
        lieu1.moyenneEncaisses * 0.30;

    const defense2 =
        saison2.moyenneEncaisses * 0.30 +
        forme2.moyenneEncaisses * 0.40 +
        lieu2.moyenneEncaisses * 0.30;

    const scoreForme1 = forme1.points / 15;
    const scoreForme2 = forme2.points / 15;

    const force1 =
        attaque1 * 0.45 +
        (2 - defense1) * 0.25 +
        scoreForme1 * 0.30;

    const force2 =
        attaque2 * 0.45 +
        (2 - defense2) * 0.25 +
        scoreForme2 * 0.30;

    const f1 = Math.max(force1, 0.1);
    const f2 = Math.max(force2, 0.1);

    const total = f1 + f2;

    let victoire1 = (f1 / total) * 100;
    let victoire2 = (f2 / total) * 100;

    let nul = 30 - Math.abs(f1 - f2) * 8;

    nul = Math.max(15, Math.min(30, nul));

    const facteur = (100 - nul) / (victoire1 + victoire2);

    victoire1 *= facteur;
    victoire2 *= facteur;

    const buts1 = (attaque1 + defense2) / 2;
    const buts2 = (attaque2 + defense1) / 2;
    const butsAttendus = buts1 + buts2;

    let over25 = 40;

    if (butsAttendus >= 3) {
        over25 = 70;
    } else if (butsAttendus >= 2.5) {
        over25 = 60;
    } else if (butsAttendus >= 2) {
        over25 = 50;
    }

    let btts = 40;

    if (buts1 >= 1.2 && buts2 >= 1.2) {
        btts = 65;
    } else if (buts1 >= 1 && buts2 >= 1) {
        btts = 55;
    }

    return {
        victoire1: Math.round(victoire1),
        nul: Math.round(nul),
        victoire2: Math.round(victoire2),
        over25,
        btts,
        buts1: buts1.toFixed(2),
        buts2: buts2.toFixed(2),
        butsAttendus: butsAttendus.toFixed(2),
        score: `${Math.round(buts1)}-${Math.round(buts2)}`
    };
}

async function lancer() {
    try {
        console.log("");
        console.log("🤖 PRONOSTIC BOT V2");
        console.log("==============================");

        const matchsChelsea = await obtenirMatchs(49);
        const matchsArsenal = await obtenirMatchs(42);

        const saisonChelsea =
            statsGenerales(matchsChelsea, 49);

        const saisonArsenal =
            statsGenerales(matchsArsenal, 42);

        const formeChelsea =
            formeRecente(matchsChelsea, 49);

        const formeArsenal =
            formeRecente(matchsArsenal, 42);

        const domicileChelsea =
            statsLieu(matchsChelsea, 49, true);

        const exterieurArsenal =
            statsLieu(matchsArsenal, 42, false);

        const resultat = pronostiquer(
            saisonChelsea,
            saisonArsenal,
            formeChelsea,
            formeArsenal,
            domicileChelsea,
            exterieurArsenal
        );

        console.log("");
        console.log("🔵 CHELSEA");
        console.log("Forme :", formeChelsea.forme.join(""));
        console.log("Points :", formeChelsea.points + "/15");
        console.log(
            "Buts récents :",
            formeChelsea.moyenneMarques.toFixed(2)
        );
        console.log(
            "Buts domicile :",
            domicileChelsea.moyenneMarques.toFixed(2)
        );

        console.log("");
        console.log("🔴 ARSENAL");
        console.log("Forme :", formeArsenal.forme.join(""));
        console.log("Points :", formeArsenal.points + "/15");
        console.log(
            "Buts récents :",
            formeArsenal.moyenneMarques.toFixed(2)
        );
        console.log(
            "Buts extérieur :",
            exterieurArsenal.moyenneMarques.toFixed(2)
        );

        console.log("");
        console.log("🎯 ESTIMATION");
        console.log("==============================");

        console.log(
            "Chelsea :",
            resultat.victoire1 + "%"
        );

        console.log(
            "Nul :",
            resultat.nul + "%"
        );

        console.log(
            "Arsenal :",
            resultat.victoire2 + "%"
        );

        console.log(
            "Over 2.5 :",
            resultat.over25 + "%"
        );

        console.log(
            "BTTS :",
            resultat.btts + "%"
        );

        console.log(
            "Buts Chelsea :",
            resultat.buts1
        );

        console.log(
            "Buts Arsenal :",
            resultat.buts2
        );

        console.log(
            "Buts attendus :",
            resultat.butsAttendus
        );

        console.log(
            "Score statistique :",
            resultat.score
        );

        console.log("");
        console.log(
            "⚠️ Estimation statistique, pas une garantie."
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

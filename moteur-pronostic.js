require("dotenv").config();
const axios = require("axios");

const API_URL = "https://v3.football.api-sports.io/fixtures";

async function obtenirMatchs(teamId, saison = 2024) {
    const response = await axios.get(API_URL, {
        headers: {
            "x-apisports-key": process.env.API_FOOTBALL_KEY
        },
        params: {
            league: 39,
            season: saison,
            team: teamId
        }
    });

    return response.data.response;
}

function calculerStats(matchs, teamId) {
    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    matchs.forEach(match => {
        const domicile = match.teams.home.id === teamId;

        const butsPour = domicile
            ? match.goals.home
            : match.goals.away;

        const butsContre = domicile
            ? match.goals.away
            : match.goals.home;

        if (butsPour == null || butsContre == null) {
            return;
        }

        butsMarques += butsPour;
        butsEncaisses += butsContre;

        if (butsPour > butsContre) {
            victoires++;
        } else if (butsPour === butsContre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const matchsJoues = victoires + nuls + defaites;

    return {
        matchs: matchsJoues,
        victoires,
        nuls,
        defaites,
        butsMarques,
        butsEncaisses,
        moyenneMarques: matchsJoues
            ? butsMarques / matchsJoues
            : 0,
        moyenneEncaisses: matchsJoues
            ? butsEncaisses / matchsJoues
            : 0
    };
}

function calculerPronostic(stats1, stats2) {

    const attaque1 = stats1.moyenneMarques;
    const attaque2 = stats2.moyenneMarques;

    const defense1 = stats1.moyenneEncaisses;
    const defense2 = stats2.moyenneEncaisses;

    const forme1 = stats1.matchs
        ? stats1.victoires / stats1.matchs
        : 0;

    const forme2 = stats2.matchs
        ? stats2.victoires / stats2.matchs
        : 0;

    const force1 =
        attaque1 * 0.60 -
        defense1 * 0.25 +
        forme1 * 0.15;

    const force2 =
        attaque2 * 0.60 -
        defense2 * 0.25 +
        forme2 * 0.15;

    const force1Positive = Math.max(force1, 0);
    const force2Positive = Math.max(force2, 0);

    const total = force1Positive + force2Positive;

    let victoire1;
    let victoire2;
    let nul;

    if (total === 0) {
        victoire1 = 35;
        victoire2 = 35;
        nul = 30;
    } else {
        victoire1 = (force1Positive / total) * 70;
        victoire2 = (force2Positive / total) * 70;
        nul = 100 - victoire1 - victoire2;
    }

    const butsAttendus =
        (attaque1 + attaque2 + defense1 + defense2) / 2;

    let plus25;

    if (butsAttendus >= 2.8) {
        plus25 = 70;
    } else if (butsAttendus >= 2.3) {
        plus25 = 55;
    } else {
        plus25 = 40;
    }

    let btts;

    if (attaque1 >= 1.2 && attaque2 >= 1.2) {
        btts = 65;
    } else {
        btts = 40;
    }

    const score1 = Math.max(
        0,
        Math.round((attaque1 + defense2) / 2)
    );

    const score2 = Math.max(
        0,
        Math.round((attaque2 + defense1) / 2)
    );

    return {
        victoire1: Math.round(victoire1),
        nul: Math.round(nul),
        victoire2: Math.round(victoire2),
        plus25,
        btts,
        scoreProbable: `${score1}-${score2}`,
        butsAttendus: butsAttendus.toFixed(2)
    };
}

async function lancer() {

    try {

        console.log("");
        console.log("🤖 MOTEUR DE PRONOSTIC");
        console.log("==============================");

        const matchsChelsea =
            await obtenirMatchs(49, 2024);

        const matchsArsenal =
            await obtenirMatchs(42, 2024);

        const statsChelsea =
            calculerStats(matchsChelsea, 49);

        const statsArsenal =
            calculerStats(matchsArsenal, 42);

        const pronostic =
            calculerPronostic(
                statsChelsea,
                statsArsenal
            );

        console.log("");
        console.log("🔵 CHELSEA");
        console.log("------------------------------");
        console.log("Matchs :", statsChelsea.matchs);
        console.log(
            "Victoires :",
            statsChelsea.victoires
        );
        console.log(
            "Nuls :",
            statsChelsea.nuls
        );
        console.log(
            "Défaites :",
            statsChelsea.defaites
        );
        console.log(
            "Buts marqués :",
            statsChelsea.butsMarques
        );
        console.log(
            "Buts encaissés :",
            statsChelsea.butsEncaisses
        );
        console.log(
            "Moyenne buts :",
            statsChelsea.moyenneMarques.toFixed(2)
        );

        console.log("");
        console.log("🔴 ARSENAL");
        console.log("------------------------------");
        console.log("Matchs :", statsArsenal.matchs);
        console.log(
            "Victoires :",
            statsArsenal.victoires
        );
        console.log(
            "Nuls :",
            statsArsenal.nuls
        );
        console.log(
            "Défaites :",
            statsArsenal.defaites
        );
        console.log(
            "Buts marqués :",
            statsArsenal.butsMarques
        );
        console.log(
            "Buts encaissés :",
            statsArsenal.butsEncaisses
        );
        console.log(
            "Moyenne buts :",
            statsArsenal.moyenneMarques.toFixed(2)
        );

        console.log("");
        console.log("📊 PRONOSTIC");
        console.log("==============================");

        console.log(
            "Chelsea :",
            pronostic.victoire1 + "%"
        );

        console.log(
            "Nul :",
            pronostic.nul + "%"
        );

        console.log(
            "Arsenal :",
            pronostic.victoire2 + "%"
        );

        console.log(
            "Over 2.5 :",
            pronostic.plus25 + "%"
        );

        console.log(
            "BTTS :",
            pronostic.btts + "%"
        );

        console.log(
            "Score probable :",
            pronostic.scoreProbable
        );

        console.log(
            "Buts attendus :",
            pronostic.butsAttendus
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

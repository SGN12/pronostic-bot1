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

    return response.data.response.filter(
        match => match.fixture.status.short === "FT"
    );
}

function analyserLieu(matchs, teamId, domicileRecherche) {

    const filtres = matchs.filter(match => {

        const estDomicile =
            match.teams.home.id === teamId;

        return estDomicile === domicileRecherche;

    });

    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    filtres.forEach(match => {

        const estDomicile =
            match.teams.home.id === teamId;

        const pour = estDomicile
            ? match.goals.home
            : match.goals.away;

        const contre = estDomicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += pour ?? 0;
        butsEncaisses += contre ?? 0;

        if (pour > contre) {
            victoires++;
        } else if (pour === contre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const total = filtres.length;

    return {
        matchs: total,
        victoires,
        nuls,
        defaites,
        butsMarques,
        butsEncaisses,
        moyenneMarques:
            total ? butsMarques / total : 0,
        moyenneEncaisses:
            total ? butsEncaisses / total : 0
    };
}

async function lancer() {

    try {

        const chelsea =
            await obtenirMatchs(49);

        const arsenal =
            await obtenirMatchs(42);

        const chelseaDomicile =
            analyserLieu(chelsea, 49, true);

        const arsenalExterieur =
            analyserLieu(arsenal, 42, false);

        console.log("");
        console.log("🏠 DOMICILE / ✈️ EXTÉRIEUR");
        console.log("==============================");

        console.log("");
        console.log("🔵 CHELSEA À DOMICILE");

        console.log(
            "Matchs :",
            chelseaDomicile.matchs
        );

        console.log(
            "Victoires :",
            chelseaDomicile.victoires
        );

        console.log(
            "Nuls :",
            chelseaDomicile.nuls
        );

        console.log(
            "Défaites :",
            chelseaDomicile.defaites
        );

        console.log(
            "Buts marqués :",
            chelseaDomicile.butsMarques
        );

        console.log(
            "Buts encaissés :",
            chelseaDomicile.butsEncaisses
        );

        console.log(
            "Moyenne buts :",
            chelseaDomicile.moyenneMarques.toFixed(2)
        );

        console.log("");
        console.log("🔴 ARSENAL À L'EXTÉRIEUR");

        console.log(
            "Matchs :",
            arsenalExterieur.matchs
        );

        console.log(
            "Victoires :",
            arsenalExterieur.victoires
        );

        console.log(
            "Nuls :",
            arsenalExterieur.nuls
        );

        console.log(
            "Défaites :",
            arsenalExterieur.defaites
        );

        console.log(
            "Buts marqués :",
            arsenalExterieur.butsMarques
        );

        console.log(
            "Buts encaissés :",
            arsenalExterieur.butsEncaisses
        );

        console.log(
            "Moyenne buts :",
            arsenalExterieur.moyenneMarques.toFixed(2)
        );

    } catch (error) {

        console.log("❌ ERREUR");

        if (error.response) {
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

lancer();

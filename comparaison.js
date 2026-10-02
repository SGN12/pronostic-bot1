require("dotenv").config();
const axios = require("axios");

async function obtenirStats(teamId, nom) {

    const response = await axios.get(
        "https://v3.football.api-sports.io/fixtures",
        {
            headers: {
                "x-apisports-key": process.env.API_FOOTBALL_KEY
            },
            params: {
                league: 39,
                season: 2024,
                team: teamId
            }
        }
    );

    const matchs = response.data.response;

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

    return {
        nom,
        matchs: matchs.length,
        victoires,
        nuls,
        defaites,
        butsMarques,
        butsEncaisses,
        moyenneMarques: butsMarques / matchs.length,
        moyenneEncaisses: butsEncaisses / matchs.length
    };
}

async function comparer() {

    try {

        const equipe1 = await obtenirStats(49, "Chelsea");

        // Arsenal = ID 42
        const equipe2 = await obtenirStats(42, "Arsenal");

        console.log("");
        console.log("⚽ COMPARAISON");
        console.log("============================");

        console.log("");
        console.log("🔵", equipe1.nom);
        console.log("Victoires :", equipe1.victoires);
        console.log("Nuls :", equipe1.nuls);
        console.log("Défaites :", equipe1.defaites);
        console.log("Buts marqués :", equipe1.butsMarques);
        console.log("Buts encaissés :", equipe1.butsEncaisses);
        console.log("Moyenne buts :", equipe1.moyenneMarques.toFixed(2));

        console.log("");
        console.log("🔴", equipe2.nom);
        console.log("Victoires :", equipe2.victoires);
        console.log("Nuls :", equipe2.nuls);
        console.log("Défaites :", equipe2.defaites);
        console.log("Buts marqués :", equipe2.butsMarques);
        console.log("Buts encaissés :", equipe2.butsEncaisses);
        console.log("Moyenne buts :", equipe2.moyenneMarques.toFixed(2));

    } catch (error) {

        console.log("❌ ERREUR");

        if (error.response) {
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

comparer();

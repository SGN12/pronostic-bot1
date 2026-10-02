require("dotenv").config();
const axios = require("axios");

const API_URL = "https://v3.football.api-sports.io/fixtures";

async function obtenirDerniersMatchs(teamId, saison = 2024) {

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

    const matchs = response.data.response;

    const termines = matchs
        .filter(match =>
            match.fixture.status.short === "FT"
        )
        .sort(
            (a, b) =>
                new Date(b.fixture.date) -
                new Date(a.fixture.date)
        );

    return termines.slice(0, 5);
}

function analyserForme(matchs, teamId) {

    let points = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    const forme = [];

    matchs.forEach(match => {

        const domicile =
            match.teams.home.id === teamId;

        const butsPour = domicile
            ? match.goals.home
            : match.goals.away;

        const butsContre = domicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += butsPour;
        butsEncaisses += butsContre;

        if (butsPour > butsContre) {
            forme.push("🟢");
            points += 3;
        } else if (butsPour === butsContre) {
            forme.push("🟡");
            points += 1;
        } else {
            forme.push("🔴");
        }
    });

    return {
        forme,
        points,
        butsMarques,
        butsEncaisses,
        moyenneMarques:
            butsMarques / matchs.length,
        moyenneEncaisses:
            butsEncaisses / matchs.length
    };
}

async function tester() {

    try {

        const chelsea =
            await obtenirDerniersMatchs(49);

        const arsenal =
            await obtenirDerniersMatchs(42);

        const formeChelsea =
            analyserForme(chelsea, 49);

        const formeArsenal =
            analyserForme(arsenal, 42);

        console.log("");
        console.log("📊 FORME RÉCENTE");
        console.log("==============================");

        console.log("");
        console.log("🔵 CHELSEA");
        console.log(
            "Forme :",
            formeChelsea.forme.join("")
        );
        console.log(
            "Points :",
            formeChelsea.points,
            "/ 15"
        );
        console.log(
            "Buts marqués :",
            formeChelsea.butsMarques
        );
        console.log(
            "Buts encaissés :",
            formeChelsea.butsEncaisses
        );

        console.log("");
        console.log("🔴 ARSENAL");
        console.log(
            "Forme :",
            formeArsenal.forme.join("")
        );
        console.log(
            "Points :",
            formeArsenal.points,
            "/ 15"
        );
        console.log(
            "Buts marqués :",
            formeArsenal.butsMarques
        );
        console.log(
            "Buts encaissés :",
            formeArsenal.butsEncaisses
        );

        console.log("");

    } catch (error) {

        console.log("❌ ERREUR");

        if (error.response) {
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

tester();

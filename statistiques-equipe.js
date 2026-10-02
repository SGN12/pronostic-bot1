require("dotenv").config();
const axios = require("axios");

async function statistiquesEquipe(teamId, nomEquipe) {

    try {

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

            const butsPour = domicile
                ? match.goals.home
                : match.goals.away;

            const butsContre = domicile
                ? match.goals.away
                : match.goals.home;

            butsMarques += butsPour ?? 0;
            butsEncaisses += butsContre ?? 0;

            if (butsPour > butsContre) {
                victoires++;
            } else if (butsPour === butsContre) {
                nuls++;
            } else {
                defaites++;
            }
        });

        console.log("");
        console.log("📊 STATISTIQUES DE", nomEquipe);
        console.log("--------------------------------");
        console.log("Matchs :", matchs.length);
        console.log("🟢 Victoires :", victoires);
        console.log("🟡 Nuls :", nuls);
        console.log("🔴 Défaites :", defaites);
        console.log("⚽ Buts marqués :", butsMarques);
        console.log("🥅 Buts encaissés :", butsEncaisses);
        console.log(
            "📈 Moyenne buts marqués :",
            (butsMarques / matchs.length).toFixed(2)
        );
        console.log(
            "📉 Moyenne buts encaissés :",
            (butsEncaisses / matchs.length).toFixed(2)
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

statistiquesEquipe(49, "Chelsea");

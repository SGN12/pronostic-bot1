require("dotenv").config();
const axios = require("axios");

async function derniersMatchs() {
    try {
        const response = await axios.get(
            "https://v3.football.api-sports.io/fixtures",
            {
                headers: {
                    "x-apisports-key": process.env.API_FOOTBALL_KEY
                },
                params: {
                    team: 49,
                    last: 5
                }
            }
        );

        console.log("✅ DERNIERS MATCHS DE CHELSEA");
        console.log("Nombre :", response.data.results);
        console.log("");

        response.data.response.forEach(match => {

            const date = match.fixture.date.slice(0, 10);

            const domicile = match.teams.home.name;
            const exterieur = match.teams.away.name;

            const butsDomicile = match.goals.home;
            const butsExterieur = match.goals.away;

            console.log(
                `${date} | ${domicile} ${butsDomicile} - ${butsExterieur} ${exterieur}`
            );
        });

    } catch (error) {
        console.log("❌ ERREUR");

        if (error.response) {
            console.log("Statut :", error.response.status);
            console.log("Détails :", error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

derniersMatchs();

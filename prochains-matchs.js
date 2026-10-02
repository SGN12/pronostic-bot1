require("dotenv").config();
const axios = require("axios");

async function prochainsMatchs() {
    try {
        const response = await axios.get(
            "https://v3.football.api-sports.io/fixtures",
            {
                headers: {
                    "x-apisports-key": process.env.API_FOOTBALL_KEY
                },
                params: {
                    team: 49,
                    next: 5
                }
            }
        );

        console.log("✅ PROCHAINS MATCHS DE CHELSEA");
        console.log("Nombre :", response.data.results);
        console.log("");

        response.data.response.forEach(match => {
            const date = match.fixture.date;

            console.log(
                `${date} | ${match.teams.home.name} 🆚 ${match.teams.away.name}`
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

prochainsMatchs();

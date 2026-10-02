require("dotenv").config();
const axios = require("axios");

async function tester() {
    try {
        const response = await axios.get(
            "https://v3.football.api-sports.io/leagues",
            {
                headers: {
                    "x-apisports-key": process.env.API_FOOTBALL_KEY
                },
                params: {
                    search: "Premier League"
                }
            }
        );

        console.log("Nombre de ligues :", response.data.results);

        response.data.response.forEach(ligue => {
            console.log("");
            console.log("ID :", ligue.league.id);
            console.log("Nom :", ligue.league.name);
            console.log("Pays :", ligue.country.name);

            console.log(
                "Saisons :",
                ligue.seasons.map(s => s.year).join(", ")
            );
        });

    } catch (error) {
        console.log("❌ ERREUR");

        if (error.response) {
            console.log("Statut HTTP :", error.response.status);
            console.log("Détails :", error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

tester();

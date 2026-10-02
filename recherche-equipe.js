require("dotenv").config();
const axios = require("axios");

async function rechercherEquipe(nom) {
    try {
        const response = await axios.get(
            "https://v3.football.api-sports.io/teams",
            {
                headers: {
                    "x-apisports-key": process.env.API_FOOTBALL_KEY
                },
                params: {
                    search: nom
                }
            }
        );

        console.log("✅ ÉQUIPES TROUVÉES :");
        console.log("Nombre :", response.data.results);

        response.data.response.forEach(item => {
            console.log(
                `ID: ${item.team.id} | ${item.team.name} | ${item.team.country}`
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

rechercherEquipe("Chelsea");

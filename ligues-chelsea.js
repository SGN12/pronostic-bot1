require("dotenv").config();
const axios = require("axios");

async function liguesChelsea() {
    try {
        const response = await axios.get(
            "https://v3.football.api-sports.io/teams",
            {
                headers: {
                    "x-apisports-key": process.env.API_FOOTBALL_KEY
                },
                params: {
                    id: 49
                }
            }
        );

        console.log("✅ INFORMATIONS CHELSEA");
        console.log(JSON.stringify(response.data.response, null, 2));

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

liguesChelsea();

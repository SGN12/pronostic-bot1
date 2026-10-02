require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;

const API_URL = "https://v3.football.api-sports.io/fixtures";
const TEAMS_URL = "https://v3.football.api-sports.io/teams";

const SAISON = 2024;
const LIGUE = 39;

app.use(express.json());
app.use(express.static("public"));


// ===============================
// RECHERCHER UNE ÉQUIPE
// ===============================

async function trouverEquipe(nom) {

    for (let tentative = 1; tentative <= 3; tentative++) {

        try {

            const response = await axios.get(TEAMS_URL, {
                headers: {
                    "x-apisports-key":
                        process.env.API_FOOTBALL_KEY
                },

                params: {
                    search: nom
                },

                timeout: 15000
            });

            const equipes = response.data.response;

            if (!equipes || equipes.length === 0) {
                throw new Error(
                    `Équipe introuvable : ${nom}`
                );
            }

            const equipeAngleterre =
                equipes.find(
                    e => e.team.country === "England"
                );

            return (
                equipeAngleterre ||
                equipes[0]
            ).team;

        } catch (error) {

            console.log(
                `⚠️ Tentative ${tentative}/3 pour ${nom}`
            );

            if (tentative === 3) {
                throw error;
            }

            await new Promise(
                resolve => setTimeout(resolve, 2000)
            );
        }
    }
}

// ===============================
// RÉCUPÉRER LES MATCHS
// ===============================

async function obtenirMatchs(teamId) {

    for (let tentative = 1; tentative <= 3; tentative++) {

        try {

            const response = await axios.get(API_URL, {
                headers: {
                    "x-apisports-key":
                        process.env.API_FOOTBALL_KEY
                },

                params: {
                    league: LIGUE,
                    season: SAISON,
                    team: teamId
                },

                timeout: 20000
            });

            return response.data.response.filter(
                match =>
                    match.fixture.status.short === "FT"
            );

        } catch (error) {

            console.log(
                `⚠️ Tentative ${tentative}/3 pour les matchs de l'équipe ${teamId}`
            );

            if (tentative === 3) {
                throw error;
            }

            await new Promise(
                resolve => setTimeout(resolve, 2000)
            );
        }
    }
}

// ===============================
// STATISTIQUES GÉNÉRALES
// ===============================

function statsGenerales(matchs, teamId) {

    let victoires = 0;
    let nuls = 0;
    let defaites = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    matchs.forEach(match => {

        const domicile =
            match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        if (pour == null || contre == null) return;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            victoires++;
        } else if (pour === contre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const total =
        victoires + nuls + defaites;

    return {
        matchs: total,
        victoires,
        nuls,
        defaites,
        moyenneMarques:
            total ? butsMarques / total : 0,
        moyenneEncaisses:
            total ? butsEncaisses / total : 0
    };
}


// ===============================
// FORME RÉCENTE
// ===============================

function formeRecente(matchs, teamId) {

    const derniers = [...matchs]
        .sort(
            (a, b) =>
                new Date(b.fixture.date) -
                new Date(a.fixture.date)
        )
        .slice(0, 5);

    let points = 0;
    let butsMarques = 0;
    let butsEncaisses = 0;

    const forme = [];

    derniers.forEach(match => {

        const domicile =
            match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            points += 3;
            forme.push("🟢");
        } else if (pour === contre) {
            points += 1;
            forme.push("🟡");
        } else {
            forme.push("🔴");
        }
    });

    return {
        points,

        forme,

        moyenneMarques:
            derniers.length
                ? butsMarques / derniers.length
                : 0,

        moyenneEncaisses:
            derniers.length
                ? butsEncaisses / derniers.length
                : 0
    };
}


// ===============================
// DOMICILE / EXTÉRIEUR
// ===============================

function statsLieu(
    matchs,
    teamId,
    domicileRecherche
) {

    const rencontres = matchs.filter(match => {

        const domicile =
            match.teams.home.id === teamId;

        return domicile === domicileRecherche;
    });

    let victoires = 0;
    let nuls = 0;
    let defaites = 0;

    let butsMarques = 0;
    let butsEncaisses = 0;

    rencontres.forEach(match => {

        const domicile =
            match.teams.home.id === teamId;

        const pour = domicile
            ? match.goals.home
            : match.goals.away;

        const contre = domicile
            ? match.goals.away
            : match.goals.home;

        butsMarques += pour;
        butsEncaisses += contre;

        if (pour > contre) {
            victoires++;
        } else if (pour === contre) {
            nuls++;
        } else {
            defaites++;
        }
    });

    const total = rencontres.length;

    return {
        matchs: total,
        victoires,
        nuls,
        defaites,

        moyenneMarques:
            total
                ? butsMarques / total
                : 0,

        moyenneEncaisses:
            total
                ? butsEncaisses / total
                : 0
    };
}


// ===============================
// MOTEUR DE PRONOSTIC
// ===============================

function pronostiquer(
    saison1,
    saison2,
    forme1,
    forme2,
    lieu1,
    lieu2
) {

    const attaque1 =
        saison1.moyenneMarques * 0.30 +
        forme1.moyenneMarques * 0.40 +
        lieu1.moyenneMarques * 0.30;

    const attaque2 =
        saison2.moyenneMarques * 0.30 +
        forme2.moyenneMarques * 0.40 +
        lieu2.moyenneMarques * 0.30;

    const defense1 =
        saison1.moyenneEncaisses * 0.30 +
        forme1.moyenneEncaisses * 0.40 +
        lieu1.moyenneEncaisses * 0.30;

    const defense2 =
        saison2.moyenneEncaisses * 0.30 +
        forme2.moyenneEncaisses * 0.40 +
        lieu2.moyenneEncaisses * 0.30;

    const scoreForme1 =
        forme1.points / 15;

    const scoreForme2 =
        forme2.points / 15;

    const force1 =
        attaque1 * 0.45 +
        (2 - defense1) * 0.25 +
        scoreForme1 * 0.30;

    const force2 =
        attaque2 * 0.45 +
        (2 - defense2) * 0.25 +
        scoreForme2 * 0.30;

    const f1 = Math.max(force1, 0.1);
    const f2 = Math.max(force2, 0.1);

    const total = f1 + f2;

    let victoire1 =
        (f1 / total) * 100;

    let victoire2 =
        (f2 / total) * 100;

    let nul =
        30 - Math.abs(f1 - f2) * 8;

    nul = Math.max(
        15,
        Math.min(30, nul)
    );

    const facteur =
        (100 - nul) /
        (victoire1 + victoire2);

    victoire1 *= facteur;
    victoire2 *= facteur;

    const buts1 =
        (attaque1 + defense2) / 2;

    const buts2 =
        (attaque2 + defense1) / 2;

    const butsAttendus =
        buts1 + buts2;

    let over25 = 40;

    if (butsAttendus >= 3) {
        over25 = 70;
    } else if (butsAttendus >= 2.5) {
        over25 = 60;
    } else if (butsAttendus >= 2) {
        over25 = 50;
    }

    let btts = 40;

    if (
        buts1 >= 1.2 &&
        buts2 >= 1.2
    ) {
        btts = 65;
    } else if (
        buts1 >= 1 &&
        buts2 >= 1
    ) {
        btts = 55;
    }

    return {
        victoire1: Math.round(victoire1),
        nul: Math.round(nul),
        victoire2: Math.round(victoire2),

        over25,
        btts,

        buts1: buts1.toFixed(2),
        buts2: buts2.toFixed(2),

        butsAttendus:
            butsAttendus.toFixed(2),

        score:
            `${Math.round(buts1)}-${Math.round(buts2)}`
    };
}


// ===============================
// API DU BOT
// ===============================

app.post("/api/analyser", async (req, res) => {

    try {

        const { equipe1, equipe2 } = req.body;

        if (!equipe1 || !equipe2) {

            return res.status(400).json({
                erreur:
                    "Les deux équipes sont obligatoires."
            });
        }


        console.log("");
        console.log(
            `🔎 Analyse : ${equipe1} vs ${equipe2}`
        );


        // Trouver les équipes

        const team1 =
            await trouverEquipe(equipe1);

        const team2 =
            await trouverEquipe(equipe2);


        console.log(
            `✅ ${team1.name} (${team1.id})`
        );

        console.log(
            `✅ ${team2.name} (${team2.id})`
        );


        // Récupérer les matchs

        const matchs1 =
            await obtenirMatchs(team1.id);

        const matchs2 =
            await obtenirMatchs(team2.id);


        if (
            matchs1.length === 0 ||
            matchs2.length === 0
        ) {

            return res.status(404).json({
                erreur:
                    "Pas assez de données pour analyser ces équipes."
            });
        }


        // Statistiques

        const saison1 =
            statsGenerales(
                matchs1,
                team1.id
            );

        const saison2 =
            statsGenerales(
                matchs2,
                team2.id
            );


        // Forme

        const forme1 =
            formeRecente(
                matchs1,
                team1.id
            );

        const forme2 =
            formeRecente(
                matchs2,
                team2.id
            );


        // Lieu du match :
        // équipe 1 = domicile
        // équipe 2 = extérieur

        const lieu1 =
            statsLieu(
                matchs1,
                team1.id,
                true
            );

        const lieu2 =
            statsLieu(
                matchs2,
                team2.id,
                false
            );


        // Pronostic

        const resultat =
            pronostiquer(
                saison1,
                saison2,
                forme1,
                forme2,
                lieu1,
                lieu2
            );


        res.json({

            equipe1: team1.name,
            equipe2: team2.name,

            ids: {
                equipe1: team1.id,
                equipe2: team2.id
            },

            forme1: forme1.forme.join(""),
            forme2: forme2.forme.join(""),

            points1: forme1.points,
            points2: forme2.points,

            ...resultat,

            avertissement:
                "Estimation statistique, pas une garantie."
        });


    } catch (error) {

        console.error(
            "❌ ERREUR :",
            error.message
        );

        if (error.response) {

            console.error(
                error.response.data
            );

            return res.status(500).json({
                erreur:
                    "Erreur API-Football."
            });
        }

        res.status(500).json({
            erreur: error.message
        });
    }
});


// ===============================
// LANCEMENT
// ===============================

app.listen(PORT, () => {

    console.log("");
    console.log(
        `🚀 PRONOSTIC BOT lancé sur http://localhost:${PORT}`
    );

});

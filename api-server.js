const express = require("express");
const COMPETITIONS = require("./competitions");
const axios = require("axios");
require("dotenv").config();
const {
    chargerHistoriqueComplet
} = require("./historique-complet");
const moteur = require("./moteur-final");
const app = express();
const path = require("path");

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

const PORT = 3000;

const API_URL =
    "https://v3.football.api-sports.io/fixtures";

const LEAGUE = 39;
const SEASON = 2024;

const HEADERS = {
    "x-apisports-key":
        process.env.API_FOOTBALL_KEY
};

// ==========================================
// OUTILS
// ==========================================

function moyenne(tab) {
    if (!tab.length) return 0;

    return tab.reduce(
        (a, b) => a + b,
        0
    ) / tab.length;
}

function clamp(x, min, max) {
    return Math.max(
        min,
        Math.min(max, x)
    );
}

function factorial(n) {
    if (n <= 1) return 1;

    let r = 1;

    for (let i = 2; i <= n; i++) {
        r *= i;
    }

    return r;
}

function poisson(k, lambda) {

    if (lambda <= 0) {
        return k === 0 ? 1 : 0;
    }

    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
    );
}

// ==========================================
// CHARGER LES MATCHS
// ==========================================

async function chargerMatchs(competition = "premierLeague") {

    const config = COMPETITIONS[competition];

    if (!config) {
        throw new Error(
            `Compétition inconnue : ${competition}`
        );
    }

    console.log(
        `🏆 Chargement : ${config.nom} (${config.leagueId})`
    );

    const response =
        await axios.get(API_URL, {
            params: {
                league: config.leagueId,
                season: SEASON,
                status: "FT"
            },
            headers: HEADERS,
            timeout: 30000
        });

    return response.data.response || [];
}

// ==========================================
// NORMALISATION
// ==========================================

function normaliserMatch(match) {

    return {

        date:
            new Date(
                match.fixture.date
            ),

        homeId:
            match.teams.home.id,

        awayId:
            match.teams.away.id,

        homeName:
            match.teams.home.name,

        awayName:
            match.teams.away.name,

        homeGoals:
            match.goals.home,

        awayGoals:
            match.goals.away
    };
}

// ==========================================
// HISTORIQUE PAR COMPÉTITION
// ==========================================


function chargerHistoriqueDepuisCache(competition) {
    const fs = require("fs");
    const path = require("path");

    const fichier = path.join(
        __dirname,
        "data",
        `${competition}.json`
    );

    if (!fs.existsSync(fichier)) {
        throw new Error(
            `Cache introuvable : ${fichier}`
        );
    }

    const contenu =
        fs.readFileSync(fichier, "utf8").trim();

    if (!contenu) {
        throw new Error(
            `Cache vide : ${fichier}`
        );
    }

    const matchs = JSON.parse(contenu);

    if (!Array.isArray(matchs)) {
        throw new Error(
            `Format du cache invalide : ${fichier}`
        );
    }

    console.log(
        `📦 Cache ${competition} : ${matchs.length} matchs`
    );

    return matchs;
}

async function chargerHistoriqueCompetition(
    competition = "premierLeague"
) {

    const config = COMPETITIONS[competition];

    if (!config) {
        throw new Error(
            `Compétition inconnue : ${competition}`
        );
    }

    const saisons = [2022, 2023, 2024];

    let historique = [];

    for (const saison of saisons) {

        console.log(
            `⏳ ${config.nom} — saison ${saison}...`
        );

        const response = await axios.get(
            API_URL,
            {
                params: {
                    league: config.leagueId,
                    season: saison,
                    status: "FT"
                },
                headers: HEADERS,
                timeout: 30000
            }
        );

        const matchs =
            (response.data.response || [])
                .map(normaliserMatch)
                .filter(m =>
                    m.homeGoals !== null &&
                    m.awayGoals !== null
                );

        console.log(
            `✅ ${config.nom} ${saison} : ${matchs.length} matchs`
        );

        historique.push(...matchs);
    }

    historique.sort(
        (a, b) => a.date - b.date
    );

    console.log(
        `📊 Historique ${config.nom} : ${historique.length} matchs`
    );

    return historique;
}

// ==========================================
// HISTORIQUE
// ==========================================

function historiqueEquipe(
    matchs,
    teamId
) {

    return matchs
        .filter(m =>
            m.homeId === teamId ||
            m.awayId === teamId
        )
        .sort(
            (a, b) =>
                b.date - a.date
        );
}

// ==========================================
// STATISTIQUES
// ==========================================

function statistiquesEquipe(
    matchs,
    teamId
) {

    const historiques =
        historiqueEquipe(
            matchs,
            teamId
        );

    if (historiques.length < 5) {
        return null;
    }

    const butsPour = [];
    const butsContre = [];

    for (const match of historiques) {

        const domicile =
            match.homeId === teamId;

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsPour.push(pour);
        butsContre.push(contre);
    }

    const derniers =
        historiques.slice(0, 5);

    const butsRecentsPour = [];
    const butsRecentsContre = [];

    let points = 0;

    for (const match of derniers) {

        const domicile =
            match.homeId === teamId;

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsRecentsPour.push(pour);
        butsRecentsContre.push(contre);

        if (pour > contre) {
            points += 3;
        }
        else if (pour === contre) {
            points += 1;
        }
    }

    return {

        attaque:
            moyenne(butsPour),

        defense:
            moyenne(butsContre),

        attaqueRecente:
            moyenne(butsRecentsPour),

        defenseRecente:
            moyenne(butsRecentsContre),

        formePoints:
            points /
            (derniers.length * 3)
    };
}

// ==========================================
// DOMICILE / EXTÉRIEUR
// ==========================================

function statistiquesLieu(
    matchs,
    teamId,
    domicile
) {

    const historiques =
        historiqueEquipe(
            matchs,
            teamId
        )
        .filter(m =>
            domicile
                ? m.homeId === teamId
                : m.awayId === teamId
        );

    if (historiques.length < 3) {
        return null;
    }

    const butsPour = [];
    const butsContre = [];

    for (const match of historiques) {

        const pour =
            domicile
                ? match.homeGoals
                : match.awayGoals;

        const contre =
            domicile
                ? match.awayGoals
                : match.homeGoals;

        butsPour.push(pour);
        butsContre.push(contre);
    }

    return {

        attaque:
            moyenne(butsPour),

        defense:
            moyenne(butsContre)
    };
}

// ==========================================
// MOTEUR V25
// ==========================================

function calculerPronostic(
    matchs,
    homeId,
    awayId
) {

    const homeStats =
        statistiquesEquipe(
            matchs,
            homeId
        );

    const awayStats =
        statistiquesEquipe(
            matchs,
            awayId
        );

    const homeVenue =
        statistiquesLieu(
            matchs,
            homeId,
            true
        );

    const awayVenue =
        statistiquesLieu(
            matchs,
            awayId,
            false
        );

    if (
        !homeStats ||
        !awayStats ||
        !homeVenue ||
        !awayVenue
    ) {
        throw new Error(
            "Pas assez de données historiques."
        );
    }

    const attaqueHome =
        homeStats.attaque * 0.50 +
        homeStats.attaqueRecente * 0.20 +
        homeVenue.attaque * 0.30;

    const defenseHome =
        homeStats.defense * 0.50 +
        homeStats.defenseRecente * 0.20 +
        homeVenue.defense * 0.30;

    const attaqueAway =
        awayStats.attaque * 0.50 +
        awayStats.attaqueRecente * 0.20 +
        awayVenue.attaque * 0.30;

    const defenseAway =
        awayStats.defense * 0.50 +
        awayStats.defenseRecente * 0.20 +
        awayVenue.defense * 0.30;

    let lambdaHome =
        Math.sqrt(
            attaqueHome *
            defenseAway
        );

    let lambdaAway =
        Math.sqrt(
            attaqueAway *
            defenseHome
        );

    lambdaHome *= 1.05;

    const differenceForme =
        homeStats.formePoints -
        awayStats.formePoints;

    const ajustement =
        clamp(
            differenceForme * 0.10,
            -0.10,
            0.10
        );

    lambdaHome *=
        1 + ajustement;

    lambdaAway *=
        1 - ajustement;

    lambdaHome =
        clamp(
            lambdaHome,
            0.15,
            4.5
        );

    lambdaAway =
        clamp(
            lambdaAway,
            0.15,
            4.5
        );

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    let over25 = 0;
    let btts = 0;

    let meilleurScore = null;
    let meilleureProba = 0;

    for (
        let home = 0;
        home <= 7;
        home++
    ) {

        for (
            let away = 0;
            away <= 7;
            away++
        ) {

            const p =
                poisson(
                    home,
                    lambdaHome
                ) *
                poisson(
                    away,
                    lambdaAway
                );

            if (home > away) {
                pHome += p;
            }
            else if (home === away) {
                pDraw += p;
            }
            else {
                pAway += p;
            }

            if (home + away >= 3) {
                over25 += p;
            }

            if (
                home >= 1 &&
                away >= 1
            ) {
                btts += p;
            }

            if (p > meilleureProba) {

                meilleureProba = p;

                meilleurScore = {
                    home,
                    away
                };
            }
        }
    }

    const total =
        pHome +
        pDraw +
        pAway;

    pHome /= total;
    pDraw /= total;
    pAway /= total;

    let prediction = "1";
    let confiance = pHome;

    if (pDraw > confiance) {
        prediction = "N";
        confiance = pDraw;
    }

    if (pAway > confiance) {
        prediction = "2";
        confiance = pAway;
    }

    return {

        prediction,

        confiance:
            Number(
                (confiance * 100)
                    .toFixed(2)
            ),

        probabilites: {

            domicile:
                Number(
                    (pHome * 100)
                        .toFixed(2)
                ),

            nul:
                Number(
                    (pDraw * 100)
                        .toFixed(2)
                ),

            exterieur:
                Number(
                    (pAway * 100)
                        .toFixed(2)
                )
        },

        scoreProbable:
            `${meilleurScore.home}-${meilleurScore.away}`,

        over25:
            Number(
                (over25 * 100)
                    .toFixed(2)
            ),

        btts:
            Number(
                (btts * 100)
                    .toFixed(2)
            ),

        butsAttendus: {

            domicile:
                Number(
                    lambdaHome.toFixed(2)
                ),

            exterieur:
                Number(
                    lambdaAway.toFixed(2)
                )
        }
    };
}

// ==========================================
// ROUTE API
// ==========================================

app.get(
    "/api/pronostic",
    async (req, res) => {
        try {
            const home = String(req.query.home || "").trim();
            const away = String(req.query.away || "").trim();
            const competition = String(
                req.query.competition || "premierLeague"
            ).trim();

            if (!home || !away) {
                return res.status(400).json({
                    succes: false,
                    erreur: "Équipes domicile et extérieure manquantes."
                });
            }

            if (!competition || !COMPETITIONS[competition]) {
                return res.status(400).json({
                    succes: false,
                    erreur: "Compétition invalide ou manquante."
                });
            }

            const matchs = chargerHistoriqueDepuisCache(competition);

            function normaliserNomEquipe(nom) {
                return String(nom || "")
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\bfc\b/g, "")
                    .replace(/\bafc\b/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
            }

            const aliasEquipes = {
                "psg": "paris saint germain",
                "paris sg": "paris saint germain",
                "om": "marseille",
                "ol": "lyon",
                "asm": "monaco",
                "losc": "lille"
            };

            function trouverEquipe(nom) {
                const recherche = normaliserNomEquipe(nom);
                const rechercheFinale =
                    aliasEquipes[recherche] || recherche;

                return matchs.find(m => {
                    const domicile =
                        normaliserNomEquipe(m.homeName);
                    const exterieur =
                        normaliserNomEquipe(m.awayName);

                    return (
                        domicile === rechercheFinale ||
                        exterieur === rechercheFinale
                    );
                });
            }

            function trouverIdEquipe(match, nom) {
                const recherche = normaliserNomEquipe(nom);

                if (
                    normaliserNomEquipe(match.homeName) === recherche
                ) {
                    return match.homeId;
                }

                if (
                    normaliserNomEquipe(match.awayName) === recherche
                ) {
                    return match.awayId;
                }

                return null;
            }

            const homeMatch = trouverEquipe(home);
            const awayMatch = trouverEquipe(away);

            if (!homeMatch) {
                return res.status(404).json({
                    succes: false,
                    erreur:
                        `Équipe domicile introuvable : ${home}`
                });
            }

            if (!awayMatch) {
                return res.status(404).json({
                    succes: false,
                    erreur:
                        `Équipe extérieure introuvable : ${away}`
                });
            }

            const homeId = trouverIdEquipe(homeMatch, home);
            const awayId = trouverIdEquipe(awayMatch, away);

            if (!homeId || !awayId) {
                return res.status(404).json({
                    succes: false,
                    erreur: "Impossible d'identifier les IDs des équipes."
                });
            }

            const pronostic =
                moteur.calculerPronostic(
                    matchs,
                    homeId,
                    awayId
                );

            return res.json({
                succes: true,
                match: {
                    domicile: home,
                    exterieur: away
                },
                pronostic: {
                    prediction: pronostic.prediction,
                    confiance: Number(
                        (pronostic.probabilite * 100).toFixed(2)
                    ),
                    probabilites: {
                        domicile: Number(
                            (pronostic.home * 100).toFixed(2)
                        ),
                        nul: Number(
                            (pronostic.draw * 100).toFixed(2)
                        ),
                        exterieur: Number(
                            (pronostic.away * 100).toFixed(2)
                        )
                    },
                    scoreProbable: pronostic.scoreProbable,
                    over25: Number(
                        (pronostic.over25 * 100).toFixed(2)
                    ),
                    btts: Number(
                        (pronostic.btts * 100).toFixed(2)
                    ),
                    butsAttendus: {
                        domicile: Number(
                            pronostic.lambdaHome.toFixed(2)
                        ),
                        exterieur: Number(
                            pronostic.lambdaAway.toFixed(2)
                        )
                    }
                }
            });

        } catch (error) {
            console.error("API PRONOSTIC ERROR:", error);

            return res.status(500).json({
                succes: false,
                erreur: error.message
            });
        }
    }
);

// ==========================================
// RECHERCHE DES ÉQUIPES
// ==========================================

app.get("/api/equipes", async (req, res) => {

    try {

        const search = String(
            req.query.search || ""
        ).trim();

        if (!search) {
            return res.status(400).json({
                succes: false,
                erreur: "Paramètre search manquant"
            });
        }

        const response = await axios.get(
            "https://v3.football.api-sports.io/teams",
            {
                params: {
                    search: search
                },
                headers: HEADERS
            }
        );

        const equipes = (response.data.response || [])
            .map(item => ({
                id: item.team.id,
                nom: item.team.name,
                pays: item.team.country,
                logo: item.team.logo
            }));

        res.json({
            succes: true,
            recherche: search,
            equipes: equipes
        });

    } catch (error) {

        console.error(
            "Erreur recherche équipe :",
            error.message
        );

        res.status(500).json({
            succes: false,
            erreur: error.message
        });
    }
});
// ==========================================
// PROCHAIN MATCH D'UNE ÉQUIPE
// ==========================================


// ==========================================
// MATCHS ACTUELS PREMIER LEAGUE
// Source : football.json
// ==========================================

app.get("/api/prochains-matchs", async (req, res) => {
    try {
        const competition =
            req.query.competition || "premierLeague";

        /*
         * ==============================
         * 🏆 CHAMPIONS LEAGUE — UEFA
         * ==============================
         */
        if (competition === "championsLeague") {

            const maintenant = new Date();

            let matchsUEFA = [];

            /*
             * UEFA limite chaque requête à 100 matchs.
             * On récupère plusieurs pages.
             */
            for (let offset = 0; offset < 500; offset += 100) {

                const url =
                    "https://match.uefa.com/v5/matches" +
                    "?competitionId=1" +
                    "&seasonYear=2027" +
                    "&phase=ALL" +
                    "&order=ASC" +
                    `&offset=${offset}` +
                    "&limit=100";

                const response =
                    await axios.get(url);

                if (!Array.isArray(response.data)) {
                    break;
                }

                matchsUEFA.push(...response.data);

                /*
                 * Si UEFA renvoie moins de 100 matchs,
                 * il n'y a plus de page suivante.
                 */
                if (response.data.length < 100) {
                    break;
                }
            }

            const obtenirNomEquipe = (equipe) => {

                if (!equipe) {
                    return "Équipe inconnue";
                }

                const translations =
                    equipe.translations?.displayName;

                if (
                    translations &&
                    typeof translations.FR === "string"
                ) {
                    return translations.FR;
                }

                if (
                    translations &&
                    typeof translations.EN === "string"
                ) {
                    return translations.EN;
                }

                if (
                    equipe.displayName &&
                    typeof equipe.displayName === "string"
                ) {
                    return equipe.displayName;
                }

                if (
                    typeof equipe.internationalName === "string"
                ) {
                    return equipe.internationalName;
                }

                return "Équipe inconnue";
            };

            const prochains = matchsUEFA
                .filter(match => {

                    const dateTime =
                        match.kickOffTime?.dateTime;

                    if (!dateTime) {
                        return false;
                    }

                    return new Date(dateTime) >= maintenant;
                })
                .sort((a, b) => {

                    return (
                        new Date(
                            a.kickOffTime.dateTime
                        ) -
                        new Date(
                            b.kickOffTime.dateTime
                        )
                    );
                })
                .slice(0, 20)
                .map(match => {

                    const dateUTC =
                        new Date(
                            match.kickOffTime.dateTime
                        );

                    const dateAbidjan =
                        new Intl.DateTimeFormat(
                            "fr-FR",
                            {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }
                        ).format(dateUTC);

                    const heureAbidjan =
                        new Intl.DateTimeFormat(
                            "fr-FR",
                            {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }
                        ).format(dateUTC);

                    return {
                        date: dateAbidjan,
                        time: heureAbidjan,

                        team1:
                            obtenirNomEquipe(
                                match.homeTeam
                            ),

                        team2:
                            obtenirNomEquipe(
                                match.awayTeam
                            ),

                        round:
                            match.round?.translations?.name?.FR ||
                            match.round?.translations?.name?.EN ||
                            "Champions League",

                        id: match.id
                    };
                });

            return res.json({
                succes: true,
                competition: "championsLeague",
                championnat: "Champions League",
                total: prochains.length,
                matchs: prochains
            });
        }

        /*
         * ==============================
         * 🇬🇧 🇪🇸 🇮🇹 🇩🇪 🇫🇷
         * CHAMPIONNATS NATIONAUX
         * ==============================
         */
        if (competition === "jupilerProLeague") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/bel.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "Belgian Pro League",
                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),
                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),
                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",
                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "jupilerProLeague",
                championnat: "Jupiler Pro League",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "superLig") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "Turkish Super Lig",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "superLig",
                championnat: "Süper Lig",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "saudiProLeague") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "Saudi Pro League",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "saudiProLeague",
                championnat: "Saudi Pro League",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "conferenceLeague") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa.conf/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "UEFA Conference League",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "conferenceLeague",
                championnat: "Conference League",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "europaLeague") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "UEFA Europa League",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "europaLeague",
                championnat: "Europa League",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "ligaArgentina") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "Argentine Liga Profesional",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "ligaArgentina",
                championnat: "Liga Profesional",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "brasileirao") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch = new Date(match.date);
                        return !isNaN(dateMatch) && dateMatch >= maintenant;
                    })
                    .sort((a, b) =>
                        new Date(a.date) - new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "Brazilian Serie A",

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit"
                            }).format(new Date(match.date)),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(new Date(match.date)),

                        team1:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "home"
                            )?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]?.competitors?.find(
                                e => e.homeAway === "away"
                            )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "brasileirao",
                championnat: "Brasileirão",
                total: prochains.length,
                matchs: prochains
            });
        }

        if (competition === "mls") {
            const response = await axios.get(
                "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard"
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch =
                            new Date(match.date);

                        return (
                            !isNaN(dateMatch) &&
                            dateMatch >= maintenant
                        );
                    })
                    .sort((a, b) =>
                        new Date(a.date) -
                        new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            "MLS",
                        date:
                            new Intl.DateTimeFormat(
                                "fr-FR",
                                {
                                    timeZone:
                                        "Africa/Abidjan",
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit"
                                }
                            ).format(
                                new Date(match.date)
                            ),
                        time:
                            new Intl.DateTimeFormat(
                                "fr-FR",
                                {
                                    timeZone:
                                        "Africa/Abidjan",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false
                                }
                            ).format(
                                new Date(match.date)
                            ),
                        team1:
                            match.competitions?.[0]
                                ?.competitors?.find(
                                    e => e.homeAway === "home"
                                )?.team?.displayName ||
                            "Équipe inconnue",
                        team2:
                            match.competitions?.[0]
                                ?.competitors?.find(
                                    e => e.homeAway === "away"
                                )?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition: "mls",
                championnat: "MLS",
                total: prochains.length,
                matchs: prochains
            });
        }

        const espnCompetitions = {
            afriqueDuSud: ["rsa.1", "Premier Soccer League"],
            grece: ["gre.1", "Super League"],
            autriche: ["aut.1", "Bundesliga"],
            danemark: ["den.1", "Superliga"],
            suede: ["swe.1", "Allsvenskan"],
            norvege: ["nor.1", "Eliteserien"],
            roumanie: ["rou.1", "Liga I"]
        };

        if (espnCompetitions[competition]) {
            const [slug, championnat] =
                espnCompetitions[competition];

            const response = await axios.get(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
                { timeout: 15000 }
            );

            const maintenant = new Date();

            const prochains =
                (response.data.events || [])
                    .filter(match => {
                        const dateMatch =
                            new Date(match.date);

                        return (
                            !isNaN(dateMatch) &&
                            dateMatch >= maintenant
                        );
                    })
                    .sort((a, b) =>
                        new Date(a.date) -
                        new Date(b.date)
                    )
                    .map(match => ({
                        round:
                            match.season?.slug ||
                            championnat,

                        date:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                            }).format(
                                new Date(match.date)
                            ),

                        time:
                            new Intl.DateTimeFormat("fr-FR", {
                                timeZone: "Africa/Abidjan",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                            }).format(
                                new Date(match.date)
                            ),

                        team1:
                            match.competitions?.[0]
                                ?.competitors
                                ?.find(
                                    e =>
                                        e.homeAway === "home"
                                )
                                ?.team?.displayName ||
                            "Équipe inconnue",

                        team2:
                            match.competitions?.[0]
                                ?.competitors
                                ?.find(
                                    e =>
                                        e.homeAway === "away"
                                )
                                ?.team?.displayName ||
                            "Équipe inconnue"
                    }))
                    .slice(0, 20);

            return res.json({
                succes: true,
                competition,
                championnat,
                total: prochains.length,
                matchs: prochains
            });
        }

        const competitionsCalendrier = {
            premierLeague: {
                fichier: "en.1.json",
                nom: "Premier League"
            },
            laliga: {
                fichier: "es.1.json",
                nom: "La Liga"
            },
            serieA: {
                fichier: "it.1.json",
                nom: "Serie A"
            },
            bundesliga: {
                fichier: "de.1.json",
                nom: "Bundesliga"
            },
            ligue1: {
                fichier: "fr.1.json",
                nom: "Ligue 1"
            },
            primeiraLiga: {
                fichier: "pt.1.json",
                nom: "Primeira Liga"
            },
            eredivisie: {
                fichier: "nl.1.json",
                nom: "Eredivisie"
            },
        };

        const config =
            competitionsCalendrier[competition];

        if (!config) {
            return res.status(400).json({
                succes: false,
                erreur: "Compétition inconnue"
            });
        }

        const url =
            `https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/${config.fichier}`;

        const response = await axios.get(url);

        const matchs =
            response.data.matches || [];

        const maintenant = new Date();

        const prochains = matchs
            .filter(match => {
                if (!match.date) {
                    return false;
                }

                const dateMatch = new Date(
                    `${match.date}T${match.time || "00:00"}:00`
                );

                return dateMatch >= maintenant;
            })
            .sort((a, b) => {
                const dateA = new Date(
                    `${a.date}T${a.time || "00:00"}:00`
                );

                const dateB = new Date(
                    `${b.date}T${b.time || "00:00"}:00`
                );

                return dateA - dateB;
            });

        res.json({
            succes: true,
            competition: competition,
            championnat: config.nom,
            total: prochains.length,
            matchs: prochains.slice(0, 20)
        });

    } catch (error) {

        console.error(
            "❌ Erreur prochains matchs :",
            error.response?.data ||
            error.message
        );

        res.status(500).json({
            succes: false,
            erreur: error.message
        });
    }
});

app.get("/api/prochain-match", async (req, res) => {

    try {

        const equipeRecherchee = String(
            req.query.team || ""
        ).trim().toLowerCase();

        if (!equipeRecherchee) {
            return res.status(400).json({
                succes: false,
                erreur: "Paramètre team manquant"
            });
        }

        const url =
            "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

        const response = await axios.get(url);

        const matchs = response.data.matches || [];

        const maintenant = new Date();

        const prochain = matchs
            .filter(match => {

                if (!match.date) {
                    return false;
                }

                const nom1 = String(
                    match.team1 || ""
                ).toLowerCase();

                const nom2 = String(
                    match.team2 || ""
                ).toLowerCase();

                const dateMatch = new Date(
                    `${match.date}T${match.time || "00:00"}:00`
                );

                const equipePresente =
                    nom1.includes(equipeRecherchee) ||
                    nom2.includes(equipeRecherchee);

                return (
                    equipePresente &&
                    dateMatch >= maintenant
                );

            })
            .sort((a, b) => {

                const dateA = new Date(
                    `${a.date}T${a.time || "00:00"}:00`
                );

                const dateB = new Date(
                    `${b.date}T${b.time || "00:00"}:00`
                );

                return dateA - dateB;

            })[0];

        if (!prochain) {

            return res.json({
                succes: true,
                match: null,
                message: "Aucun prochain match trouvé"
            });

        }

        res.json({
            succes: true,
            championnat: response.data.name,
            match: {
                round: prochain.round,
                date: prochain.date,
                heure: prochain.time || null,
                domicile: prochain.team1,
                exterieur: prochain.team2
            }
        });

    } catch (error) {

        console.error(
            "Erreur prochain match :",
            error.message
        );

        res.status(500).json({
            succes: false,
            erreur: error.message
        });

    }

});
// ==========================================
// PRONOSTIC DU PROCHAIN MATCH — MOTEUR V25
// ==========================================

app.get("/api/pronostic-prochain", async (req, res) => {

    try {

        const equipeRecherchee =
            String(req.query.team || "").trim();

        if (!equipeRecherchee) {
            return res.status(400).json({
                succes: false,
                erreur: "Paramètre team manquant"
            });
        }

        // ==========================================
        // 🌍 V25 — GRÈCE / AUTRICHE / DANEMARK
        // Historiques ESPN + calendrier ESPN
        // ==========================================

        const configHistorique = {
            laliga: {
                championnat: "La Liga",
                cache: "laLiga.json",
                espn: "esp.1"
            },
            grece: {
                championnat: "Super League",
                cache: "grece.json",
                espn: "gre.1"
            },
            autriche: {
                championnat: "Bundesliga",
                cache: "autriche.json",
                espn: "aut.1"
            },
            danemark: {
                championnat: "Superliga",
                cache: "danemark.json",
                espn: "den.1"
            },
            seriea: {
                championnat: "Serie A",
                cache: "serieA.json",
                espn: "ita.1"
            },
            suede: {
                championnat: "Allsvenskan",
                cache: "suede.json",
                espn: "swe.1"
            },
            norvege: {
                championnat: "Eliteserien",
                cache: "norvege.json",
                espn: "nor.1"
            },
            roumanie: {
                championnat: "Liga I",
                cache: "roumanie.json",
                espn: "rou.1"
            }
        };

        const competitionHistorique =
            String(req.query.competition || "").trim().toLowerCase();

        const configESPNHistorique =
            configHistorique[competitionHistorique];

        if (configESPNHistorique) {

            const normaliserNom = nom =>
                String(nom || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/æ/gi, "ae")
                    .replace(/ø/gi, "o")
                    .replace(/å/gi, "a")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim();

            const aliasEquipes = {
                // 🇩🇰 Danemark
                "fc nordsjaelland": "fc nordsjaelland",
                "fc nordsjælland": "fc nordsjaelland",
                "odense boldklub": "odense",
                "odense bk": "odense",
                "fc copenhagen": "fc copenhagen",
                "fc københavn": "fc copenhagen",
                "fc koebenhavn": "fc copenhagen",
                "brøndby if": "brondby",
                "brondby if": "brondby",
                "aarhus gf": "aarhus",
                "agf": "aarhus",
                "lyngby boldklub": "lyngby",
                "viborg ff": "viborg",
                "silkeborg if": "silkeborg",
                "aalborg bk": "aalborg",

                // 🇦🇹 Autriche
                "rb salzburg": "red bull salzburg",
                "fc red bull salzburg": "red bull salzburg",
                "lask": "lask linz",
                "lask linz": "lask linz",
                "rapid vienna": "rapid vienna",
                "sk rapid wien": "rapid vienna",
                "austria vienna": "austria vienna",
                "fk austria wien": "austria vienna",
                "sturm graz": "sturm graz",
                "tsv hartberg": "tsv hartberg",
                "wolfsberger": "wolfsberger ac",
                "wolfsberger ac": "wolfsberger ac",
                "wsg tirol": "wsg wattens",
                "wsg wattens": "wsg wattens",
                "bw linz": "fc bw linz",
                "fc bw linz": "fc bw linz",
                "scr altach": "scr altach",
                "austria klagenfurt": "austria klagenfurt",
                "austria lustenau": "austria lustenau",
                "ried": "ried",

                // 🇷🇴 Roumanie
                "fcsb": "fcsb",
                "steaua bucuresti": "fcsb",
                "otelul galati": "otelul galati",
                "otelul": "otelul galati",
                "oțelul galați": "otelul galati"
            };

            const historique =
                require(`./data/${configESPNHistorique.cache}`);

            const recherche =
                normaliserNom(equipeRecherchee);

            const trouverEquipe = nom => {

                const rechercheBrute =
                    normaliserNom(nom);

                const rechercheEquipe =
                    aliasEquipes[rechercheBrute] ||
                    rechercheBrute;

                const match =
                    historique.find(m => {

                        const home =
                            normaliserNom(m.homeName);

                        const away =
                            normaliserNom(m.awayName);

                        return (
                            home === rechercheEquipe ||
                            away === rechercheEquipe ||
                            home.includes(rechercheEquipe) ||
                            rechercheEquipe.includes(home) ||
                            away.includes(rechercheEquipe) ||
                            rechercheEquipe.includes(away)
                        );
                    });

                if (!match) return null;

                const home =
                    normaliserNom(match.homeName);

                const away =
                    normaliserNom(match.awayName);

                if (
                    home === rechercheEquipe ||
                    home.includes(rechercheEquipe) ||
                    rechercheEquipe.includes(home)
                ) {
                    return {
                        id: match.homeId,
                        nom: match.homeName
                    };
                }

                if (
                    away === rechercheEquipe ||
                    away.includes(rechercheEquipe) ||
                    rechercheEquipe.includes(away)
                ) {
                    return {
                        id: match.awayId,
                        nom: match.awayName
                    };
                }

                return null;
            };

            // 🇷🇴 Roumanie : calendrier actuel via LPF
            if (competitionHistorique === "roumanie") {

                try {
                    const urlLPF =
                        "https://lpf.ro/cluburi/fcsb/3/calendar";

                    const pageLPF =
                        await axios.get(
                            urlLPF,
                            {
                                timeout: 15000
                            }
                        );

                    const htmlLPF =
                        pageLPF.data || "";

                    const indexEquipe =
                        htmlLPF.toLowerCase()
                            .indexOf(
                                rechercheNorm.toLowerCase()
                            );

                    if (indexEquipe !== -1) {
                        console.log(
                            "🇷🇴 LPF : page FCSB chargée"
                        );
                    }

                } catch (erreurLPF) {
                    console.log(
                        `⚠️ LPF : ${erreurLPF.message}`
                    );
                }
            }

            // Recherche des matchs ESPN sur les 60 prochains jours
            const maintenantESPN =
                new Date();

            let prochainESPN = null;

            for (
                let i = 0;
                i <= 60 && !prochainESPN;
                i++
            ) {

                const date =
                    new Date(maintenantESPN);

                date.setDate(
                    date.getDate() + i
                );

                const dateISO =
                    date.toISOString()
                        .slice(0, 10)
                        .replace(/-/g, "");

                try {

                    const url =
                        `https://site.api.espn.com/apis/site/v2/sports/soccer/${configESPNHistorique.espn}/scoreboard?dates=${dateISO}`;

                    const resultat =
                        await axios.get(
                            url,
                            {
                                timeout: 15000
                            }
                        );

                    const events =
                        resultat.data.events || [];

                    for (const event of events) {

                        const competition =
                            event.competitions?.[0];

                        const home =
                            competition?.competitors?.find(
                                c => c.homeAway === "home"
                            );

                        const away =
                            competition?.competitors?.find(
                                c => c.homeAway === "away"
                            );

                        if (!home || !away) {
                            continue;
                        }

                        const homeNom =
                            home.team?.displayName || "";

                        const awayNom =
                            away.team?.displayName || "";

                        const rechercheNorm =
                            normaliserNom(
                                equipeRecherchee
                            );

                        if (
                            normaliserNom(homeNom)
                                .includes(rechercheNorm) ||
                            normaliserNom(awayNom)
                                .includes(rechercheNorm) ||
                            rechercheNorm
                                .includes(normaliserNom(homeNom)) ||
                            rechercheNorm
                                .includes(normaliserNom(awayNom))
                        ) {

                            prochainESPN = {
                                id: event.id,
                                date: event.date,
                                team1: homeNom,
                                team2: awayNom
                            };

                            break;
                        }
                    }

                } catch (erreurESPN) {
                    console.log(
                        `⚠️ ESPN ${dateISO}: ${erreurESPN.message}`
                    );
                }
            }

            if (!prochainESPN) {

                return res.json({
                    succes: true,
                    message:
                        "Aucun prochain match trouvé",
                    match: null
                });
            }

            console.log(
                `🌍 ${configESPNHistorique.championnat} : ${prochainESPN.team1} vs ${prochainESPN.team2}`
            );

            const equipeHome =
                trouverEquipe(
                    prochainESPN.team1
                );

            const equipeAway =
                trouverEquipe(
                    prochainESPN.team2
                );

            console.log(
                "IDs historiques :",
                prochainESPN.team1,
                "=>",
                equipeHome?.id,
                "|",
                prochainESPN.team2,
                "=>",
                equipeAway?.id
            );

            if (
                !equipeHome ||
                !equipeAway
            ) {

                return res.status(500).json({
                    succes: false,
                    erreur:
                        "Impossible de trouver les IDs historiques des équipes",
                    equipes: {
                        domicile:
                            prochainESPN.team1,
                        exterieur:
                            prochainESPN.team2
                    }
                });
            }

            let pronosticESPN;

            try {

                pronosticESPN =
                    moteur.calculerPronostic(
                        historique,
                        equipeHome.id,
                        equipeAway.id
                    );

            } catch (erreurMoteur) {

                console.error(
                    "❌ Erreur moteur :",
                    erreurMoteur.message
                );

                return res.status(500).json({
                    succes: false,
                    erreur:
                        "Erreur lors du calcul du pronostic",
                    details:
                        erreurMoteur.message
                });
            }

            return res.json({

                succes: true,

                competition:
                    configESPNHistorique.championnat,

                match: {
                    id: prochainESPN.id,
                    date: prochainESPN.date,

                    domicile: {
                        nom:
                            prochainESPN.team1,
                        id:
                            equipeHome.id
                    },

                    exterieur: {
                        nom:
                            prochainESPN.team2,
                        id:
                            equipeAway.id
                    }
                },

                pronostic: {
                    prediction:
                        pronosticESPN.prediction,

                    confiance:
                        Number(
                            (
                                pronosticESPN.probabilite *
                                100
                            ).toFixed(2)
                        ),

                    probabilites: {
                        domicile:
                            Number(
                                (
                                    pronosticESPN.home *
                                    100
                                ).toFixed(2)
                            ),

                        nul:
                            Number(
                                (
                                    pronosticESPN.draw *
                                    100
                                ).toFixed(2)
                            ),

                        exterieur:
                            Number(
                                (
                                    pronosticESPN.away *
                                    100
                                ).toFixed(2)
                            )
                    },

                    scoreProbable:
                        pronosticESPN.scoreProbable,

                    over25:
                        Number(
                            (
                                pronosticESPN.over25 *
                                100
                            ).toFixed(2)
                        ),

                    btts:
                        Number(
                            (
                                pronosticESPN.btts *
                                100
                            ).toFixed(2)
                        )
                },

                historique: {
                    matchs:
                        historique.length
                }
            });
        }

        // ==========================================
        // 1. CALENDRIER 2026/27
        // ==========================================

        const calendrierUrl =
            "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/en.1.json";

        const calendrier =
            await axios.get(calendrierUrl);

        const matchsCalendrier =
            calendrier.data.matches || [];

        const maintenant = new Date();

        const prochains =
            matchsCalendrier
                .filter(match => {

                    if (!match.date) {
                        return false;
                    }

                    const team1 =
                        String(match.team1 || "")
                            .toLowerCase();

                    const team2 =
                        String(match.team2 || "")
                            .toLowerCase();

                    const recherche =
                        equipeRecherchee
                            .toLowerCase();

                    const dateMatch =
                        new Date(
                            `${match.date}T${match.time || "00:00"}:00`
                        );

                    return (
                        dateMatch >= maintenant &&
                        (
                            team1.includes(recherche) ||
                            team2.includes(recherche)
                        )
                    );

                })
                .sort((a, b) => {

                    const dateA =
                        new Date(
                            `${a.date}T${a.time || "00:00"}:00`
                        );

                    const dateB =
                        new Date(
                            `${b.date}T${b.time || "00:00"}:00`
                        );

                    return dateA - dateB;

                });

        if (!prochains.length) {

            return res.json({
                succes: true,
                message: "Aucun prochain match trouvé",
                match: null
            });

        }

        const prochain =
            prochains[0];

        // ==========================================
        // 2. RECHERCHE DES ÉQUIPES API-FOOTBALL
        // ==========================================

        async function rechercherEquipe(nom) {

            let recherche =
                String(nom || "")
                    .replace(/\bFC\b/gi, "")
                    .replace(/\bAFC\b/gi, "")
                    .trim();

            const alias = {

                "Chelsea": "Chelsea",
                "Bournemouth": "Bournemouth",
                "Manchester United": "Manchester United",
                "Manchester City": "Manchester City",
                "Liverpool": "Liverpool",
                "Arsenal": "Arsenal",
                "Tottenham Hotspur": "Tottenham",
                "Newcastle United": "Newcastle",
                "Brighton & Hove Albion": "Brighton",
                "Aston Villa": "Aston Villa",
                "Crystal Palace": "Crystal Palace",
                "Nottingham Forest": "Nottingham Forest",
                "Everton": "Everton",
                "Fulham": "Fulham",
                "Brentford": "Brentford",
                "West Ham United": "West Ham",
                "Wolverhampton Wanderers": "Wolverhampton",
                "Sunderland": "Sunderland",
                "Leeds United": "Leeds"
            };

            recherche =
                alias[recherche] || recherche;

            const resultat =
                await axios.get(
                    "https://v3.football.api-sports.io/teams",
                    {
                        params: {
                            search: recherche
                        },
                        headers: HEADERS,
                        timeout: 30000
                    }
                );

            const equipes =
                resultat.data.response || [];

            const equipePrincipale =
                equipes.find(item => {

                    const nomEquipe =
                        String(item.team.name || "");

                    return (
                        !/ W$/i.test(nomEquipe) &&
                        !/ U18$/i.test(nomEquipe) &&
                        !/ U19$/i.test(nomEquipe) &&
                        !/ U21$/i.test(nomEquipe) &&
                        !/ U23$/i.test(nomEquipe)
                    );

                });

            return equipePrincipale
                ? equipePrincipale.team
                : null;
        }

        const equipeDomicile =
            await rechercherEquipe(
                prochain.team1
            );

        const equipeExterieure =
            await rechercherEquipe(
                prochain.team2
            );

        if (
            !equipeDomicile ||
            !equipeExterieure
        ) {

            return res.status(404).json({
                succes: false,
                erreur:
                    "Impossible d'identifier une des deux équipes"
            });

        }

        // ==========================================
        // 3. DONNÉES HISTORIQUES

        console.log(
            "⏳ Chargement historique V25..."
        );

        const matchsHistoriques =
            await chargerHistoriqueComplet();

        console.log(
            `📊 Total historique V25 : ${matchsHistoriques.length} matchs`
        );

        // 4. MOTEUR V25
        // ==========================================

        const pronostic =
            moteur.calculerPronostic(
                matchsHistoriques,
                equipeDomicile.id,
                equipeExterieure.id
            );

        // ==========================================
        // 5. RÉPONSE
        // ==========================================

        res.json({

            succes: true,

            match: {

                round: prochain.round,

                date: prochain.date,

                heure:
                    prochain.time || null,

                domicile: {

                    nom: prochain.team1,

                    id: equipeDomicile.id,

                    logo: equipeDomicile.logo

                },

                exterieur: {

                    nom: prochain.team2,

                    id: equipeExterieure.id,

                    logo: equipeExterieure.logo

                }

            },

            pronostic: {

                prediction:
                    pronostic.prediction,

                confiance:
                    Number(
                        (
                            pronostic.probabilite *
                            100
                        ).toFixed(2)
                    ),

                probabilites: {

                    domicile:
                        Number(
                            (
                                pronostic.home *
                                100
                            ).toFixed(2)
                        ),

                    nul:
                        Number(
                            (
                                pronostic.draw *
                                100
                            ).toFixed(2)
                        ),

                    exterieur:
                        Number(
                            (
                                pronostic.away *
                                100
                            ).toFixed(2)
                        )

                },

                scoreProbable:
                    pronostic.scoreProbable,

                over25:
                    Number(
                        (
                            pronostic.over25 *
                            100
                        ).toFixed(2)
                    ),

                btts:
                    Number(
                        (
                            pronostic.btts *
                            100
                        ).toFixed(2)
                    ),

                butsAttendus: {

                    domicile:
                        Number(
                            pronostic.lambdaHome
                                .toFixed(2)
                        ),

                    exterieur:
                        Number(
                            pronostic.lambdaAway
                                .toFixed(2)
                        )

                }

            },
moteur: {
    version: "V25",
    saisonsHistoriques: [
        2022,
        2023,
        2024,
        "2025/26"
    ],
    matchsHistoriques:
        matchsHistoriques.length
    }
});
    }
    catch (error) {

        console.error(
            "❌ Erreur pronostic prochain :",
            error.response?.data ||
            error.message
        );

        res.status(500).json({

            succes: false,

            erreur:
                error.response?.data ||
                error.message

        });

    }

});

app.get("/api/competitions", (req, res) => {
    res.json(COMPETITIONS);
});

// ACCUEIL
// ==========================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});
// ==========================================
// SERVEUR
// ==========================================

// ==========================================
// ANALYSE D'UN MATCH DU CALENDRIER
// PREMIER LEAGUE
// ==========================================

app.get("/api/analyser-match", async (req, res) => {
    try {

        const home =
            String(req.query.home || "").trim();

        const away =
            String(req.query.away || "").trim();

        const competition =
            String(req.query.competition || "").trim();

        if (!home || !away) {
            return res.status(400).json({
                succes: false,
                erreur:
                    "Équipes domicile et extérieure manquantes."
            });
        }

        console.log(
            `🔮 Analyse V25 : ${home} vs ${away} | Compétition : ${competition}`
        );

        // 1. HISTORIQUE COMPLET
        const matchs =
            chargerHistoriqueDepuisCache(
                competition
            );

        // 2. RECHERCHE DES ÉQUIPES
        function normaliserNomEquipe(nom) {

            return String(nom || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\bfc\b/g, "")
                .replace(/\bafc\b/g, "")
                .replace(/\bstade\b/g, "")
                .replace(/\s+/g, " ")
                .trim();
        }

        const aliasEquipes = {
            "psg": "paris saint germain",
            "paris sg": "paris saint germain",
            "om": "marseille",
            "ol": "lyon",
            "asm": "monaco",
            "losc": "lille"
        };

        function trouverEquipe(nom) {

            const recherche =
                normaliserNomEquipe(nom);

            const rechercheFinale =
                aliasEquipes[recherche] ||
                recherche;

            return matchs.find(m =>
                normaliserNomEquipe(m.homeName) === rechercheFinale ||
                normaliserNomEquipe(m.awayName) === rechercheFinale
            );
        }

        const homeMatch =
            trouverEquipe(home);

        const awayMatch =
            trouverEquipe(away);

        if (!homeMatch || !awayMatch) {
            return res.status(404).json({
                succes: false,
                erreur:
                    "Impossible de trouver les équipes dans l'historique."
            });
        }

        const homeId =
            homeMatch.homeId === homeMatch.homeId
                ? (
                    String(homeMatch.homeName)
                        .toLowerCase()
                        .replace(/\bfc\b/g, "")
                        .replace(/\bafc\b/g, "")
                        .trim() ===
                    home
                        .toLowerCase()
                        .replace(/\bfc\b/g, "")
                        .replace(/\bafc\b/g, "")
                        .trim()
                    ? homeMatch.homeId
                    : homeMatch.awayId
                )
                : null;

        const awayId =
            awayMatch.homeName
                .toLowerCase()
                .replace(/\bfc\b/g, "")
                .replace(/\bafc\b/g, "")
                .trim() ===
            away
                .toLowerCase()
                .replace(/\bfc\b/g, "")
                .replace(/\bafc\b/g, "")
                .trim()
                ? awayMatch.homeId
                : awayMatch.awayId;

        if (!homeId || !awayId) {
            return res.status(404).json({
                succes: false,
                erreur:
                    "Impossible d'identifier les IDs des équipes."
            });
        }

        // 3. MOTEUR V25
        const pronostic =
            moteur.calculerPronostic(
                matchs,
                homeId,
                awayId
            );

        // 4. RÉPONSE
        res.json({
            succes: true,

            match: {
                domicile: home,
                exterieur: away
            },

            pronostic: {
                prediction:
                    pronostic.prediction,

                confiance:
                    Number(
                        (
                            pronostic.probabilite * 100
                        ).toFixed(2)
                    ),

                probabilites: {
                    domicile:
                        Number(
                            (
                                pronostic.home * 100
                            ).toFixed(2)
                        ),

                    nul:
                        Number(
                            (
                                pronostic.draw * 100
                            ).toFixed(2)
                        ),

                    exterieur:
                        Number(
                            (
                                pronostic.away * 100
                            ).toFixed(2)
                        )
                },

                scoreProbable:
                    pronostic.scoreProbable,

                over25:
                    Number(
                        (
                            pronostic.over25 * 100
                        ).toFixed(2)
                    ),

                btts:
                    Number(
                        (
                            pronostic.btts * 100
                        ).toFixed(2)
                    ),

                butsAttendus: {
                    domicile:
                        Number(
                            pronostic.lambdaHome
                                .toFixed(2)
                        ),

                    exterieur:
                        Number(
                            pronostic.lambdaAway
                                .toFixed(2)
                        )
                }
            },

            moteur: {
                version: "V25",
                matchsHistoriques:
                    matchs.length
            }
        });

    } catch (error) {

        console.error(
            "❌ Erreur analyse calendrier :",
            error.response?.data ||
            error.message
        );

        res.status(500).json({
            succes: false,
            erreur: error.message
        });
    }
});

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            `🚀 API lancée sur http://localhost:${PORT}`
        );

        console.log(
            `📊 Test : http://localhost:${PORT}/api/pronostic?home=Chelsea&away=Arsenal`
        );

        console.log("");
    }
);

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const competitions = {
    suede: "swe.1",
    norvege: "nor.1",
    roumanie: "rou.1"
};

const saisons = [2022, 2023, 2024];

const mois = {
    suede: {
        debut: "03-01",
        fin: "11-30"
    },
    norvege: {
        debut: "03-01",
        fin: "11-30"
    },
    roumanie: {
        debut: "07-01",
        fin: "12-31"
    }
};

function dormir(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function normaliser(event) {
    const c = event.competitions?.[0];
    const equipes = c?.competitors || [];

    const home = equipes.find(x => x.homeAway === "home");
    const away = equipes.find(x => x.homeAway === "away");

    if (!home || !away) return null;

    const hg = Number(home.score);
    const ag = Number(away.score);

    if (!Number.isFinite(hg) || !Number.isFinite(ag)) {
        return null;
    }

    return {
        id: event.id,
        date: event.date,

        homeId: `espn:${home.team?.id}`,
        awayId: `espn:${away.team?.id}`,

        homeName: home.team?.displayName,
        awayName: away.team?.displayName,

        homeGoals: hg,
        awayGoals: ag
    };
}

async function recupererJour(code, date) {
    const url =
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard`;

    try {
        const response = await axios.get(url, {
            params: {
                dates: formatDate(date)
            },
            timeout: 30000
        });

        return response.data.events || [];

    } catch (error) {
        console.log(
            "⚠️ Erreur",
            code,
            formatDate(date),
            error.response?.data || error.message
        );

        return [];
    }
}

async function recupererCompetition(nom, code) {
    console.log(`\n🏆 ${nom}`);

    const matchs = new Map();

    for (const saison of saisons) {

        const debut = new Date(
            `${saison}-${mois[nom].debut}T00:00:00Z`
        );

        const fin = new Date(
            `${saison}-${mois[nom].fin}T23:59:59Z`
        );

        console.log(
            `📅 Saison ${saison} :`,
            debut.toISOString().slice(0, 10),
            "→",
            fin.toISOString().slice(0, 10)
        );

        for (
            let date = new Date(debut);
            date <= fin;
            date.setUTCDate(date.getUTCDate() + 1)
        ) {

            const events = await recupererJour(code, date);

            for (const event of events) {
                const match = normaliser(event);

                if (match) {
                    matchs.set(match.id, match);
                }
            }

            if (events.length > 0) {
                console.log(
                    `  ${formatDate(date)} → ${events.length} événement(s)`
                );
            }

            await dormir(150);
        }

        console.log(
            `📊 Après ${saison} : ${matchs.size} matchs`
        );
    }

    const resultat = [...matchs.values()]
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const fichier = path.join(
        __dirname,
        "data",
        `${nom}.json`
    );

    if (resultat.length === 0) {
        console.log(
            `❌ Aucun match trouvé pour ${nom}. Fichier non modifié.`
        );
        return;
    }

    fs.writeFileSync(
        fichier,
        JSON.stringify(resultat, null, 2)
    );

    console.log(
        `💾 ${nom}.json → ${resultat.length} matchs`
    );
}

async function main() {
    for (const [nom, code] of Object.entries(competitions)) {
        await recupererCompetition(nom, code);
    }

    console.log("\n🎉 Récupération ESPN terminée.");
}

main();

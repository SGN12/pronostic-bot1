const axios = require("axios");
require("dotenv").config();

const API = "https://v3.football.api-sports.io/fixtures";
const LEAGUE = 39;
const SEASONS = [2022, 2023, 2024];

const HEADERS = {
    "x-apisports-key": process.env.API_FOOTBALL_KEY
};

// ==============================
// POISSON
// ==============================

function factorial(n) {
    if (n <= 1) return 1;

    let r = 1;

    for (let i = 2; i <= n; i++) {
        r *= i;
    }

    return r;
}

function poisson(k, lambda) {
    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorial(k)
    );
}

// ==============================
// PROBABILITÉS POISSON
// ==============================

function calculPoisson(lambda1, lambda2) {

    let p1 = 0;
    let pn = 0;
    let p2 = 0;

    for (let i = 0; i <= 8; i++) {

        for (let j = 0; j <= 8; j++) {

            const p =
                poisson(i, lambda1) *
                poisson(j, lambda2);

            if (i > j) {
                p1 += p;
            }
            else if (i === j) {
                pn += p;
            }
            else {
                p2 += p;
            }
        }
    }

    const total = p1 + pn + p2;

    return {
        p1: p1 / total,
        pn: pn / total,
        p2: p2 / total
    };
}

// ==============================
// STATISTIQUES HISTORIQUES
// ==============================

function statsEquipe(matches, teamId, date) {

    const anciens = matches.filter(m =>
        new Date(m.fixture.date) < date &&
        (
            m.teams.home.id === teamId ||
            m.teams.away.id === teamId
        )
    );

    if (anciens.length < 5) {
        return null;
    }

    let butsPour = 0;
    let butsContre = 0;

    let domicileJ = 0;
    let domicileBP = 0;
    let domicileBC = 0;

    let exterieurJ = 0;
    let exterieurBP = 0;
    let exterieurBC = 0;

    for (const m of anciens) {

        const domicile =
            m.teams.home.id === teamId;

        const bp = domicile
            ? m.goals.home
            : m.goals.away;

        const bc = domicile
            ? m.goals.away
            : m.goals.home;

        butsPour += bp;
        butsContre += bc;

        if (domicile) {

            domicileJ++;
            domicileBP += bp;
            domicileBC += bc;

        } else {

            exterieurJ++;
            exterieurBP += bp;
            exterieurBC += bc;
        }
    }

    // 5 derniers matchs
    const recent = anciens.slice(-5);

    let recentBP = 0;
    let recentBC = 0;

    for (const m of recent) {

        const domicile =
            m.teams.home.id === teamId;

        recentBP += domicile
            ? m.goals.home
            : m.goals.away;

        recentBC += domicile
            ? m.goals.away
            : m.goals.home;
    }

    return {

        matchs: anciens.length,

        attaque:
            butsPour / anciens.length,

        defense:
            butsContre / anciens.length,

        recentAttaque:
            recentBP / recent.length,

        recentDefense:
            recentBC / recent.length,

        domicileAttaque:
            domicileJ
                ? domicileBP / domicileJ
                : 0,

        domicileDefense:
            domicileJ
                ? domicileBC / domicileJ
                : 0,

        exterieurAttaque:
            exterieurJ
                ? exterieurBP / exterieurJ
                : 0,

        exterieurDefense:
            exterieurJ
                ? exterieurBC / exterieurJ
                : 0
    };
}

// ==============================
// CONSTRUCTION DU PRONOSTIC
// ==============================

function analyserMatch(match, matches) {

    const date =
        new Date(match.fixture.date);

    const homeId =
        match.teams.home.id;

    const awayId =
        match.teams.away.id;

    const home =
        statsEquipe(matches, homeId, date);

    const away =
        statsEquipe(matches, awayId, date);

    if (!home || !away) {
        return null;
    }

    // Modèle V19
    const wg = 0.30;
    const wr = 0.40;
    const wv = 0.30;

    const homeAttack =
        wg * home.attaque +
        wr * home.recentAttaque +
        wv * home.domicileAttaque;

    const homeDefense =
        wg * home.defense +
        wr * home.recentDefense +
        wv * home.domicileDefense;

    const awayAttack =
        wg * away.attaque +
        wr * away.recentAttaque +
        wv * away.exterieurAttaque;

    const awayDefense =
        wg * away.defense +
        wr * away.recentDefense +
        wv * away.exterieurDefense;

    let lambda1 =
        (homeAttack + awayDefense) / 2;

    let lambda2 =
        (awayAttack + homeDefense) / 2;

    // Avantage domicile V19
    lambda1 *= 1.20;

    const p =
        calculPoisson(lambda1, lambda2);

    let prediction;

    if (
        p.p1 >= p.pn &&
        p.p1 >= p.p2
    ) {
        prediction = "1";
    }
    else if (
        p.pn >= p.p1 &&
        p.pn >= p.p2
    ) {
        prediction = "N";
    }
    else {
        prediction = "2";
    }

    const reel =
        match.goals.home >
        match.goals.away
            ? "1"
            : match.goals.home <
              match.goals.away
                ? "2"
                : "N";

    return {
        prediction,
        reel,
        p1: p.p1,
        pn: p.pn,
        p2: p.p2,
        butsReels:
            match.goals.home +
            match.goals.away,
        butsAttendus:
            lambda1 + lambda2
    };
}

// ==============================
// BRIER SCORE
// ==============================

function calculBrier(resultats) {

    let total = 0;

    for (const r of resultats) {

        let y1 = r.reel === "1" ? 1 : 0;
        let yn = r.reel === "N" ? 1 : 0;
        let y2 = r.reel === "2" ? 1 : 0;

        total +=
            Math.pow(r.p1 - y1, 2) +
            Math.pow(r.pn - yn, 2) +
            Math.pow(r.p2 - y2, 2);
    }

    return total / resultats.length;
}

// ==============================
// LOG LOSS
// ==============================

function calculLogLoss(resultats) {

    let total = 0;

    for (const r of resultats) {

        let p;

        if (r.reel === "1") {
            p = r.p1;
        }
        else if (r.reel === "N") {
            p = r.pn;
        }
        else {
            p = r.p2;
        }

        // éviter log(0)
        p = Math.max(p, 0.000001);

        total += -Math.log(p);
    }

    return total / resultats.length;
}

// ==============================
// ÉVALUATION
// ==============================

function evaluer(resultats) {

    let correct = 0;

    let correct1 = 0;
    let correctN = 0;
    let correct2 = 0;

    let pronos1 = 0;
    let pronosN = 0;
    let pronos2 = 0;

    let erreurButs = 0;

    for (const r of resultats) {

        if (r.prediction === r.reel) {

            correct++;

            if (r.reel === "1")
                correct1++;

            if (r.reel === "N")
                correctN++;

            if (r.reel === "2")
                correct2++;
        }

        if (r.prediction === "1")
            pronos1++;

        if (r.prediction === "N")
            pronosN++;

        if (r.prediction === "2")
            pronos2++;

        erreurButs +=
            Math.abs(
                r.butsAttendus -
                r.butsReels
            );
    }

    return {

        matchs: resultats.length,

        precision:
            correct / resultats.length * 100,

        correct1,
        correctN,
        correct2,

        pronos1,
        pronosN,
        pronos2,

        erreurButs:
            erreurButs /
            resultats.length,

        brier:
            calculBrier(resultats),

        logLoss:
            calculLogLoss(resultats)
    };
}

// ==============================
// AFFICHAGE
// ==============================

function afficherStats(nom, stats) {

    console.log(`\n${nom}`);
    console.log("------------------------------");

    console.log(
        `Matchs : ${stats.matchs}`
    );

    console.log(
        `Précision : ${stats.precision.toFixed(2)}%`
    );

    console.log(
        `Correct domicile : ${stats.correct1}`
    );

    console.log(
        `Correct nuls : ${stats.correctN}`
    );

    console.log(
        `Correct extérieur : ${stats.correct2}`
    );

    console.log(
        `Pronos domicile : ${stats.pronos1}`
    );

    console.log(
        `Pronos nuls : ${stats.pronosN}`
    );

    console.log(
        `Pronos extérieur : ${stats.pronos2}`
    );

    console.log(
        `Erreur moyenne buts : ${stats.erreurButs.toFixed(3)}`
    );

    console.log(
        `Brier : ${stats.brier.toFixed(4)}`
    );

    console.log(
        `Log Loss : ${stats.logLoss.toFixed(4)}`
    );
}

// ==============================
// TRAITEMENT D'UNE SAISON
// ==============================

async function analyserSaison(season) {

    console.log("\n");
    console.log("======================================");
    console.log(`🏆 SAISON ${season}`);
    console.log("======================================");

    const response =
        await axios.get(API, {
            params: {
                league: LEAGUE,
                season,
                status: "FT"
            },
            headers: HEADERS
        });

    const matches =
        response.data.response
            .filter(m =>
                m.fixture.status.short === "FT"
            )
            .sort(
                (a, b) =>
                    new Date(a.fixture.date) -
                    new Date(b.fixture.date)
            );

    console.log(
        `Matchs API : ${matches.length}`
    );

    const resultats = [];

    for (let i = 0; i < matches.length; i++) {

        const resultat =
            analyserMatch(
                matches[i],
                matches
            );

        if (resultat) {

            resultats.push(resultat);
        }
    }

    console.log(
        `Matchs analysés : ${resultats.length}`
    );

    // Séparation chronologique 70/30
    const limite =
        Math.floor(
            resultats.length * 0.70
        );

    const train =
        resultats.slice(0, limite);

    const test =
        resultats.slice(limite);

    console.log(
        `Train : ${train.length}`
    );

    console.log(
        `Test : ${test.length}`
    );

    afficherStats(
        `SAISON ${season} - GLOBAL`,
        evaluer(resultats)
    );

    afficherStats(
        `SAISON ${season} - TEST 30%`,
        evaluer(test)
    );

    return resultats;
}

// ==============================
// MAIN
// ==============================

async function main() {

    console.log("🤖 V23 - BACKTEST MULTI-SAISONS");
    console.log("======================================");

    console.log(
        "Modèle testé : V19 / Poisson Base"
    );

    console.log(
        "Saisons : 2022, 2023, 2024"
    );

    console.log(
        "⚠️ Aucun match futur n'est utilisé."
    );

    const tousLesResultats = [];

    for (const season of SEASONS) {

        try {

            const resultats =
                await analyserSaison(season);

            tousLesResultats.push(
                ...resultats
            );

        } catch (error) {

            console.log(
                `❌ Erreur saison ${season}`
            );

            console.log(
                error.response?.data ||
                error.message
            );
        }
    }

    console.log("\n");
    console.log("======================================");
    console.log("🌍 RÉSULTAT GLOBAL");
    console.log("======================================");

    afficherStats(
        "2022 + 2023 + 2024",
        evaluer(tousLesResultats)
    );

    console.log("\n🏁 FIN V23");
}

main().catch(error => {

    console.error(
        "❌ ERREUR FATALE :",
        error.response?.data ||
        error.message
    );

});

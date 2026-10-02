require("dotenv").config();

const MAX_GOALS = 7;

function factorielle(n) {
    let resultat = 1;

    for (let i = 2; i <= n; i++) {
        resultat *= i;
    }

    return resultat;
}

function poisson(k, lambda) {
    return (
        Math.exp(-lambda) *
        Math.pow(lambda, k) /
        factorielle(k)
    );
}

function probabilitesScores(lambda1, lambda2) {

    let victoire1 = 0;
    let nul = 0;
    let victoire2 = 0;

    let over25 = 0;
    let btts = 0;

    let meilleurScore = "0-0";
    let meilleureProbabilite = 0;

    for (let buts1 = 0; buts1 <= MAX_GOALS; buts1++) {

        const p1 = poisson(buts1, lambda1);

        for (let buts2 = 0; buts2 <= MAX_GOALS; buts2++) {

            const p2 = poisson(buts2, lambda2);

            const probabilite = p1 * p2;

            if (buts1 > buts2) {
                victoire1 += probabilite;
            }
            else if (buts1 === buts2) {
                nul += probabilite;
            }
            else {
                victoire2 += probabilite;
            }

            if (buts1 + buts2 >= 3) {
                over25 += probabilite;
            }

            if (buts1 > 0 && buts2 > 0) {
                btts += probabilite;
            }

            if (probabilite > meilleureProbabilite) {

                meilleureProbabilite =
                    probabilite;

                meilleurScore =
                    `${buts1}-${buts2}`;
            }
        }
    }

    return {
        victoire1,
        nul,
        victoire2,
        over25,
        btts,
        meilleurScore,
        meilleureProbabilite
    };
}

function pronostiquerPoisson(
    attaque1,
    defense1,
    attaque2,
    defense2
) {

    let lambda1 =
        (attaque1 + defense2) / 2;

    let lambda2 =
        (attaque2 + defense1) / 2;

    lambda1 =
        Math.max(0.15, lambda1);

    lambda2 =
        Math.max(0.15, lambda2);

    const resultat =
        probabilitesScores(
            lambda1,
            lambda2
        );

    return {
        butsAttendus1: lambda1,
        butsAttendus2: lambda2,
        ...resultat
    };
}

function afficherResultat(resultat) {

    console.log("");
    console.log("🤖 MOTEUR V6 - POISSON");
    console.log("==============================");

    console.log("");

    console.log(
        "Buts attendus équipe 1 :",
        resultat.butsAttendus1.toFixed(2)
    );

    console.log(
        "Buts attendus équipe 2 :",
        resultat.butsAttendus2.toFixed(2)
    );

    console.log("");

    console.log(
        "Victoire équipe 1 :",
        (resultat.victoire1 * 100).toFixed(2) + "%"
    );

    console.log(
        "Match nul :",
        (resultat.nul * 100).toFixed(2) + "%"
    );

    console.log(
        "Victoire équipe 2 :",
        (resultat.victoire2 * 100).toFixed(2) + "%"
    );

    console.log("");

    console.log(
        "Over 2.5 :",
        (resultat.over25 * 100).toFixed(2) + "%"
    );

    console.log(
        "BTTS :",
        (resultat.btts * 100).toFixed(2) + "%"
    );

    console.log("");

    console.log(
        "Score le plus probable :",
        resultat.meilleurScore
    );

    console.log(
        "Probabilité du score :",
        (resultat.meilleureProbabilite * 100)
            .toFixed(2) + "%"
    );
}

const test =
    pronostiquerPoisson(
        1.20,
        1.00,
        1.50,
        1.10
    );

afficherResultat(test);

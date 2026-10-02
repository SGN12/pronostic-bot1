function analyser(stats1, stats2) {

    const force1 =
        stats1.butsMarques * 0.4 +
        stats1.forme * 0.3 +
        stats1.domicile * 0.3;

    const force2 =
        stats2.butsMarques * 0.4 +
        stats2.forme * 0.3 +
        stats2.exterieur * 0.3;

    const total = force1 + force2;

    const victoire1 = Math.round((force1 / total) * 100);
    const victoire2 = Math.round((force2 / total) * 100);

    const nul = 100 - victoire1 - victoire2;

    const moyenneButs =
        (stats1.butsMarques +
         stats2.butsMarques +
         stats1.butsEncaisses +
         stats2.butsEncaisses) / 2;

    const plus25 = moyenneButs >= 2.5 ? 62 : 42;

    const btts =
        stats1.butsMarques >= 1 &&
        stats2.butsMarques >= 1
            ? 64
            : 38;

    return {
        victoire1,
        nul,
        victoire2,
        plus25,
        btts
    };
}

module.exports = analyser;

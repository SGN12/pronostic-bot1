async function analyserMatch() {

    const equipe1 =
        document.getElementById("equipe1").value.trim();

    const equipe2 =
        document.getElementById("equipe2").value.trim();

    const resultat =
        document.getElementById("resultat");

    if (!equipe1 || !equipe2) {

        resultat.innerHTML = `
            <h2>⚠️ Attention</h2>
            <p>Entre les deux équipes.</p>
        `;

        return;
    }

    resultat.innerHTML = `
        <h2>⏳ Analyse en cours...</h2>
        <p>Le bot récupère les données et calcule les statistiques.</p>
    `;

    try {

        const response = await fetch(
            "/api/analyser",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    equipe1,
                    equipe2
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.erreur || "Erreur pendant l'analyse."
            );
        }


        resultat.innerHTML = `

            <h2>📊 Analyse du match</h2>

            <h3>
                ${data.equipe1}
                🆚
                ${data.equipe2}
            </h3>

            <div class="analyse-bloc">

                <h3>🔥 Forme récente</h3>

                <p>
                    ${data.equipe1} :
                    <strong>${data.forme1}</strong>
                </p>

                <p>
                    ${data.equipe2} :
                    <strong>${data.forme2}</strong>
                </p>

            </div>


            <div class="analyse-bloc">

                <h3>🎯 Résultat statistique</h3>

                <p>
                    🏠 ${data.equipe1} :
                    <strong>${data.victoire1}%</strong>
                </p>

                <p>
                    🤝 Match nul :
                    <strong>${data.nul}%</strong>
                </p>

                <p>
                    ✈️ ${data.equipe2} :
                    <strong>${data.victoire2}%</strong>
                </p>

            </div>


            <div class="analyse-bloc">

                <h3>⚽ Marchés statistiques</h3>

                <p>
                    📈 Over 2.5 :
                    <strong>${data.over25}%</strong>
                </p>

                <p>
                    🎯 BTTS :
                    <strong>${data.btts}%</strong>
                </p>

            </div>


            <div class="analyse-bloc">

                <h3>🧮 Buts attendus</h3>

                <p>
                    ${data.equipe1} :
                    <strong>${data.buts1}</strong>
                </p>

                <p>
                    ${data.equipe2} :
                    <strong>${data.buts2}</strong>
                </p>

                <p>
                    Total :
                    <strong>${data.butsAttendus}</strong>
                </p>

            </div>


            <div class="score">

                <h3>🎯 Score statistique</h3>

                <div>
                    ${data.score}
                </div>

            </div>


            <p class="avertissement">
                ⚠️ ${data.avertissement}
            </p>

        `;

    } catch (error) {

        resultat.innerHTML = `

            <h2>❌ Erreur</h2>

            <p>${error.message}</p>

        `;
    }
}
// ==========================================
// 🔮 PROCHAIN MATCH + PRONOSTIC V25
// ==========================================

async function analyserProchainMatch(nomEquipe) {
    try {
        const resultat = await fetch(
            `/api/pronostic-prochain?team=${encodeURIComponent(nomEquipe)}`
        );

        const data = await resultat.json();

        if (!data.succes) {
            alert(data.erreur || "Impossible d'analyser le prochain match.");
            return;
        }

        afficherProchainMatch(data);

    } catch (error) {
        console.error("Erreur prochain match :", error);
        alert("Erreur de connexion au serveur.");
    }
}

function afficherProchainMatch(data) {
    const match = data.match;
    const p = data.pronostic;

    let bloc = document.getElementById("prochain-match");

    if (!bloc) {
        bloc = document.createElement("div");
        bloc.id = "prochain-match";

        document.body.appendChild(bloc);
    }

    bloc.innerHTML = `
        <div class="prochain-card">

            <div class="prochain-titre">
                🔮 PROCHAIN MATCH
            </div>

            <div class="prochain-date">
                ${match.round || ""}
                <br>
                📅 ${match.date} — ${match.heure || ""}
            </div>

            <div class="equipes-prochaines">

                <div class="equipe-prochaine">
                    <img src="${match.domicile.logo}" alt="">
                    <strong>${match.domicile.nom}</strong>
                </div>

                <div class="vs-prochain">
                    VS
                </div>

                <div class="equipe-prochaine">
                    <img src="${match.exterieur.logo}" alt="">
                    <strong>${match.exterieur.nom}</strong>
                </div>

            </div>

            <div class="prediction-principale">
                🎯 Pronostic : <strong>${p.prediction}</strong>
            </div>

            <div class="probabilites">

                <div>
                    🏠 ${p.probabilites.domicile}%
                    <span>Domicile</span>
                </div>

                <div>
                    🤝 ${p.probabilites.nul}%
                    <span>Nul</span>
                </div>

                <div>
                    ✈️ ${p.probabilites.exterieur}%
                    <span>Extérieur</span>
                </div>

            </div>

            <div class="stats-pronostic">

                <div>
                    🎯 Confiance
                    <strong>${p.confiance}%</strong>
                </div>

                <div>
                    ⚽ Score
                    <strong>${p.scoreProbable}</strong>
                </div>

                <div>
                    📈 Over 2.5
                    <strong>${p.over25}%</strong>
                </div>

                <div>
                    🔄 BTTS
                    <strong>${p.btts}%</strong>
                </div>

            </div>

            <div class="buts-attendus">
                ⚽ Buts attendus :
                <strong>
                    ${p.butsAttendus.domicile}
                    -
                    ${p.butsAttendus.exterieur}
                </strong>
            </div>

            <div class="version-moteur">
                Moteur ${data.moteur.version}
                · Historique ${data.moteur.saisonsHistoriques.join(" / ")}
            </div>

        </div>
    `;
}

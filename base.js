document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
      apiKey: "AIzaSyB5XMrJtKg-EzP3Tea3-yllj-NZEoDXJlY",
      authDomain: "proyecto-genesis-f2425.firebaseapp.com",
      projectId: "proyecto-genesis-f2425",
      storageBucket: "proyecto-genesis-f2425.appspot.com",
      messagingSenderId: "724952032149",
      appId: "1:724952032149:web:38ac600d150c3e979f4c9c"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    const BASE_CONFIG = { UPGRADES: { Defenses: { name: "Torretas de Defensa", cost: 1000 }, Attacks: { name: "Flota de Ataque", cost: 1000 } } };
    
    let gameState = {};
    let currentUser = null;
    const moneyCountEl = document.getElementById('money-count'), upgradesListEl = document.getElementById('base-upgrades-list'), attackPlayerBtn = document.getElementById('attack-player-btn'), attackModal = document.getElementById('attack-modal'), playerListContainer = document.getElementById('player-list-container'), attackLogEl = document.getElementById('attack-log'), loadingOverlay = document.getElementById('loading-overlay'), allianceInfoContainer = document.getElementById('alliance-info-container');

    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        upgradesListEl.innerHTML = Object.entries(BASE_CONFIG.UPGRADES).map(([key, upgrade]) => { const level = gameState.baseLevels ? (gameState.baseLevels[key] || 0) : 0; const cost = Math.ceil(upgrade.cost * Math.pow(1.5, level)); return `<div class="upgrade-line"><span>${upgrade.name} (Nvl ${level})</span><button onclick="buyBaseUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled':''}">Coste: ${cost.toLocaleString()}</button></div>`; }).join('');
        renderAllianceUI();
    }
    
    function renderAllianceUI() {
        if (gameState.alliance) {
            allianceInfoContainer.innerHTML = `<h3>Alianza: ${gameState.alliance}</h3><ul id="alliance-members-list" class="alliance-members">Cargando miembros...</ul><button onclick="leaveAlliance()" class="action-btn">Abandonar Alianza</button>`;
            loadAllianceMembers();
        } else {
            allianceInfoContainer.innerHTML = `<p>No perteneces a ninguna alianza.</p><div class="alliance-actions"><button onclick="createAlliance()" class="action-btn">Crear Alianza</button><button onclick="joinAlliance()" class="action-btn">Unirse a Alianza</button></div>`;
        }
    }

    async function loadAllianceMembers() {
        const listEl = document.getElementById('alliance-members-list');
        if (!listEl) return;
        const allianceDoc = await db.collection('alliances').doc(gameState.alliance).get();
        if (allianceDoc.exists) {
            const members = allianceDoc.data().members || [];
            listEl.innerHTML = members.map(member => `<li>${member.name} ${member.id === currentUser.uid ? '(Tú)' : ''}</li>`).join('');
        }
    }

    window.createAlliance = () => { const name = prompt("Nombre para tu nueva alianza:"); if (name) { db.collection('alliances').doc(name).set({ leader: currentUser.uid, members: [{ id: currentUser.uid, name: currentUser.displayName }] }).then(() => { db.collection('players').doc(currentUser.uid).update({ alliance: name }); }); } };
    window.joinAlliance = () => { const name = prompt("Nombre de la alianza a la que quieres unirte:"); if (name) { db.collection('alliances').doc(name).update({ members: firebase.firestore.FieldValue.arrayUnion({ id: currentUser.uid, name: currentUser.displayName }) }).then(() => { db.collection('players').doc(currentUser.uid).update({ alliance: name }); }); } };
    window.leaveAlliance = async () => { if (confirm("¿Seguro que quieres abandonar tu alianza?")) { const allianceName = gameState.alliance; await db.collection('players').doc(currentUser.uid).update({ alliance: null }); const allianceRef = db.collection('alliances').doc(allianceName); await allianceRef.update({ members: firebase.firestore.FieldValue.arrayRemove({ id: currentUser.uid, name: currentUser.displayName }) }); } };

    window.buyBaseUpgrade = (key) => { if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 }; const level = gameState.baseLevels[key] || 0; const cost = Math.ceil(BASE_CONFIG.UPGRADES[key].cost * Math.pow(1.5, level)); if (gameState.money >= cost) { gameState.money -= cost; gameState.baseLevels[key] = level + 1; db.collection('players').doc(auth.currentUser.uid).set({ baseLevels: gameState.baseLevels, money: gameState.money }, { merge: true }); } };
    attackPlayerBtn.addEventListener('click', async () => { /* ... (código sin cambios) ... */ });
    attackModal.querySelector('.close-btn').addEventListener('click', () => attackModal.classList.add('hidden'));

    window.attackPlayer = async (targetId, targetName) => {
        if (!confirm(`¿Confirmar ataque al piloto ${targetName}?`)) return;
        attackModal.classList.add('hidden');
        attackLogEl.innerHTML = `<div class="log-item">Lanzando ataque contra ${targetName}...</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
        
        try {
            const attackerRef = db.collection('players').doc(currentUser.uid);
            const defenderRef = db.collection('players').doc(targetId);
            const [attackerDoc, defenderDoc] = await Promise.all([attackerRef.get(), defenderRef.get()]);

            if (!attackerDoc.exists || !defenderDoc.exists) throw new Error("El objetivo ya no existe.");
            
            const attackerData = attackerDoc.data();
            const defenderData = defenderDoc.data();

            if (attackerData.alliance && attackerData.alliance === defenderData.alliance) {
                attackLogEl.innerHTML = `<div class="log-item loss">No puedes atacar a un miembro de tu propia alianza.</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
                return;
            }

            const attackerPower = (attackerData.baseLevels && attackerData.baseLevels.Attacks) || 0;
            const defenderPower = (defenderData.baseLevels && defenderData.baseLevels.Defenses) || 0;

            const attackRoll = attackerPower * (Math.random() * 0.4 + 0.8);
            const defenseRoll = defenderPower * (Math.random() * 0.4 + 0.8);

            const notification = { id: `notif_${Date.now()}`, read: false, timestamp: new Date().toISOString() };

            if (attackRoll > defenseRoll) {
                const maxLoot = defenderData.money * 0.10;
                const loot = Math.floor(Math.random() * maxLoot);
                await attackerRef.update({ money: firebase.firestore.FieldValue.increment(loot) });
                await defenderRef.update({ money: firebase.firestore.FieldValue.increment(-loot), notifications: firebase.firestore.FieldValue.arrayUnion({ ...notification, type: 'defense_loss', message: `¡Fuiste atacado por ${currentUser.displayName}! Perdiste $${loot.toLocaleString()} créditos.` }) });
                attackLogEl.innerHTML = `<div class="log-item win">¡Victoria! Has saqueado $${loot.toLocaleString()} de ${targetName}.</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
            } else {
                await defenderRef.update({ notifications: firebase.firestore.FieldValue.arrayUnion({ ...notification, type: 'defense_win', message: `¡Repeliste un ataque de ${currentUser.displayName}!` }) });
                attackLogEl.innerHTML = `<div class="log-item loss">¡Derrota! Las defensas de ${targetName} eran muy fuertes.</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
            }
        } catch (error) {
            console.error("Error en el ataque:", error);
            attackLogEl.innerHTML = `<div class="log-item loss">Error: ${error.message}</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
        }
    };
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('players').doc(user.uid).onSnapshot((doc) => {
                loadingOverlay.classList.add('hidden');
                if (doc.exists) {
                    gameState = doc.data();
                    if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 };
                    if (!gameState.notifications) gameState.notifications = [];
                    const unreadNotifications = gameState.notifications.filter(n => !n.read);
                    if (unreadNotifications.length > 0) {
                        unreadNotifications.forEach(n => {
                            alert(`NUEVO REPORTE DE COMBATE:\n\n${n.message}`);
                            const notifIndex = gameState.notifications.findIndex(item => item.id === n.id);
                            if (notifIndex > -1) { gameState.notifications[notifIndex].read = true; }
                        });
                        db.collection('players').doc(user.uid).update({ notifications: gameState.notifications });
                    }
                    updateUI();
                } else {
                    gameState = { money: 0, baseLevels: { Defenses: 0, Attacks: 0 }, notifications: [] };
                    updateUI();
                }
            }, (error) => {
                console.error("Error al cargar datos del jugador: ", error);
                loadingOverlay.classList.add('hidden');
            });
        } else {
            window.location.href = 'menu.html';
        }
    });
});
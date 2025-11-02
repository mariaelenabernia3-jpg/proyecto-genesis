document.addEventListener('DOMContentLoaded', () => {

    // TU CONFIGURACIÓN DE FIREBASE YA INTEGRADA
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
    
    // --- CONEXIÓN AL EMULADOR LOCAL ---
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        console.log("BASE: MODO DE PRUEBA LOCAL DETECTADO. CONECTANDO A EMULADORES...");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    // --- CONFIGURACIÓN Y SELECTORES ---
    const BASE_CONFIG = {
        UPGRADES: {
            Defenses: { name: "Torretas de Defensa", cost: 1000 },
            Attacks: { name: "Flota de Ataque", cost: 1000 }
        }
    };
    
    let gameState = {};
    let currentUser = null;
    const moneyCountEl = document.getElementById('money-count');
    const upgradesListEl = document.getElementById('base-upgrades-list');
    const attackPlayerBtn = document.getElementById('attack-player-btn');
    const attackModal = document.getElementById('attack-modal');
    const playerListContainer = document.getElementById('player-list-container');
    const attackLogEl = document.getElementById('attack-log');
    const loadingOverlay = document.getElementById('loading-overlay');
    const allianceInfoContainer = document.getElementById('alliance-info-container');

    // --- LÓGICA DE LA INTERFAZ ---
    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        upgradesListEl.innerHTML = Object.entries(BASE_CONFIG.UPGRADES).map(([key, upgrade]) => {
            const level = gameState.baseLevels ? (gameState.baseLevels[key] || 0) : 0;
            const cost = Math.ceil(upgrade.cost * Math.pow(1.5, level));
            return `<div class="upgrade-line"><span>${upgrade.name} (Nvl ${level})</span><button onclick="buyBaseUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled':''}">Coste: ${cost.toLocaleString()}</button></div>`;
        }).join('');
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
        if (!listEl || !gameState.alliance) return;
        try {
            const allianceDoc = await db.collection('alliances').doc(gameState.alliance).get();
            if (allianceDoc.exists) {
                const members = allianceDoc.data().members || [];
                listEl.innerHTML = members.map(member => `<li>${member.name} ${member.id === currentUser.uid ? '(Tú)' : ''}</li>`).join('');
            }
        } catch (error) {
            console.error("Error cargando miembros de alianza:", error);
            listEl.innerHTML = "<li>Error al cargar miembros.</li>";
        }
    }

    // --- ACCIONES DEL JUGADOR ---
    window.buyBaseUpgrade = (key) => {
        if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 };
        const level = gameState.baseLevels[key] || 0;
        const cost = Math.ceil(BASE_CONFIG.UPGRADES[key].cost * Math.pow(1.5, level));
        if (gameState.money >= cost) {
            db.collection('players').doc(auth.currentUser.uid).update({
                [`baseLevels.${key}`]: firebase.firestore.FieldValue.increment(1),
                money: firebase.firestore.FieldValue.increment(-cost)
            });
        }
    };

    attackPlayerBtn.addEventListener('click', async () => {
        attackModal.classList.remove('hidden');
        playerListContainer.innerHTML = "<p>Buscando pilotos...</p>";
        try {
            const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(20).get();
            const players = [];
            snapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) {
                    players.push({ id: doc.id, ...doc.data() });
                }
            });
            playerListContainer.innerHTML = players.map(p => `<div class="player-list-item"><span>${p.playerName} (Fortuna: $${p.money.toLocaleString()})</span><button onclick="attackPlayer('${p.id}', '${p.playerName}')">Atacar</button></div>`).join('') || "<p>No se encontraron otros pilotos.</p>";
        } catch(error) {
            console.error("Error al buscar jugadores:", error);
            playerListContainer.innerHTML = "<p>Error al contactar con la red de pilotos.</p>";
        }
    });
    
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

            if (attackerData.alliance && defenderData.alliance && attackerData.alliance === defenderData.alliance) {
                attackLogEl.innerHTML = `<div class="log-item loss">No puedes atacar a un miembro de tu propia alianza.</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
                return;
            }

            const attackerPower = (attackerData.baseLevels && attackerData.baseLevels.Attacks) || 0;
            const defenderPower = (defenderData.baseLevels && defenderData.baseLevels.Defenses) || 0;

            const attackRoll = attackerPower * (Math.random() * 0.4 + 0.8);
            const defenseRoll = defenderPower * (Math.random() * 0.4 + 0.8);

            const notification = { id: `notif_${Date.now()}`, read: false, timestamp: new Date().toISOString() };

            if (attackRoll > defenseRoll) {
                // --- CAMBIO INICIA: LÓGICA DE BOTÍN MEJORADA ---
                const powerRatio = defenseRoll > 0 ? attackRoll / defenseRoll : 5; // Si el defensor no tiene defensa, el ratio es alto.
                
                // El botín base es 2% y aumenta con el ratio de poder, con un máximo de 15%.
                let lootPercentage = 0.02 + ((powerRatio - 1) * 0.01);
                lootPercentage = Math.min(0.15, lootPercentage); // Se asegura que el máximo sea 15%
                
                const loot = Math.floor(defenderData.money * lootPercentage);
                // --- CAMBIO TERMINA ---
                
                const PVP_LEGENDARY_CHANCE = 1 / 1000;
                let newModule = null;
                if (Math.random() < PVP_LEGENDARY_CHANCE) {
                    const droneSchematic = { id: 'l05', name: 'Esquema de Dron de Combate', description: 'Desbloquea la capacidad de construir drones de ataque en tu base.', rarity: 'legendary', effect: { type: 'unlock_pvp_unit' } };
                    if (!(attackerData.modules || []).some(m => m.id === 'l05')) {
                         newModule = { ...droneSchematic, id: `mod_${Date.now()}` };
                         alert("¡VICTORIA CRÍTICA!\n\nHas recuperado un 'Esquema de Dron de Combate'.");
                    }
                }
                
                const attackerUpdate = { money: firebase.firestore.FieldValue.increment(loot) };
                if (newModule) {
                    attackerUpdate.modules = firebase.firestore.FieldValue.arrayUnion(newModule);
                }

                await attackerRef.update(attackerUpdate);
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
    
    window.createAlliance = async () => {
        if (gameState.alliance) { alert("Ya perteneces a una alianza."); return; }
        const name = prompt("Nombre para tu nueva alianza (3-15 caracteres):");
        if (name && name.trim().length >= 3 && name.trim().length <= 15) {
            const allianceName = name.trim();
            const allianceRef = db.collection('alliances').doc(allianceName);
            const doc = await allianceRef.get();
            if (doc.exists) { alert("Una alianza con este nombre ya existe."); return; }
            await allianceRef.set({ leader: currentUser.uid, members: [{ id: currentUser.uid, name: currentUser.displayName }] });
            await db.collection('players').doc(currentUser.uid).update({ alliance: allianceName });
        } else {
            alert("El nombre de la alianza es inválido.");
        }
    };

    window.joinAlliance = async () => {
        if (gameState.alliance) { alert("Ya perteneces a una alianza."); return; }
        const name = prompt("Nombre de la alianza a la que quieres unirte:");
        if (name) {
            const allianceRef = db.collection('alliances').doc(name);
            const doc = await allianceRef.get();
            if (!doc.exists) { alert("Esa alianza no existe."); return; }
            await allianceRef.update({ members: firebase.firestore.FieldValue.arrayUnion({ id: currentUser.uid, name: currentUser.displayName }) });
            await db.collection('players').doc(currentUser.uid).update({ alliance: name });
        }
    };
    
    window.leaveAlliance = async () => {
        if (!gameState.alliance || !confirm("¿Seguro que quieres abandonar tu alianza?")) return;
        const allianceName = gameState.alliance;
        await db.collection('players').doc(currentUser.uid).update({ alliance: null });
        const allianceRef = db.collection('alliances').doc(allianceName);
        await allianceRef.update({ members: firebase.firestore.FieldValue.arrayRemove({ id: currentUser.uid, name: currentUser.displayName }) });
    };
    
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('players').doc(user.uid).onSnapshot((doc) => {
                if (doc.exists) {
                    gameState = doc.data();
                } else {
                    gameState = { money: 0, baseLevels: { Defenses: 0, Attacks: 0 }, notifications: [], alliance: null };
                }
                
                if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 };
                if (!gameState.notifications) gameState.notifications = [];
                
                const unreadNotifications = gameState.notifications.filter(n => !n.read);
                if (unreadNotifications.length > 0) {
                    let notificationMessages = "NUEVOS REPORTES DE COMBATE:\n\n";
                    unreadNotifications.forEach(n => {
                        notificationMessages += `- ${n.message}\n`;
                        const notifIndex = gameState.notifications.findIndex(item => item.id === n.id);
                        if (notifIndex > -1) { gameState.notifications[notifIndex].read = true; }
                    });
                    alert(notificationMessages);
                    db.collection('players').doc(user.uid).update({ notifications: gameState.notifications });
                }
                
                updateUI();
                loadingOverlay.classList.add('hidden');
            }, (error) => {
                console.error("Error al cargar datos del jugador: ", error);
                loadingOverlay.classList.add('hidden');
            });
        } else {
            window.location.href = 'menu.html';
        }
    });
});
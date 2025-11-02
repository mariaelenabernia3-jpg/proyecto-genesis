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
        console.log("BASE: MODO DE PRUEBA LOCAL DETECTADO. CONECTANDO A EMULADORES...");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    // ===== CONFIGURACIÓN DE UNIDADES DE COMBATE =====
    const BASE_CONFIG = {
        DEFENSES: { cost: 1000, power: 10 },
        UNITS: {
            Fighters: { name: "Cazas", cost: 500, power: 5, strongAgainst: 'Bombers' },
            Bombers: { name: "Bombarderos", cost: 1500, power: 2, strongAgainst: 'Defenses' },
            Frigates: { name: "Fragatas", cost: 3000, power: 12, strongAgainst: 'Fighters' }
        }
    };
    
    let gameState = {};
    let currentUser = null;
    let allPlayers = [];
    let allianceChatUnsubscribe = null;
    const moneyCountEl = document.getElementById('money-count');
    const baseManagementListEl = document.getElementById('base-management-list');
    const attackPlayerBtn = document.getElementById('attack-player-btn');
    const attackModal = document.getElementById('attack-modal');
    const playerListContainer = document.getElementById('player-list-container');
    const battleReportsEl = document.getElementById('battle-reports-list');
    const loadingOverlay = document.getElementById('loading-overlay');
    const allianceInfoContainer = document.getElementById('alliance-info-container');
    const allianceChatContainer = document.getElementById('alliance-chat-container');
    const playerSearchInput = document.getElementById('player-search-input');
    const clearReportsBtn = document.getElementById('clear-reports-btn');

    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        
        renderBaseManagementUI();
        renderAllianceUI();
        renderBattleReports();
    }

    // ===== RENDERIZADO DE LA NUEVA INTERFAZ DE GESTIÓN =====
    function renderBaseManagementUI() {
        const defenseLevel = gameState.baseLevels?.Defenses || 0;
        const defenseCost = Math.ceil(BASE_CONFIG.DEFENSES.cost * Math.pow(1.5, defenseLevel));
        
        let unitsHTML = Object.entries(BASE_CONFIG.UNITS).map(([key, unit]) => {
            const count = gameState.units?.[key] || 0;
            const cost = Math.ceil(unit.cost * Math.pow(1.1, count));
            return `<div class="upgrade-line">
                        <div class="item-info">
                            <span>${unit.name} (Cant: ${count})</span>
                            <small>Poder: ${unit.power} / Fuerte contra: ${unit.strongAgainst}</small>
                        </div>
                        <button onclick="buildUnit('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled':''}">Coste: ${cost.toLocaleString()}</button>
                    </div>`;
        }).join('');

        baseManagementListEl.innerHTML = `
            <div class="upgrade-line">
                <div class="item-info">
                    <span>Torretas de Defensa (Nvl ${defenseLevel})</span>
                    <small>Poder por nivel: ${BASE_CONFIG.DEFENSES.power}</small>
                </div>
                <button onclick="buyDefenseUpgrade()" class="upgrade-btn ${gameState.money < defenseCost ? 'disabled':''}">Coste: ${defenseCost.toLocaleString()}</button>
            </div>
            ${unitsHTML}`;
    }
    
    function renderAllianceUI() {
        if (gameState.alliance) {
            allianceInfoContainer.innerHTML = `<h3>Alianza: ${gameState.alliance}</h3><ul id="alliance-members-list" class="alliance-members">Cargando miembros...</ul><button onclick="leaveAlliance()" class="action-btn">Abandonar Alianza</button>`;
            allianceChatContainer.classList.remove('hidden');
            loadAllianceMembers();
            setupAllianceChatListener();
        } else {
            allianceInfoContainer.innerHTML = `<p>No perteneces a ninguna alianza.</p><div class="alliance-actions"><button onclick="createAlliance()" class="action-btn">Crear Alianza</button><button onclick="joinAlliance()" class="action-btn">Unirse a Alianza</button></div>`;
            allianceChatContainer.classList.add('hidden');
            if (allianceChatUnsubscribe) allianceChatUnsubscribe(); // Detiene el listener si dejamos la alianza
        }
    }

    function renderBattleReports() {
        const reports = (gameState.notifications || []).slice().reverse();
        if (reports.length === 0) {
            battleReportsEl.innerHTML = '<p>No hay actividad reciente.</p>';
            clearReportsBtn.style.display = 'none';
            return;
        }
        clearReportsBtn.style.display = 'block';
        battleReportsEl.innerHTML = reports.map(report => {
            const isWin = report.type.includes('win');
            const isDefense = report.type.includes('defense');
            const time = new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let revengeButton = '';
            if (isDefense && report.attackerId) {
                revengeButton = `<button class="revenge-btn" onclick="revengeAttack('${report.attackerId}', '${report.attackerName}')">Venganza</button>`;
            }
            return `<div class="log-item ${isWin ? 'win' : 'loss'}">
                        <div class="log-details">${report.message}</div>
                        ${revengeButton}
                        <time>${time}</time>
                    </div>`;
        }).join('');
    }

    // ===== LÓGICA DE UNIDADES Y MEJORAS =====
    window.buyDefenseUpgrade = () => {
        const level = gameState.baseLevels?.Defenses || 0;
        const cost = Math.ceil(BASE_CONFIG.DEFENSES.cost * Math.pow(1.5, level));
        if (gameState.money >= cost) {
            db.collection('players').doc(currentUser.uid).update({
                'baseLevels.Defenses': firebase.firestore.FieldValue.increment(1),
                money: firebase.firestore.FieldValue.increment(-cost)
            });
        }
    };

    window.buildUnit = (unitType) => {
        const unit = BASE_CONFIG.UNITS[unitType];
        const count = gameState.units?.[unitType] || 0;
        const cost = Math.ceil(unit.cost * Math.pow(1.1, count));
        if (gameState.money >= cost) {
            db.collection('players').doc(currentUser.uid).update({
                [`units.${unitType}`]: firebase.firestore.FieldValue.increment(1),
                money: firebase.firestore.FieldValue.increment(-cost)
            });
        }
    };
    
    // ===== LÓGICA DE COMBATE RECONSTRUIDA =====
    window.attackPlayer = async (targetId, targetName) => {
        if (!confirm(`¿Confirmar ataque al piloto ${targetName}?`)) return;
        attackModal.classList.add('hidden');
        
        try {
            const attackerRef = db.collection('players').doc(currentUser.uid);
            const defenderRef = db.collection('players').doc(targetId);
            const [attackerDoc, defenderDoc] = await Promise.all([attackerRef.get(), defenderRef.get()]);

            if (!attackerDoc.exists || !defenderDoc.exists) throw new Error("El objetivo ya no existe.");
            
            const attackerData = attackerDoc.data();
            const defenderData = defenderDoc.data();

            if (attackerData.alliance && defenderData.alliance && attackerData.alliance === defenderData.alliance) {
                alert("No puedes atacar a un miembro de tu propia alianza."); return;
            }

            // Simulación de batalla
            const attackerUnits = attackerData.units || {};
            const defenseLevel = defenderData.baseLevels?.Defenses || 0;
            let totalDefensePower = defenseLevel * BASE_CONFIG.DEFENSES.power;
            
            // Fase 1: Bombarderos contra Defensas
            let bomberPower = (attackerUnits.Bombers || 0) * BASE_CONFIG.UNITS.Bombers.power * (Math.random() * 0.5 + 0.75);
            let defensesDestroyed = Math.min(defenseLevel, Math.floor(bomberPower / BASE_CONFIG.DEFENSES.power));
            
            // Fase 2: Batalla de naves (simplificada)
            let attackerFleetPower = 0;
            for (const [unit, config] of Object.entries(BASE_CONFIG.UNITS)) {
                attackerFleetPower += (attackerUnits[unit] || 0) * config.power;
            }
            attackerFleetPower *= (Math.random() * 0.5 + 0.75);
            
            let battleResult = attackerFleetPower - (totalDefensePower * (1 - defensesDestroyed / (defenseLevel || 1)));

            const now = new Date().toISOString();
            if (battleResult > 0) { // VICTORIA
                const powerRatio = (totalDefensePower > 0) ? (attackerFleetPower / totalDefensePower) : 5;
                let lootPercentage = Math.max(0.01, 0.02 + ((powerRatio - 1) * 0.01));
                lootPercentage = Math.min(0.15, lootPercentage);
                const loot = Math.floor(defenderData.money * lootPercentage);

                await attackerRef.update({
                    money: firebase.firestore.FieldValue.increment(loot),
                    notifications: firebase.firestore.FieldValue.arrayUnion({ timestamp: now, type: 'attack_win', message: `¡Victoria! Saqueaste $${loot.toLocaleString()} de ${targetName}.` })
                });
                await defenderRef.update({
                    money: firebase.firestore.FieldValue.increment(-loot),
                    notifications: firebase.firestore.FieldValue.arrayUnion({ timestamp: now, type: 'defense_loss', message: `¡Fuiste atacado por ${currentUser.displayName}! Perdiste $${loot.toLocaleString()} créditos.`, attackerId: currentUser.uid, attackerName: currentUser.displayName })
                });
            } else { // DERROTA
                await attackerRef.update({ notifications: firebase.firestore.FieldValue.arrayUnion({ timestamp: now, type: 'attack_loss', message: `Derrota contra ${targetName}. Sus defensas resistieron.` }) });
                await defenderRef.update({ notifications: firebase.firestore.FieldValue.arrayUnion({ timestamp: now, type: 'defense_win', message: `¡Repeliste un ataque de ${currentUser.displayName}!`, attackerId: currentUser.uid, attackerName: currentUser.displayName }) });
            }
        } catch (error) { console.error("Error en el ataque:", error); alert(`Error al atacar: ${error.message}`); }
    };
    
    // ===== SISTEMA DE VENGANZA =====
    window.revengeAttack = (attackerId, attackerName) => {
        if (!attackerId || !attackerName) return;
        window.attackPlayer(attackerId, attackerName);
    };

    // ===== LÓGICA DE CHAT =====
    function setupAllianceChatListener() {
        if (allianceChatUnsubscribe) allianceChatUnsubscribe();
        if (!gameState.alliance) return;

        const chatQuery = db.collection('alliances').doc(gameState.alliance).collection('chat').orderBy('timestamp', 'asc').limitToLast(50);
        allianceChatUnsubscribe = chatQuery.onSnapshot(snapshot => {
            const chatBox = document.getElementById('alliance-chat-box');
            chatBox.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const msgEl = document.createElement('div');
                msgEl.classList.add('chat-message');
                const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                msgEl.innerHTML = `<div class="message-header"><span class="message-sender">${data.senderName}</span><span class="message-time">${time}</span></div><p class="message-content">${data.message}</p>`;
                chatBox.appendChild(msgEl);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }

    document.getElementById('alliance-chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-message-input');
        const message = input.value.trim();
        if (message && gameState.alliance) {
            db.collection('alliances').doc(gameState.alliance).collection('chat').add({
                senderName: currentUser.displayName,
                senderId: currentUser.uid,
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = '';
        }
    });

    attackPlayerBtn.addEventListener('click', async () => {
        attackModal.classList.remove('hidden');
        playerListContainer.innerHTML = "<p>Buscando pilotos...</p>";
        playerSearchInput.value = '';
        try {
            const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(100).get();
            allPlayers = [];
            snapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) {
                    allPlayers.push({ id: doc.id, ...doc.data() });
                }
            });
            renderPlayerList(allPlayers);
        } catch(error) {
            console.error("Error al buscar jugadores:", error);
            playerListContainer.innerHTML = "<p>Error al contactar con la red de pilotos.</p>";
        }
    });

    playerSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPlayers = allPlayers.filter(p => p.playerName.toLowerCase().includes(searchTerm));
        renderPlayerList(filteredPlayers);
    });

    function renderPlayerList(players) {
        playerListContainer.innerHTML = players.map(p => `<div class="player-list-item"><span>${p.playerName} (Fortuna: $${p.money.toLocaleString()})</span><button onclick="attackPlayer('${p.id}', '${p.playerName}')">Atacar</button></div>`).join('') || "<p>No se encontraron pilotos con ese nombre.</p>";
    }
    
    attackModal.querySelector('.close-btn').addEventListener('click', () => attackModal.classList.add('hidden'));
    
    clearReportsBtn.addEventListener('click', () => {
        if (confirm("¿Estás seguro de que quieres borrar todos los reportes de batalla?")) {
            db.collection('players').doc(currentUser.uid).update({ notifications: [] });
        }
    });

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

    async function loadAllianceMembers() {
        const listEl = document.getElementById('alliance-members-list');
        if (!listEl || !gameState.alliance) return;
        try {
            const allianceDoc = await db.collection('alliances').doc(gameState.alliance).get();
            if (allianceDoc.exists) {
                const members = allianceDoc.data().members || [];
                listEl.innerHTML = members.map(member => `<li>${member.name} ${member.id === currentUser.uid ? '(Tú)' : ''}</li>`).join('');
            }
        } catch (error) { console.error("Error cargando miembros de alianza:", error); listEl.innerHTML = "<li>Error al cargar miembros.</li>"; }
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('players').doc(user.uid).onSnapshot((doc) => {
                gameState = doc.exists ? doc.data() : { money: 0, baseLevels: { Defenses: 0 }, units: {}, notifications: [], alliance: null };
                if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0 };
                if (!gameState.units) gameState.units = {};
                if (!gameState.notifications) gameState.notifications = [];
                
                updateUI();
                loadingOverlay.classList.remove('visible');
            }, (error) => {
                console.error("Error al cargar datos del jugador: ", error);
                loadingOverlay.classList.remove('visible');
            });
        } else {
            window.location.href = 'menu.html';
        }
    });
});
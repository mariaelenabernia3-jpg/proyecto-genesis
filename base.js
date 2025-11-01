document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = { /* ... TU CONFIG ... */ };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const functions = firebase.functions();
    
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
        functions.useEmulator("localhost", 5001);
    }

    const BASE_CONFIG = {
        UPGRADES: {
            Defenses: { name: "Torretas de Defensa", cost: 1000 },
            Attacks: { name: "Flota de Ataque", cost: 1000 }
        }
    };
    
    let gameState = {};
    const moneyCountEl = document.getElementById('money-count');
    const upgradesListEl = document.getElementById('base-upgrades-list');
    const attackPlayerBtn = document.getElementById('attack-player-btn');
    const attackModal = document.getElementById('attack-modal');
    const playerListContainer = document.getElementById('player-list-container');
    const attackLogEl = document.getElementById('attack-log');
    const loadingOverlay = document.getElementById('loading-overlay');

    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        upgradesListEl.innerHTML = Object.entries(BASE_CONFIG.UPGRADES).map(([key, upgrade]) => {
            const level = gameState.baseLevels ? (gameState.baseLevels[key] || 0) : 0;
            const cost = Math.ceil(upgrade.cost * Math.pow(1.5, level));
            return `<div class="upgrade-line"><span>${upgrade.name} (Nvl ${level})</span><button onclick="buyBaseUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled':''}">Coste: ${cost.toLocaleString()}</button></div>`;
        }).join('');
    }

    window.buyBaseUpgrade = (key) => {
        if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 };
        const level = gameState.baseLevels[key] || 0;
        const cost = Math.ceil(BASE_CONFIG.UPGRADES[key].cost * Math.pow(1.5, level));
        if (gameState.money >= cost) {
            gameState.money -= cost;
            gameState.baseLevels[key] = level + 1;
            db.collection('players').doc(auth.currentUser.uid).set({ baseLevels: gameState.baseLevels, money: gameState.money }, { merge: true });
        }
    };

    attackPlayerBtn.addEventListener('click', async () => { /* ... (código sin cambios) ... */ });
    attackModal.querySelector('.close-btn').addEventListener('click', () => attackModal.classList.add('hidden'));
    window.attackPlayer = (targetId, targetName) => { /* ... (código sin cambios) ... */ };
    document.getElementById('create-alliance-btn').addEventListener('click', () => alert("FUNCIÓN EN DESARROLLO..."));
    document.getElementById('join-alliance-btn').addEventListener('click', () => alert("FUNCIÓN EN DESARROLLO..."));
    
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('players').doc(user.uid).onSnapshot((doc) => {
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
                loadingOverlay.classList.add('hidden');
            }, (error) => {
                console.error("Error al cargar datos: ", error);
                alert("No se pudieron cargar los datos de la base.");
                loadingOverlay.classList.add('hidden');
            });
        } else {
            window.location.href = 'menu.html';
        }
    });
});
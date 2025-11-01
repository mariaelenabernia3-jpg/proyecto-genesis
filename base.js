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
    const functions = firebase.functions(); // Habilita las Cloud Functions
    
    // --- CONEXIÓN AL EMULADOR LOCAL ---
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        console.log("BASE: MODO DE PRUEBA LOCAL DETECTADO. CONECTANDO A EMULADORES...");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
        functions.useEmulator("localhost", 5001); // Conecta las functions al emulador
    }

    // --- CONFIGURACIÓN Y SELECTORES ---
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

    // --- LÓGICA DE LA INTERFAZ ---
    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        upgradesListEl.innerHTML = Object.entries(BASE_CONFIG.UPGRADES).map(([key, upgrade]) => {
            const level = gameState.baseLevels ? (gameState.baseLevels[key] || 0) : 0;
            const cost = Math.ceil(upgrade.cost * Math.pow(1.5, level));
            return `<div class="upgrade-line"><span>${upgrade.name} (Nvl ${level})</span><button onclick="buyBaseUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled':''}">Coste: ${cost.toLocaleString()}</button></div>`;
        }).join('');
    }

    // --- ACCIONES DEL JUGADOR ---
    window.buyBaseUpgrade = (key) => {
        if (!gameState.baseLevels) gameState.baseLevels = { Defenses: 0, Attacks: 0 };
        const level = gameState.baseLevels[key] || 0;
        const cost = Math.ceil(BASE_CONFIG.UPGRADES[key].cost * Math.pow(1.5, level));
        if (gameState.money >= cost) {
            gameState.money -= cost; // Actualización optimista de la UI
            gameState.baseLevels[key] = level + 1;
            updateUI(); // Redibuja inmediatamente para que el jugador vea el cambio
            db.collection('players').doc(auth.currentUser.uid).set({ 
                baseLevels: gameState.baseLevels, 
                money: firebase.firestore.FieldValue.increment(-cost) 
            }, { merge: true });
        }
    };

    attackPlayerBtn.addEventListener('click', async () => {
        attackModal.classList.remove('hidden');
        playerListContainer.innerHTML = "<p>Buscando pilotos en el sector...</p>";
        try {
            const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(20).get();
            const players = [];
            snapshot.forEach(doc => {
                if (doc.id !== auth.currentUser.uid) { // No puedes atacarte a ti mismo
                    players.push({ id: doc.id, ...doc.data() });
                }
            });
            playerListContainer.innerHTML = players.map(p => `<div class="player-list-item"><span>${p.playerName} (Fortuna: $${p.money.toLocaleString()})</span><button onclick="attackPlayer('${p.id}', '${p.playerName}')">Atacar</button></div>`).join('') || "<p>No se encontraron otros pilotos.</p>";
        } catch (error) {
            console.error("Error al buscar jugadores:", error);
            playerListContainer.innerHTML = "<p>Error al contactar con la red de pilotos.</p>";
        }
    });
    
    attackModal.querySelector('.close-btn').addEventListener('click', () => attackModal.classList.add('hidden'));

    // --- LÓGICA DE ATAQUE SEGURA ---
    window.attackPlayer = (targetId, targetName) => {
        if (!confirm(`¿Confirmar ataque al piloto ${targetName}? La acción es inmediata y consumirá recursos.`)) return;
        
        attackModal.classList.add('hidden');
        attackLogEl.innerHTML = `<div class="log-item">Lanzando ataque coordinado contra ${targetName}...</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);

        // Llama a la Cloud Function "attackPlayer" y le pasa el ID del objetivo
        const attackFunction = functions.httpsCallable('attackPlayer');
        
        attackFunction({ targetId: targetId })
            .then(result => {
                // La función del servidor devuelve el resultado seguro
                const data = result.data;
                const logClass = data.success ? 'win' : 'loss';
                attackLogEl.innerHTML = `<div class="log-item ${logClass}">${data.message}</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
            })
            .catch(error => {
                // Maneja errores de la Cloud Function (ej. si el jugador no existe, no tiene permiso, etc.)
                console.error("Error en la función de ataque:", error);
                attackLogEl.innerHTML = `<div class="log-item loss">Error de transmisión: ${error.message}</div>` + (attackLogEl.innerHTML.includes('<p>') ? '' : attackLogEl.innerHTML);
            });
    };

    // --- LÓGICA DE ALIANZAS (SIMULADA) ---
    document.getElementById('create-alliance-btn').addEventListener('click', () => alert("FUNCIÓN EN DESARROLLO\n\nLa creación de alianzas requiere un sistema complejo de base de datos que se gestionaría con Cloud Functions."));
    document.getElementById('join-alliance-btn').addEventListener('click', () => alert("FUNCIÓN EN DESARROLLO"));
    
    // --- CARGA DE DATOS Y NOTIFICACIONES ---
    auth.onAuthStateChanged(user => {
        if (user) {
            loadingOverlay.classList.remove('hidden');
            // Usamos onSnapshot para que los datos (créditos, notificaciones, etc.) se actualicen en tiempo real
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
                            if (notifIndex > -1) {
                                gameState.notifications[notifIndex].read = true;
                            }
                        });
                        // Actualizar las notificaciones en la base de datos para no volver a mostrarlas
                        db.collection('players').doc(user.uid).update({ notifications: gameState.notifications });
                    }
                    
                    updateUI();
                }
                loadingOverlay.classList.add('hidden'); // Oculta la carga después de la primera lectura
            }, (error) => {
                console.error("Error al cargar datos del jugador: ", error);
                alert("No se pudieron cargar los datos de la base. Intenta recargar la página.");
                loadingOverlay.classList.add('hidden');
            });
        } else {
            // Si no hay usuario, lo redirige al menú
            window.location.href = 'menu.html';
        }
    });
});
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
    // La línea 'const functions = firebase.functions()' ha sido eliminada para corregir el error.

    // --- CONEXIÓN AL EMULADOR LOCAL ---
    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        console.log("MENÚ: MODO DE PRUEBA LOCAL DETECTADO. CONECTANDO A EMULADORES...");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
        // La línea 'functions.useEmulator' ha sido eliminada.
    }

    // --- CONFIGURACIÓN DE MISIONES ---
    const MISSIONS = [
        { id: 'D01', type: 'daily', title: 'Contrato de Helio', description: 'Vende 1,000 de Helio-3.', requirement: { type: 'sell', material: 'Helium3', value: 1000 }, reward: 750 },
        { id: 'D02', type: 'daily', title: 'Comerciante Activo', description: 'Gana $10,000 créditos vendiendo recursos.', requirement: { type: 'earn', value: 10000 }, reward: 1500 },
        { id: 'M01', type: 'main', title: 'Aspirante a Capitalista', description: 'Acumula una fortuna total de $25,000 créditos.', requirement: { type: 'money', value: 25000 }, reward: 2500 },
        { id: 'M02', type: 'main', title: 'Inversor Inicial', description: 'Mejora los Drones de Minería al nivel 10.', requirement: { type: 'upgrade', key: 'Drones', level: 10 }, reward: 1500 },
        { id: 'M03', type: 'main', title: 'Viajero Frecuente', description: 'Desbloquea la ruta de viaje a Marte.', requirement: { type: 'travel', planet: 'Mars' }, reward: 1000 },
        { id: 'M04', type: 'main', title: 'Magnate Espacial', description: 'Acumula una fortuna total de $250,000 créditos.', requirement: { type: 'money', value: 250000 }, reward: 10000 },
        { id: 'M05', type: 'main', title: 'Maestro de la Logística', description: 'Mejora las Fragatas de Carga al nivel 15.', requirement: { type: 'upgrade', key: 'Frigates', level: 15 }, reward: 7500 },
        { id: 'M06', type: 'main', title: 'Explorador de Mundos de Hielo', description: 'Desbloquea la ruta de viaje a Europa.', requirement: { type: 'travel', planet: 'Europa'}, reward: 5000},
    ];
    
    // --- CONSTANTES Y SELECTORES ---
    const iconLogin = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
    const iconLogout = `<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>`;
    
    let playerData = null;

    const authModal = document.getElementById('auth-modal'), missionsModal = document.getElementById('missions-modal'), creditsModal = document.getElementById('credits-modal'), leaderboardModal = document.getElementById('leaderboard-modal'), marketModal = document.getElementById('market-modal');
    const missionsBtn = document.getElementById('missions-btn'), missionsList = document.getElementById('missions-list');
    const adminKeyInput = document.getElementById('admin-key-input'), adminPanel = document.getElementById('admin-panel'), deleteDataBtn = document.getElementById('delete-data-btn'), deleteAccountsBtn = document.getElementById('delete-accounts-btn');
    const authIconButton = document.getElementById('auth-icon-btn'), loginErrorMsg = document.getElementById('login-error-message'), registerErrorMsg = document.getElementById('register-error-message');
    const allModals = document.querySelectorAll('.modal-overlay'), baseBtn = document.getElementById('base-btn'), creditsBtn = document.getElementById('credits-btn'), leaderboardBtn = document.getElementById('leaderboard-btn'), startGameLink = document.getElementById('start-game-btn'), marketBtn = document.getElementById('market-btn');
    const userInfoDisplay = document.getElementById('user-info'), startGameBtnText = startGameLink.querySelector('span'), leaderboardContainer = document.getElementById('leaderboard-container'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), registerBtn = document.getElementById('register-btn'), loginBtn = document.getElementById('login-btn');
    const marketBuyTab = document.getElementById('market-buy-tab'), marketSellTab = document.getElementById('market-sell-tab'), marketBuyView = document.getElementById('market-buy-view'), marketSellView = document.getElementById('market-sell-view');
    
    const ADMIN_KEY = "CODIGO_ROJO_1337", CONFIRM_DELETE_DATA = "PURGAR DATOS DE JUGADORES", CONFIRM_DELETE_ACCOUNTS = "PROTOCOLO EXTINCION";
    
    // --- LÓGICA DE MODALES Y NAVEGACIÓN ---
    function closeModal(modal) { modal.classList.add('hidden'); }
    function openModal(modal) { clearAuthErrors(); modal.classList.remove('hidden'); }

    baseBtn.addEventListener('click', (e) => { e.preventDefault(); if(auth.currentUser) { document.body.style.transition = 'opacity 1s ease-out'; document.body.style.opacity = '0'; setTimeout(() => { window.location.href = 'base.html'; }, 1000); } else { alert("Debes iniciar sesión para acceder a tu base."); }});
    creditsBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(creditsModal); });
    leaderboardBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(leaderboardModal); fetchAndDisplayLeaderboard(); });
    marketBtn.addEventListener('click', (e) => { e.preventDefault(); if (auth.currentUser) { openModal(marketModal); marketBuyTab.click(); } else { alert("Debes iniciar sesión para acceder al mercado."); } });
    missionsBtn.addEventListener('click', (e) => { e.preventDefault(); if (auth.currentUser) { openModal(missionsModal); renderMissions(); } else { alert("Debes iniciar sesión para ver tus misiones."); } });
    
    allModals.forEach(modal => { const closeBtn = modal.querySelector('.close-btn'); if (closeBtn) { closeBtn.addEventListener('click', () => closeModal(modal)); } modal.addEventListener('click', (event) => { if (event.target === modal) { closeModal(modal); } }); });
    startGameLink.addEventListener('click', (e) => { e.preventDefault(); document.body.style.transition = 'opacity 1s ease-out'; document.body.style.opacity = '0'; setTimeout(() => { window.location.href = 'game.html'; }, 1000); });
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });
    adminKeyInput.addEventListener('input', (e) => { e.target.value === ADMIN_KEY ? adminPanel.classList.remove('hidden') : adminPanel.classList.add('hidden'); });
    deleteDataBtn.addEventListener('click', () => { if (prompt(`ACCIÓN IRREVERSIBLE.\n\nEscribe: "${CONFIRM_DELETE_DATA}"`) === CONFIRM_DELETE_DATA) { alert("Confirmación recibida.\nACCIÓN SIMULADA."); } else { alert("Confirmación incorrecta. Operación cancelada."); } });
    deleteAccountsBtn.addEventListener('click', () => { if (prompt(`MÁXIMA ALERTA.\n\nEscribe: "${CONFIRM_DELETE_ACCOUNTS}"`) === CONFIRM_DELETE_ACCOUNTS) { alert("Confirmación final recibida.\nACCIÓN SIMULADA."); } else { alert("Confirmación incorrecta. Operación cancelada."); } });

    // --- LÓGICA DE AUTENTICACIÓN ---
    function showAuthError(message, type) { const element = type === 'login' ? loginErrorMsg : registerErrorMsg; element.textContent = message; element.style.display = 'block'; }
    function clearAuthErrors() { loginErrorMsg.style.display = 'none'; registerErrorMsg.style.display = 'none'; }
    function translateFirebaseError(error) { switch (error.code) { case 'auth/email-already-in-use': return 'Este correo ya está registrado.'; case 'auth/wrong-password': return 'Contraseña incorrecta.'; case 'auth/user-not-found': return 'No se encontró cuenta con este correo.'; case 'auth/invalid-email': return 'El correo no es válido.'; case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.'; default: return 'Ha ocurrido un error inesperado.'; } }

    registerBtn.addEventListener('click', () => { clearAuthErrors(); const username = document.getElementById('register-username').value, email = document.getElementById('register-email').value, password = document.getElementById('register-password').value; if (!username || !email || !password) { showAuthError("Todos los campos son obligatorios.", 'register'); return; } auth.createUserWithEmailAndPassword(email, password).then(cred => cred.user.updateProfile({ displayName: username })).then(() => closeModal(authModal)).catch(err => showAuthError(translateFirebaseError(err), 'register')); });
    loginBtn.addEventListener('click', () => { clearAuthErrors(); const email = document.getElementById('login-email').value, password = document.getElementById('login-password').value; if (!email || !password) { showAuthError("Introduce correo y contraseña.", 'login'); return; } auth.signInWithEmailAndPassword(email, password).then(() => closeModal(authModal)).catch(err => showAuthError(translateFirebaseError(err), 'login')); });
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            userInfoDisplay.textContent = user.displayName || user.email.split('@')[0];
            userInfoDisplay.classList.remove('hidden');
            authIconButton.innerHTML = iconLogout;
            authIconButton.title = "Cerrar Sesión";
            authIconButton.onclick = () => { if (confirm('¿Seguro que quieres cerrar sesión?')) auth.signOut(); };
            startGameBtnText.textContent = 'Continuar Partida';
            await fetchPlayerData();
            checkDailyLogin();
        } else {
            userInfoDisplay.classList.add('hidden');
            authIconButton.innerHTML = iconLogin;
            authIconButton.title = "Iniciar Sesión / Perfil";
            authIconButton.onclick = () => openModal(authModal);
            startGameBtnText.textContent = 'Iniciar Partida';
            playerData = null;
        }
    });
    
    async function fetchPlayerData() { if (!auth.currentUser) return; const doc = await db.collection('players').doc(auth.currentUser.uid).get(); if (doc.exists) playerData = doc.data(); }

    function checkDailyLogin() {
        if (!playerData || !auth.currentUser) return;
        const today = new Date().toISOString().slice(0, 10);
        const lastLogin = playerData.lastLogin;

        if (lastLogin !== today) {
            playerData.money = (playerData.money || 0) + 250;
            playerData.lastLogin = today;
            playerData.dailyMissionProgress = {}; 
            playerData.completedDailyMissions = [];
            
            db.collection('players').doc(auth.currentUser.uid).update({
                money: playerData.money,
                lastLogin: playerData.lastLogin,
                dailyMissionProgress: playerData.dailyMissionProgress,
                completedDailyMissions: playerData.completedDailyMissions
            });
            alert(`¡Bienvenido de nuevo, ${auth.currentUser.displayName || 'Piloto'}!\n\nHas recibido 250 créditos por tu bonus de conexión diaria.\n¡Tus misiones diarias se han reiniciado!`);
        }
    }

    // --- LÓGICA DE MISIONES ---
    async function renderMissions() {
        if (!playerData) await fetchPlayerData();
        if (!playerData) { missionsList.innerHTML = "<p>No se pudieron cargar los datos del jugador.</p>"; return; }

        playerData.completedMissions = playerData.completedMissions || [];
        playerData.achievedMissions = playerData.achievedMissions || [];
        playerData.dailyMissionProgress = playerData.dailyMissionProgress || {};
        playerData.completedDailyMissions = playerData.completedDailyMissions || [];

        const renderMission = (mission, isDaily) => {
            const completedList = isDaily ? playerData.completedDailyMissions : playerData.completedMissions;
            const isClaimed = completedList.includes(mission.id);
            let progress = 0, progressText = "", isAchieved = false;

            switch (mission.requirement.type) {
                case 'money': progress = Math.min(100, ((playerData.money || 0) / mission.requirement.value) * 100); progressText = `$${Math.floor(playerData.money || 0).toLocaleString()} / $${mission.requirement.value.toLocaleString()}`; break;
                case 'upgrade': const currentLevel = (playerData.upgradeLevels && playerData.upgradeLevels[mission.requirement.key]) || 0; progress = Math.min(100, (currentLevel / mission.requirement.level) * 100); progressText = `Nivel ${currentLevel} / Nivel ${mission.requirement.level}`; break;
                case 'travel': isAchieved = playerData.achievedMissions.includes(mission.id); progress = isAchieved ? 100 : 0; progressText = isAchieved ? "Destino alcanzado" : "Pendiente"; break;
                case 'sell': const soldAmount = playerData.dailyMissionProgress[`sell_${mission.requirement.material}`] || 0; progress = Math.min(100, (soldAmount / mission.requirement.value) * 100); progressText = `${soldAmount.toLocaleString()} / ${mission.requirement.value.toLocaleString()}`; break;
                case 'earn': const earnedAmount = playerData.dailyMissionProgress['earn'] || 0; progress = Math.min(100, (earnedAmount / mission.requirement.value) * 100); progressText = `$${Math.floor(earnedAmount).toLocaleString()} / $${mission.requirement.value.toLocaleString()}`; break;
            }
            
            isAchieved = progress >= 100;
            const canClaim = isAchieved && !isClaimed;
            let missionClass = isClaimed ? 'claimed' : (canClaim ? 'achieved' : '');

            return `<div class="mission-item ${missionClass}"><div class="mission-header"><h3 class="mission-title">${mission.title}</h3><span class="mission-reward">Recompensa: $${mission.reward.toLocaleString()}</span></div><p class="mission-description">${mission.description}</p><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div><p class="progress-text">${progressText}</p><button class="claim-btn ${isClaimed ? 'claimed-style' : ''}" onclick="claimMissionReward('${mission.id}', ${isDaily})" ${!canClaim ? 'disabled' : ''}>${isClaimed ? 'Reclamado' : (canClaim ? 'Reclamar' : 'En Progreso')}</button></div>`;
        };
        
        const dailyMissionsHTML = MISSIONS.filter(m => m.type === 'daily').map(m => renderMission(m, true)).join('');
        const mainMissionsHTML = MISSIONS.filter(m => m.type === 'main').map(m => renderMission(m, false)).join('');

        missionsList.innerHTML = `<h3 class="missions-divider">Misiones Diarias</h3>${dailyMissionsHTML || "<p>No hay misiones diarias disponibles.</p>"}<h3 class="missions-divider">Misiones Principales</h3>${mainMissionsHTML || "<p>Has completado todas las misiones principales.</p>"}`;
    }

    window.claimMissionReward = (missionId, isDaily) => {
        if (!playerData || !auth.currentUser) return;
        const mission = MISSIONS.find(m => m.id === missionId);
        const completedListKey = isDaily ? 'completedDailyMissions' : 'completedMissions';
        if (!mission || playerData[completedListKey].includes(missionId)) return;

        playerData[completedListKey].push(mission.id);
        playerData.money += mission.reward;
        db.collection('players').doc(auth.currentUser.uid).update({ [completedListKey]: playerData[completedListKey], money: playerData.money })
            .then(() => { alert(`¡Recompensa de $${mission.reward.toLocaleString()} reclamada!`); renderMissions(); })
            .catch(error => console.error("Error al reclamar:", error));
    };

    // --- LÓGICA DE MERCADO (CLIENTE) ---
    marketBuyTab.addEventListener('click', () => { marketBuyTab.classList.add('active'); marketSellTab.classList.remove('active'); marketBuyView.classList.remove('hidden'); marketSellView.classList.add('hidden'); loadMarketplace(); });
    marketSellTab.addEventListener('click', () => { marketSellTab.classList.add('active'); marketBuyTab.classList.remove('active'); marketSellView.classList.remove('hidden'); marketBuyView.classList.add('hidden'); loadPlayerModulesForSale(); });
    async function loadMarketplace() {
        marketBuyView.innerHTML = "<p>Actualizando listados del mercado...</p>";
        try {
            const snapshot = await db.collection('marketplace').orderBy('price', 'asc').get();
            if (snapshot.empty) { marketBuyView.innerHTML = "<p>El mercado está vacío. ¡Sé el primero en vender algo!</p>"; return; }
            marketBuyView.innerHTML = snapshot.docs.map(doc => { const item = doc.data(); const isOwnItem = item.sellerId === auth.currentUser.uid; return `<div class="market-item"><div class="item-rarity ${item.rarity}">${item.rarity}</div><div class="item-info"><h4>${item.name}</h4><p>Vendedor: ${item.sellerName}</p></div><div class="item-price-action"><span class="item-price">$${item.price.toLocaleString()}</span><button onclick="buyMarketItem('${doc.id}')" class="market-buy-btn" ${isOwnItem ? 'disabled' : ''}>${isOwnItem ? 'Es tuyo' : 'Comprar'}</button></div></div>`; }).join('');
        } catch (error) { console.error("Error al cargar el mercado:", error); marketBuyView.innerHTML = "<p>Error al conectar con la red de comercio.</p>"; }
    }
    function loadPlayerModulesForSale() { marketSellView.innerHTML = "<p>Cargando tu inventario de módulos...</p>"; if (!playerData || !playerData.modules || playerData.modules.length === 0) { marketSellView.innerHTML = "<p>No tienes módulos para vender.</p>"; return; } marketSellView.innerHTML = playerData.modules.map(module => `<div class="market-item"><div class="item-rarity ${module.rarity}">${module.rarity}</div><div class="item-info"><h4>${module.name}</h4><p>${module.description}</p></div><form class="market-sell-form" onsubmit="postItemToMarket(event, '${module.id}')"><input type="number" placeholder="Precio" required min="1"><button type="submit" class="market-sell-btn">Vender</button></form></div>`).join(''); }
    
    window.postItemToMarket = async (event, moduleId) => {
        event.preventDefault();
        const priceInput = event.target.querySelector('input[type="number"]');
        const price = parseInt(priceInput.value, 10);
        if (!price || price <= 0) { alert("Introduce un precio válido."); return; }
        if (!confirm(`¿Poner a la venta este módulo por $${price.toLocaleString()}?`)) return;
        const playerRef = db.collection('players').doc(auth.currentUser.uid);
        const itemToSell = playerData.modules.find(m => m.id === moduleId);
        if (!itemToSell) { alert("Error: No se encontró el objeto en tu inventario."); return; }
        await db.collection('marketplace').add({ ...itemToSell, price: price, sellerId: auth.currentUser.uid, sellerName: auth.currentUser.displayName || 'Anónimo' });
        await playerRef.update({ modules: firebase.firestore.FieldValue.arrayRemove(itemToSell) });
        alert('¡Tu módulo ha sido puesto a la venta!');
        fetchPlayerData().then(loadPlayerModulesForSale);
    };

    window.buyMarketItem = async (listingId) => {
        if (!confirm("¿Confirmar la compra de este módulo?")) return;
        const buyerRef = db.collection('players').doc(auth.currentUser.uid);
        const listingRef = db.collection('marketplace').doc(listingId);
        try {
            const listingDoc = await listingRef.get();
            if (!listingDoc.exists) throw new Error('Este objeto ya no está a la venta.');
            const listingData = listingDoc.data();
            const sellerRef = db.collection('players').doc(listingData.sellerId);
            if (listingData.sellerId === auth.currentUser.uid) throw new Error('No puedes comprar tu propio objeto.');
            if (playerData.money < listingData.price) throw new Error('No tienes suficientes créditos.');
            await buyerRef.update({ money: firebase.firestore.FieldValue.increment(-listingData.price), modules: firebase.firestore.FieldValue.arrayUnion(listingData) });
            await sellerRef.update({ money: firebase.firestore.FieldValue.increment(listingData.price) });
            await listingRef.delete();
            alert(`¡Has comprado ${listingData.name}!`);
            fetchPlayerData();
            loadMarketplace();
        } catch (error) { console.error("Error al comprar:", error); alert(`Error: ${error.message}`); }
    };

    // --- LÓGICA DE CLASIFICACIÓN ---
    async function fetchAndDisplayLeaderboard() { leaderboardContainer.innerHTML = '<p>Cargando clasificación...</p>'; const user = auth.currentUser; try { const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(10).get(); if (snapshot.empty) { leaderboardContainer.innerHTML = '<p>Aún no hay nadie en la clasificación.</p>'; return; } let tableHTML = '<table class="leaderboard-table"><thead><tr><th class="rank">#</th><th class="name">Piloto</th><th class="score">Fortuna</th></tr></thead><tbody>'; let rank = 1; snapshot.forEach(doc => { const data = doc.data(); const isCurrentUser = user && doc.id === user.uid; tableHTML += `<tr class="${isCurrentUser ? 'current-player-row' : ''}"><td class="rank">${rank}</td><td class="name">${data.playerName}</td><td class="score">$${data.money.toLocaleString()}</td></tr>`; rank++; }); tableHTML += '</tbody></table>'; leaderboardContainer.innerHTML = tableHTML; } catch (error) { console.error("Error al obtener la clasificación: ", error); leaderboardContainer.innerHTML = '<p>Error al cargar la clasificación.</p>'; } }
});
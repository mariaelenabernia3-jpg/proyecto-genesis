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
    const functions = firebase.functions();

    if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
        functions.useEmulator("localhost", 5001);
    }

    const MISSIONS = [
        { id: 'M00', title: 'Conexión Diaria', description: 'Inicia sesión por primera vez hoy.', requirement: { type: 'daily_login' }, reward: 250 },
        { id: 'M01', title: 'Aspirante a Capitalista', description: 'Acumula una fortuna total de $5,000 créditos.', requirement: { type: 'money', value: 5000 }, reward: 1000 },
        { id: 'M02', title: 'Inversor Inicial', description: 'Mejora los Drones de Minería al nivel 5.', requirement: { type: 'upgrade', key: 'Drones', level: 5 }, reward: 750 },
        { id: 'M03', title: 'Viajero Frecuente', description: 'Desbloquea la ruta de viaje a Marte.', requirement: { type: 'travel', planet: 'Mars' }, reward: 500 },
        { id: 'M04', title: 'Magnate Espacial', description: 'Acumula una fortuna total de $50,000 créditos.', requirement: { type: 'money', value: 50000 }, reward: 5000 },
    ];

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
    
    function closeModal(modal) { modal.classList.add('hidden'); }
    function openModal(modal) { clearAuthErrors(); modal.classList.remove('hidden'); }

    baseBtn.addEventListener('click', (e) => { e.preventDefault(); if(auth.currentUser) { document.body.style.transition = 'opacity 1s ease-out'; document.body.style.opacity = '0'; setTimeout(() => { window.location.href = 'base.html'; }, 1000); } else { alert("Debes iniciar sesión para acceder a tu base."); }});
    creditsBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(creditsModal); });
    leaderboardBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(leaderboardModal); fetchAndDisplayLeaderboard(); });
    marketBtn.addEventListener('click', (e) => { e.preventDefault(); if (auth.currentUser) { openModal(marketModal); loadMarketplace(); } else { alert("Debes iniciar sesión para acceder al mercado."); } });
    missionsBtn.addEventListener('click', (e) => { e.preventDefault(); if (auth.currentUser) { openModal(missionsModal); renderMissions(); } else { alert("Debes iniciar sesión para ver tus misiones."); } });
    
    allModals.forEach(modal => { const closeBtn = modal.querySelector('.close-btn'); if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal)); modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }); });
    startGameLink.addEventListener('click', (e) => { e.preventDefault(); document.body.style.transition = 'opacity 1s ease-out'; document.body.style.opacity = '0'; setTimeout(() => { window.location.href = 'game.html'; }, 1000); });
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });
    adminKeyInput.addEventListener('input', (e) => { e.target.value === ADMIN_KEY ? adminPanel.classList.remove('hidden') : adminPanel.classList.add('hidden'); });
    deleteDataBtn.addEventListener('click', () => { if (prompt(`ACCIÓN IRREVERSIBLE.\n\nEscribe: "${CONFIRM_DELETE_DATA}"`) === CONFIRM_DELETE_DATA) { alert("Confirmación recibida.\nACCIÓN SIMULADA.\nEjecuta la Cloud Function 'deleteAllPlayerData'."); } else { alert("Confirmación incorrecta. Operación cancelada."); } });
    deleteAccountsBtn.addEventListener('click', () => { if (prompt(`MÁXIMA ALERTA.\n\nEscribe: "${CONFIRM_DELETE_ACCOUNTS}"`) === CONFIRM_DELETE_ACCOUNTS) { alert("Confirmación final recibida.\nACCIÓN SIMULADA.\nEjecuta la Cloud Function 'deleteAllUsers'."); } else { alert("Confirmación incorrecta. Operación cancelada."); } });

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
        if (!playerData) return;
        const today = new Date().toISOString().slice(0, 10);
        const lastLogin = playerData.lastLogin;

        if (lastLogin !== today) {
            const dailyMission = MISSIONS.find(m => m.requirement.type === 'daily_login');
            if(dailyMission) {
                playerData.money = (playerData.money || 0) + dailyMission.reward;
                playerData.lastLogin = today;
                db.collection('players').doc(auth.currentUser.uid).update({ money: playerData.money, lastLogin: playerData.lastLogin });
                alert(`¡Bienvenido de nuevo, ${auth.currentUser.displayName || 'Piloto'}!\n\nHas recibido ${dailyMission.reward} créditos por tu bonus de conexión diaria.`);
            }
        }
    }

    async function renderMissions() {
        if (!playerData) await fetchPlayerData();
        if (!playerData) { missionsList.innerHTML = "<p>No se pudieron cargar los datos del jugador.</p>"; return; }

        playerData.completedMissions = playerData.completedMissions || [];
        playerData.achievedMissions = playerData.achievedMissions || [];

        missionsList.innerHTML = MISSIONS.map(mission => {
            if (mission.requirement.type === 'daily_login') return '';
            const isClaimed = playerData.completedMissions.includes(mission.id);
            let progress = 0;
            let progressText = "";
            let isAchieved = false;

            switch (mission.requirement.type) {
                case 'money':
                    progress = Math.min(100, ((playerData.money || 0) / mission.requirement.value) * 100);
                    progressText = `$${Math.floor(playerData.money || 0).toLocaleString()} / $${mission.requirement.value.toLocaleString()}`;
                    break;
                case 'upgrade':
                    const currentLevel = (playerData.upgradeLevels && playerData.upgradeLevels[mission.requirement.key]) || 0;
                    progress = Math.min(100, (currentLevel / mission.requirement.level) * 100);
                    progressText = `Nivel ${currentLevel} / Nivel ${mission.requirement.level}`;
                    break;
                case 'travel':
                    isAchieved = playerData.achievedMissions.includes(mission.id);
                    progress = isAchieved ? 100 : 0;
                    progressText = isAchieved ? "Destino alcanzado" : "Pendiente";
                    break;
            }
            
            isAchieved = progress >= 100;
            const canClaim = isAchieved && !isClaimed;
            let missionClass = isClaimed ? 'claimed' : (canClaim ? 'achieved' : '');

            return `<div class="mission-item ${missionClass}"><div class="mission-header"><h3 class="mission-title">${mission.title}</h3><span class="mission-reward">Recompensa: $${mission.reward.toLocaleString()}</span></div><p class="mission-description">${mission.description}</p><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div><p class="progress-text">${progressText}</p><button class="claim-btn ${isClaimed ? 'claimed-style' : ''}" onclick="claimMissionReward('${mission.id}')" ${!canClaim ? 'disabled' : ''}>${isClaimed ? 'Reclamado' : (canClaim ? 'Reclamar' : 'En Progreso')}</button></div>`;
        }).join('');
    }

    window.claimMissionReward = (missionId) => {
        if (!playerData || !auth.currentUser) return;
        const mission = MISSIONS.find(m => m.id === missionId);
        if (!mission || playerData.completedMissions.includes(missionId)) return;

        let isAchieved = false;
        switch (mission.requirement.type) {
            case 'money': isAchieved = (playerData.money || 0) >= mission.requirement.value; break;
            case 'upgrade': isAchieved = ((playerData.upgradeLevels && playerData.upgradeLevels[mission.requirement.key]) || 0) >= mission.requirement.level; break;
            case 'travel': isAchieved = (playerData.achievedMissions || []).includes(mission.id); break;
        }

        if (isAchieved) {
            playerData.completedMissions.push(mission.id);
            playerData.money += mission.reward;
            db.collection('players').doc(auth.currentUser.uid).update({ completedMissions: playerData.completedMissions, money: playerData.money })
                .then(() => { alert(`¡Recompensa de $${mission.reward.toLocaleString()} reclamada!`); renderMissions(); })
                .catch(error => { console.error("Error al reclamar la misión:", error); });
        }
    };

    marketBuyTab.addEventListener('click', () => { marketBuyTab.classList.add('active'); marketSellTab.classList.remove('active'); marketBuyView.classList.remove('hidden'); marketSellView.classList.add('hidden'); loadMarketplace(); });
    marketSellTab.addEventListener('click', () => { marketSellTab.classList.add('active'); marketBuyTab.classList.remove('active'); marketSellView.classList.remove('hidden'); marketBuyView.classList.add('hidden'); loadPlayerModulesForSale(); });
    async function loadMarketplace() { marketBuyView.innerHTML = "<p>El mercado está actualmente fuera de línea mientras se implementan las Cloud Functions de transacción segura.</p>"; }
    function loadPlayerModulesForSale() { marketSellView.innerHTML = "<p>Cargando tu inventario de módulos...</p>"; if (!playerData || !playerData.modules || playerData.modules.length === 0) { marketSellView.innerHTML = "<p>No tienes módulos para vender.</p>"; return; } marketSellView.innerHTML = playerData.modules.map(module => `<div class="market-item"><div class="item-rarity ${module.rarity}">${module.rarity}</div><div class="item-info"><h4>${module.name}</h4><p>${module.description}</p></div><form class="market-sell-form" onsubmit="postItemToMarket(event, '${module.id}')"><input type="number" placeholder="Precio" required min="1"><button type="submit" class="market-sell-btn">Vender</button></form></div>`).join(''); }
    window.postItemToMarket = (event) => { event.preventDefault(); alert("FUNCIONALIDAD EN DESARROLLO:\nSe requiere una Cloud Function 'postListing' para gestionar la venta de forma segura."); }
    async function fetchAndDisplayLeaderboard() { leaderboardContainer.innerHTML = '<p>Cargando clasificación...</p>'; const user = auth.currentUser; try { const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(10).get(); if (snapshot.empty) { leaderboardContainer.innerHTML = '<p>Aún no hay nadie en la clasificación. ¡Sé el primero!</p>'; return; } let tableHTML = '<table class="leaderboard-table"><thead><tr><th class="rank">#</th><th class="name">Piloto</th><th class="score">Fortuna</th></tr></thead><tbody>'; let rank = 1; snapshot.forEach(doc => { const data = doc.data(); const isCurrentUser = user && doc.id === user.uid; tableHTML += `<tr class="${isCurrentUser ? 'current-player-row' : ''}"><td class="rank">${rank}</td><td class="name">${data.playerName}</td><td class="score">$${data.money.toLocaleString()}</td></tr>`; rank++; }); tableHTML += '</tbody></table>'; leaderboardContainer.innerHTML = tableHTML; } catch (error) { console.error("Error al obtener la clasificación: ", error); leaderboardContainer.innerHTML = '<p>Error al cargar la clasificación.</p>'; } }
});
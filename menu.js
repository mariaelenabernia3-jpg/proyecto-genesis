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
}

const MISSIONS = [
    { id: 'M01', title: 'Aspirante a Capitalista', description: 'Acumula una fortuna total de $10,000 créditos.', requirement: { type: 'money', value: 10000 }, reward: 5000 },
    { id: 'M02', title: 'Inversor Inicial', description: 'Mejora los Drones de Minería al nivel 5.', requirement: { type: 'upgrade', key: 'Drones', level: 5 }, reward: 2500 },
    { id: 'M03', title: 'Viajero Frecuente', description: 'Viaja al planeta Marte.', requirement: { type: 'travel', planet: 'Mars' }, reward: 1000 },
    { id: 'M04', title: 'Magnate Espacial', description: 'Acumula una fortuna total de $100,000 créditos.', requirement: { type: 'money', value: 100000 }, reward: 25000 },
    { id: 'M05', title: 'Maestro de la Logística', description: 'Mejora las Fragatas de Carga al nivel 10.', requirement: { type: 'upgrade', key: 'Frigates', level: 10 }, reward: 15000 }
];

const iconLogin = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
const iconLogout = `<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>`;

let playerData = null;

const authModal = document.getElementById('auth-modal'), missionsModal = document.getElementById('missions-modal'), creditsModal = document.getElementById('credits-modal'), leaderboardModal = document.getElementById('leaderboard-modal'), marketModal = document.getElementById('market-modal');
const missionsBtn = document.getElementById('missions-btn');
const missionsList = document.getElementById('missions-list');
// ... (El resto de selectores se incluyen abajo para evitar repetición)

function closeModal(modal) { modal.classList.add('hidden'); }
function openModal(modal) { clearAuthErrors(); modal.classList.remove('hidden'); }

missionsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (auth.currentUser) {
        openModal(missionsModal);
        renderMissions();
    } else {
        alert("Debes iniciar sesión para ver tus misiones.");
    }
});

async function renderMissions() {
    if (!playerData) await fetchPlayerData();
    if (!playerData) { missionsList.innerHTML = "<p>No se pudieron cargar los datos del jugador.</p>"; return; }

    playerData.completedMissions = playerData.completedMissions || [];
    playerData.achievedMissions = playerData.achievedMissions || [];

    missionsList.innerHTML = MISSIONS.map(mission => {
        const isClaimed = playerData.completedMissions.includes(mission.id);
        let progress = 0;
        let progressText = "";
        let isAchieved = false;

        switch (mission.requirement.type) {
            case 'money':
                progress = Math.min(100, (playerData.money / mission.requirement.value) * 100);
                progressText = `$${Math.floor(playerData.money).toLocaleString()} / $${mission.requirement.value.toLocaleString()}`;
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
        
        if (progress >= 100 && !playerData.achievedMissions.includes(mission.id)) {
            playerData.achievedMissions.push(mission.id);
        }

        const canClaim = progress >= 100 && !isClaimed;
        let missionClass = '';
        if (isClaimed) missionClass = 'claimed';
        else if (canClaim) missionClass = 'achieved';

        return `
            <div class="mission-item ${missionClass}">
                <div class="mission-header">
                    <h3 class="mission-title">${mission.title}</h3>
                    <span class="mission-reward">Recompensa: $${mission.reward.toLocaleString()}</span>
                </div>
                <p class="mission-description">${mission.description}</p>
                <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>
                <p class="progress-text">${progressText}</p>
                <button class="claim-btn ${isClaimed ? 'claimed-style' : ''} ${canClaim ? '' : 'disabled'}" onclick="claimMissionReward('${mission.id}')" ${canClaim ? '' : 'disabled'}>
                    ${isClaimed ? 'Reclamado' : (canClaim ? 'Reclamar' : 'En Progreso')}
                </button>
            </div>
        `;
    }).join('');
}

window.claimMissionReward = (missionId) => {
    alert(`FUNCIONALIDAD EN DESARROLLO:\nSe requiere una Cloud Function 'claimMission' para validar y entregar la recompensa de la misión "${missionId}" de forma segura.`);
};

// --- CÓDIGO RESTANTE (COMPLETO) ---
const adminKeyInput = document.getElementById('admin-key-input'), adminPanel = document.getElementById('admin-panel'), deleteDataBtn = document.getElementById('delete-data-btn'), deleteAccountsBtn = document.getElementById('delete-accounts-btn');
const ADMIN_KEY = "CODIGO_ROJO_1337", CONFIRM_DELETE_DATA = "PURGAR DATOS DE JUGADORES", CONFIRM_DELETE_ACCOUNTS = "PROTOCOLO EXTINCION";
const authIconButton = document.getElementById('auth-icon-btn'), loginErrorMsg = document.getElementById('login-error-message'), registerErrorMsg = document.getElementById('register-error-message');
const allModals = document.querySelectorAll('.modal-overlay'), creditsBtn = document.getElementById('credits-btn'), leaderboardBtn = document.getElementById('leaderboard-btn'), startGameLink = document.getElementById('start-game-btn'), marketBtn = document.getElementById('market-btn');
const userInfoDisplay = document.getElementById('user-info'), startGameBtnText = startGameLink.querySelector('span'), leaderboardContainer = document.getElementById('leaderboard-container'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), registerBtn = document.getElementById('register-btn'), loginBtn = document.getElementById('login-btn');
const marketBuyTab = document.getElementById('market-buy-tab'), marketSellTab = document.getElementById('market-sell-tab'), marketBuyView = document.getElementById('market-buy-view'), marketSellView = document.getElementById('market-sell-view');
adminKeyInput.addEventListener('input', (e) => { e.target.value === ADMIN_KEY ? adminPanel.classList.remove('hidden') : adminPanel.classList.add('hidden'); });
deleteDataBtn.addEventListener('click', () => { if (prompt(`ACCIÓN IRREVERSIBLE.\n\nEscribe: "${CONFIRM_DELETE_DATA}"`) === CONFIRM_DELETE_DATA) alert("Confirmación recibida.\nACCIÓN SIMULADA.\nEjecuta la Cloud Function 'deleteAllPlayerData'."); else alert("Confirmación incorrecta. Operación cancelada."); });
deleteAccountsBtn.addEventListener('click', () => { if (prompt(`MÁXIMA ALERTA.\n\nEscribe: "${CONFIRM_DELETE_ACCOUNTS}"`) === CONFIRM_DELETE_ACCOUNTS) alert("Confirmación final recibida.\nACCIÓN SIMULADA.\nEjecuta la Cloud Function 'deleteAllUsers'."); else alert("Confirmación incorrecta. Operación cancelada."); });
function showAuthError(message, type) { const element = type === 'login' ? loginErrorMsg : registerErrorMsg; element.textContent = message; element.style.display = 'block'; }
function clearAuthErrors() { loginErrorMsg.style.display = 'none'; registerErrorMsg.style.display = 'none'; }
function translateFirebaseError(error) { switch (error.code) { case 'auth/email-already-in-use': return 'Este correo ya está registrado.'; case 'auth/wrong-password': return 'Contraseña incorrecta.'; case 'auth/user-not-found': return 'No se encontró cuenta con este correo.'; case 'auth/invalid-email': return 'El correo no es válido.'; case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.'; default: return 'Ha ocurrido un error inesperado.'; } }
creditsBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(creditsModal); });
leaderboardBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(leaderboardModal); fetchAndDisplayLeaderboard(); });
allModals.forEach(modal => { const closeBtn = modal.querySelector('.close-btn'); if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal)); modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }); });
startGameLink.addEventListener('click', (e) => { e.preventDefault(); document.body.style.transition = 'opacity 1s ease-out'; document.body.style.opacity = '0'; setTimeout(() => { window.location.href = 'game.html'; }, 1000); });
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); clearAuthErrors(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });
registerBtn.addEventListener('click', () => { clearAuthErrors(); const username = document.getElementById('register-username').value, email = document.getElementById('register-email').value, password = document.getElementById('register-password').value; if (!username || !email || !password) { showAuthError("Todos los campos son obligatorios.", 'register'); return; } auth.createUserWithEmailAndPassword(email, password).then(cred => cred.user.updateProfile({ displayName: username })).then(() => closeModal(authModal)).catch(err => showAuthError(translateFirebaseError(err), 'register')); });
loginBtn.addEventListener('click', () => { clearAuthErrors(); const email = document.getElementById('login-email').value, password = document.getElementById('login-password').value; if (!email || !password) { showAuthError("Introduce correo y contraseña.", 'login'); return; } auth.signInWithEmailAndPassword(email, password).then(() => closeModal(authModal)).catch(err => showAuthError(translateFirebaseError(err), 'login')); });
auth.onAuthStateChanged(user => { if (user) { userInfoDisplay.textContent = user.displayName || user.email.split('@')[0]; userInfoDisplay.classList.remove('hidden'); authIconButton.innerHTML = iconLogout; authIconButton.title = "Cerrar Sesión"; authIconButton.onclick = () => { if (confirm('¿Seguro que quieres cerrar sesión?')) auth.signOut(); }; startGameBtnText.textContent = 'Continuar Partida'; fetchPlayerData(); } else { userInfoDisplay.classList.add('hidden'); authIconButton.innerHTML = iconLogin; authIconButton.title = "Iniciar Sesión / Perfil"; authIconButton.onclick = () => openModal(authModal); startGameBtnText.textContent = 'Iniciar Partida'; playerData = null; } });
marketBuyTab.addEventListener('click', () => { marketBuyTab.classList.add('active'); marketSellTab.classList.remove('active'); marketBuyView.classList.remove('hidden'); marketSellView.classList.add('hidden'); loadMarketplace(); });
marketSellTab.addEventListener('click', () => { marketSellTab.classList.add('active'); marketBuyTab.classList.remove('active'); marketSellView.classList.remove('hidden'); marketBuyView.classList.add('hidden'); loadPlayerModulesForSale(); });
async function fetchPlayerData() { if (!auth.currentUser) return; const doc = await db.collection('players').doc(auth.currentUser.uid).get(); if (doc.exists) playerData = doc.data(); }
async function loadMarketplace() { marketBuyView.innerHTML = "<p>Actualizando listados...</p>"; marketBuyView.innerHTML = `<p>El mercado está actualmente fuera de línea mientras se implementan las Cloud Functions de transacción segura.</p>`; }
function loadPlayerModulesForSale() { marketSellView.innerHTML = "<p>Cargando tu inventario de módulos...</p>"; if (!playerData || !playerData.modules || playerData.modules.length === 0) { marketSellView.innerHTML = "<p>No tienes módulos para vender. ¡Juega para encontrar algunos!</p>"; return; } marketSellView.innerHTML = playerData.modules.map(module => `<div class="market-item"><div class="item-rarity ${module.rarity}">${module.rarity}</div><div class="item-info"><h4>${module.name}</h4><p>${module.description}</p></div><form class="market-sell-form" onsubmit="postItemToMarket(event, '${module.id}')"><input type="number" placeholder="Precio" required min="1"><button type="submit" class="market-sell-btn">Vender</button></form></div>`).join(''); }
window.postItemToMarket = (event, moduleId) => { event.preventDefault(); alert("FUNCIONALIDAD EN DESARROLLO:\nSe requiere una Cloud Function 'postListing' para gestionar la venta de forma segura."); }
async function fetchAndDisplayLeaderboard() { leaderboardContainer.innerHTML = '<p>Cargando clasificación...</p>'; const user = auth.currentUser; try { const snapshot = await db.collection('leaderboard').orderBy('money', 'desc').limit(10).get(); if (snapshot.empty) { leaderboardContainer.innerHTML = '<p>Aún no hay nadie en la clasificación. ¡Sé el primero!</p>'; return; } let tableHTML = '<table class="leaderboard-table"><thead><tr><th class="rank">#</th><th class="name">Piloto</th><th class="score">Fortuna</th></tr></thead><tbody>'; let rank = 1; snapshot.forEach(doc => { const data = doc.data(); const isCurrentUser = user && doc.id === user.uid; tableHTML += `<tr class="${isCurrentUser ? 'current-player-row' : ''}"><td class="rank">${rank}</td><td class="name">${data.playerName}</td><td class="score">$${data.money.toLocaleString()}</td></tr>`; rank++; }); tableHTML += '</tbody></table>'; leaderboardContainer.innerHTML = tableHTML; } catch (error) { console.error("Error al obtener la clasificación: ", error); leaderboardContainer.innerHTML = '<p>Error al cargar la clasificación.</p>'; } }
});
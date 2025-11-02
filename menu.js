document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN DE FIREBASE ---
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
        console.log("MENÚ: MODO DE PRUEBA LOCAL DETECTADO.");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    let playerData = null;

    // --- SELECTORES GLOBALES ---
    const allModals = document.querySelectorAll('.modal-overlay:not(#gameplay-overlay)');
    const authModal = document.getElementById('auth-modal');
    const patrolBtn = document.getElementById('patrol-btn');
    const patrolMenuOverlay = document.getElementById('patrol-menu-overlay');
    const patrolMenuContainer = document.getElementById('patrol-menu-container');
    const startPatrolBtn = document.getElementById('start-patrol-btn');
    const hangarBtn = document.getElementById('hangar-btn');
    const exchangeBtn = document.getElementById('exchange-btn');
    const hangarView = document.getElementById('hangar-view');
    const exchangeView = document.getElementById('exchange-view');
    const gameplayOverlay = document.getElementById('gameplay-overlay');
    
    // --- LÓGICA DE MODALES ---
    function openModal(modal) { modal.classList.remove('hidden'); }
    function closeModal(modal) { modal.classList.add('hidden'); }
    allModals.forEach(modal => {
        modal.querySelector('.close-btn')?.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    });
    
    // --- AUTENTICACIÓN Y DATOS DE JUGADOR ---
    auth.onAuthStateChanged(async user => {
        const userInfoDisplay = document.getElementById('user-info');
        const authIconButton = document.getElementById('auth-icon-btn');
        const iconLogin = `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>`;
        const iconLogout = `<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>`;

        if (user) {
            userInfoDisplay.textContent = user.displayName || user.email.split('@')[0];
            userInfoDisplay.classList.remove('hidden');
            authIconButton.innerHTML = iconLogout;
            authIconButton.title = "Cerrar Sesión";
            authIconButton.onclick = () => { if (confirm('¿Seguro que quieres cerrar sesión?')) auth.signOut(); };
            await fetchPlayerData();
        } else {
            playerData = null;
            userInfoDisplay.classList.add('hidden');
            authIconButton.innerHTML = iconLogin;
            authIconButton.title = "Iniciar Sesión / Perfil";
            authIconButton.onclick = () => openModal(authModal);
        }
    });

    async function fetchPlayerData() {
        if (!auth.currentUser) return;
        const docRef = db.collection('players').doc(auth.currentUser.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            playerData = doc.data();
        } else {
            // Crear datos iniciales para un nuevo jugador
            playerData = { 
                money: 200, 
                pieces: 0, 
                components: 0,
                patrolShip: { speed: 5, fireRate: 30, damage: 1, maxHealth: 100, level: { speed: 1, fireRate: 1, damage: 1, maxHealth: 1 } },
                // ... otros datos por defecto del juego principal ...
            };
            await docRef.set(playerData);
        }
    }

    // --- LÓGICA DE NAVEGACIÓN DEL MENÚ DE PATRULLAJE ---
    patrolBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (auth.currentUser) {
            patrolMenuContainer.classList.remove('hidden');
            hangarView.classList.add('hidden');
            exchangeView.classList.add('hidden');
            openModal(patrolMenuOverlay);
        } else {
            alert("Debes iniciar sesión para acceder al sistema de Patrullaje.");
        }
    });

    const showView = (viewToShow) => {
        patrolMenuContainer.classList.add('hidden');
        [hangarView, exchangeView].forEach(v => v.classList.add('hidden'));
        viewToShow.classList.remove('hidden');
    };

    hangarBtn.addEventListener('click', () => { showView(hangarView); renderHangar(); });
    exchangeBtn.addEventListener('click', () => { showView(exchangeView); renderExchange(); });
    document.getElementById('back-to-patrol-menu-hangar').addEventListener('click', () => showView(patrolMenuContainer));
    document.getElementById('back-to-patrol-menu-exchange').addEventListener('click', () => showView(patrolMenuContainer));
    
    // --- LÓGICA DEL HANGAR ---
    function renderHangar() {
        if (!playerData) return;
        if (!playerData.patrolShip) {
            playerData.patrolShip = { speed: 5, fireRate: 30, damage: 1, maxHealth: 100, level: { speed: 1, fireRate: 1, damage: 1, maxHealth: 1 } };
        }
        const upgradesList = document.getElementById('hangar-upgrades-list');
        const ship = playerData.patrolShip;
        const costs = {
            speed: Math.floor(1000 * Math.pow(1.5, ship.level.speed - 1)),
            fireRate: Math.floor(1500 * Math.pow(1.6, ship.level.fireRate - 1)),
            damage: Math.floor(2000 * Math.pow(1.7, ship.level.damage - 1)),
            maxHealth: Math.floor(1200 * Math.pow(1.5, ship.level.maxHealth - 1))
        };

        upgradesList.innerHTML = `
            <div class="upgrade-item"><div class="upgrade-info"><h4>Velocidad (Nvl ${ship.level.speed})</h4><small>Movimiento más rápido.</small></div><button onclick="upgradeShipStat('speed', ${costs.speed})">Mejorar ($${costs.speed.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Cadencia (Nvl ${ship.level.fireRate})</h4><small>Dispara más rápido. (Valor bajo = mejor)</small></div><button onclick="upgradeShipStat('fireRate', ${costs.fireRate})">Mejorar ($${costs.fireRate.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Daño (Nvl ${ship.level.damage})</h4><small>Aumenta el daño por disparo.</small></div><button onclick="upgradeShipStat('damage', ${costs.damage})">Mejorar ($${costs.damage.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Blindaje (Nvl ${ship.level.maxHealth})</h4><small>Aumenta la vida máxima.</small></div><button onclick="upgradeShipStat('maxHealth', ${costs.maxHealth})">Mejorar ($${costs.maxHealth.toLocaleString()})</button></div>
        `;
    }

    window.upgradeShipStat = async (stat, cost) => {
        if (!playerData) return;
        if (playerData.money >= cost) {
            const ship = playerData.patrolShip;
            const updates = {
                money: firebase.firestore.FieldValue.increment(-cost),
                [`patrolShip.level.${stat}`]: firebase.firestore.FieldValue.increment(1)
            };
            if (stat === 'speed') updates['patrolShip.speed'] = firebase.firestore.FieldValue.increment(0.5);
            if (stat === 'fireRate') updates['patrolShip.fireRate'] = Math.max(5, ship.fireRate - 2);
            if (stat === 'damage') updates['patrolShip.damage'] = firebase.firestore.FieldValue.increment(1);
            if (stat === 'maxHealth') updates['patrolShip.maxHealth'] = firebase.firestore.FieldValue.increment(25);
            
            await db.collection('players').doc(auth.currentUser.uid).update(updates);
            await fetchPlayerData();
            renderHangar();
        } else {
            alert("Créditos insuficientes.");
        }
    };

    // --- LÓGICA DE INTERCAMBIO ---
    function renderExchange() {
        if (!playerData) return;
        playerData.pieces = playerData.pieces || 0;
        playerData.components = playerData.components || 0;
        document.getElementById('pieces-count').textContent = playerData.pieces.toLocaleString();
        document.getElementById('components-count').textContent = playerData.components.toLocaleString();
    }

    document.getElementById('exchange-pieces-btn').addEventListener('click', async () => {
        if (playerData && playerData.pieces >= 100) {
            await db.collection('players').doc(auth.currentUser.uid).update({
                pieces: firebase.firestore.FieldValue.increment(-100),
                components: firebase.firestore.FieldValue.increment(1)
            });
            await fetchPlayerData();
            renderExchange();
            alert("¡Has fabricado 1 Componente de Nave Avanzado!");
        } else {
            alert("No tienes suficientes piezas.");
        }
    });

    // --- LÓGICA DEL JUEGO DE PATRULLAJE ---
    const canvas = document.getElementById('patrol-game-canvas');
    const ctx = canvas.getContext('2d');
    let player, enemies, bullets, frameCount, piecesCollected, gameLoopId;

    startPatrolBtn.addEventListener('click', () => {
        closeModal(patrolMenuOverlay);
        gameplayOverlay.classList.remove('hidden');
        initPatrolGame();
    });

    document.getElementById('exit-patrol-btn').addEventListener('click', gameOver);

    function initPatrolGame() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const shipStats = playerData.patrolShip;

        player = {
            x: canvas.width / 2 - 25, y: canvas.height - 80, width: 50, height: 30, speed: shipStats.speed,
            fireRate: shipStats.fireRate, damage: shipStats.damage, maxHealth: shipStats.maxHealth, currentHealth: shipStats.maxHealth,
            targetX: canvas.width / 2 - 25,
            draw() {
                ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
                ctx.beginPath();
                ctx.moveTo(this.x + this.width / 2, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
            },
            update() {
                const dx = this.targetX - this.x;
                this.x += dx * 0.1; // Lerp para movimiento suave
            }
        };

        bullets = []; enemies = []; frameCount = 0; piecesCollected = 0;
        
        if (window.enemySpawnInterval) clearInterval(window.enemySpawnInterval);
        window.enemySpawnInterval = setInterval(spawnEnemy, 1500);
        gameLoop();
    }
    
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameCount++;

        player.update();
        player.draw();

        // Disparo automático
        if (frameCount % player.fireRate === 0) {
            bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 15, speed: 7 });
        }

        // Balas
        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.y -= b.speed;
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(b.x, b.y, b.width, b.height);
            if (b.y < 0) bullets.splice(i, 1);
        }

        // Enemigos
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            e.y += e.speed;
            ctx.fillStyle = '#ff4d4d'; ctx.fillRect(e.x, e.y, e.width, e.height);
            
            if (e.y > canvas.height) { enemies.splice(i, 1); continue; }

            // Colisión enemigo-jugador
            if (e.x < player.x + player.width && e.x + e.width > player.x && e.y < player.y + player.height && e.y + e.height > player.y) {
                enemies.splice(i, 1);
                player.currentHealth -= 20;
                if (player.currentHealth <= 0) { gameOver(); return; }
                continue;
            }

            // Colisión bala-enemigo
            for (let j = bullets.length - 1; j >= 0; j--) {
                let b = bullets[j];
                if (b.x < e.x + e.width && b.x + b.width > e.x && b.y < e.y + e.height && b.y + b.height > e.y) {
                    bullets.splice(j, 1);
                    e.health -= player.damage;
                    if (e.health <= 0) {
                        enemies.splice(i, 1);
                        piecesCollected += Math.floor(Math.random() * 3) + 1; // Gana de 1 a 3 piezas
                    }
                    break;
                }
            }
        }
        
        updateHUD();
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function spawnEnemy() {
        const size = 35;
        const x = Math.random() * (canvas.width - size);
        enemies.push({ x, y: -size, width: size, height: size, speed: 1 + Math.random() * 2, health: 3 });
    }

    function updateHUD() {
        document.getElementById('hud-health').querySelector('span').textContent = `${player.currentHealth}/${player.maxHealth}`;
        document.getElementById('hud-pieces').querySelector('span').textContent = piecesCollected;
    }

    async function gameOver() {
        clearInterval(window.enemySpawnInterval);
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        gameplayOverlay.classList.add('hidden');
        
        if (piecesCollected > 0) {
            await db.collection('players').doc(auth.currentUser.uid).update({
                pieces: firebase.firestore.FieldValue.increment(piecesCollected)
            });
            alert(`Patrullaje finalizado. Has recolectado ${piecesCollected} piezas.`);
            await fetchPlayerData();
        } else {
            alert("Patrullaje finalizado. No se recolectaron piezas.");
        }
    }

    // --- CONTROLES (MOUSE Y TÁCTIL) ---
    canvas.addEventListener('mousemove', e => { if(player) player.targetX = e.clientX - player.width / 2; });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if(player && e.touches.length > 0) player.targetX = e.touches[0].clientX - player.width / 2;
    }, { passive: false });
});
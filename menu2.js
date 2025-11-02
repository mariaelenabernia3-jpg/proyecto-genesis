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
        console.log("MENÚ 2: MODO DE PRUEBA LOCAL DETECTADO.");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    let playerData = null;

    // --- SELECTORES ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const patrolMenuView = document.getElementById('patrol-menu-view');
    const startPatrolBtn = document.getElementById('start-patrol-btn');
    const hangarBtn = document.getElementById('hangar-btn');
    const exchangeBtn = document.getElementById('exchange-btn');
    const hangarView = document.getElementById('hangar-view');
    const exchangeView = document.getElementById('exchange-view');
    const gameplayOverlay = document.getElementById('gameplay-overlay');

    // --- LÓGICA DE CARGA DE RECURSOS DEL JUEGO ---
    const playerImg = new Image();
    const enemyImg = new Image();
    const backgroundImg = new Image();
    let assetsLoaded = 0;
    const totalAssets = 3;

    startPatrolBtn.disabled = true;
    startPatrolBtn.querySelector('h3').textContent = 'Cargando Recursos...';

    function assetLoaded() {
        assetsLoaded++;
        if (assetsLoaded >= totalAssets) {
            console.log("Todos los recursos del juego han sido cargados.");
            startPatrolBtn.disabled = false;
            startPatrolBtn.querySelector('h3').textContent = 'Iniciar Patrullaje';
        }
    }
    
    function assetError(e) {
        console.error("No se pudo cargar un recurso del juego:", e.target.src);
        startPatrolBtn.querySelector('h3').textContent = 'Error al Cargar';
        alert(`Error: No se pudo cargar la imagen '${e.target.src}'. Revisa que el archivo exista en la carpeta 'assets' y que el nombre sea correcto. Presiona F12 para ver la consola.`);
    }

    playerImg.onload = assetLoaded;
    enemyImg.onload = assetLoaded;
    backgroundImg.onload = assetLoaded;
    
    playerImg.onerror = assetError;
    enemyImg.onerror = assetError;
    backgroundImg.onerror = assetError;

    playerImg.src = 'assets/nave.png';
    enemyImg.src = 'assets/Enemy.png';
    backgroundImg.src = 'assets/fondo1.png';

    // --- AUTENTICACIÓN Y CARGA DE DATOS ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            await fetchPlayerData();
            loadingOverlay.classList.remove('visible');
        } else {
            window.location.href = 'menu.html';
        }
    });

    async function fetchPlayerData() {
        if (!auth.currentUser) return;
        const docRef = db.collection('players').doc(auth.currentUser.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            playerData = doc.data();
            if (!playerData.patrolShip || !playerData.patrolShip.level) {
                await initializePatrolShip(docRef);
                const updatedDoc = await docRef.get();
                playerData = updatedDoc.data();
            }
        } else {
            await initializePatrolShip(docRef);
            const newDoc = await docRef.get();
            playerData = newDoc.data();
        }
    }

    async function initializePatrolShip(docRef) {
        await docRef.set({
            patrolShip: {
                speed: 5, fireRate: 30, damage: 1, maxHealth: 100,
                level: { speed: 1, fireRate: 1, damage: 1, maxHealth: 1 }
            },
            pieces: 0,
            components: 0,
            baseLevels: { Attacks: 0, Defenses: 0 }
        }, { merge: true });
    }

    // --- NAVEGACIÓN DEL MENÚ DE PATRULLAJE ---
    const showView = (viewToShow) => {
        patrolMenuView.classList.add('hidden');
        [hangarView, exchangeView].forEach(v => v.classList.add('hidden'));
        viewToShow.classList.remove('hidden');
    };
    hangarBtn.addEventListener('click', () => { showView(hangarView); renderHangar(); });
    exchangeBtn.addEventListener('click', () => { showView(exchangeView); renderExchange(); });
    document.getElementById('back-to-patrol-menu-hangar').addEventListener('click', () => showView(patrolMenuView));
    document.getElementById('back-to-patrol-menu-exchange').addEventListener('click', () => showView(patrolMenuView));

    // --- LÓGICA DEL HANGAR ---
    function renderHangar() {
        if (!playerData || !playerData.patrolShip) return;
        const upgradesList = document.getElementById('hangar-upgrades-list');
        const ship = playerData.patrolShip;
        const levels = ship.level;
        const costs = {
            speed: Math.floor(1000 * Math.pow(1.5, levels.speed - 1)),
            fireRate: Math.floor(1500 * Math.pow(1.6, levels.fireRate - 1)),
            damage: Math.floor(2000 * Math.pow(1.7, levels.damage - 1)),
            maxHealth: Math.floor(1200 * Math.pow(1.5, levels.maxHealth - 1))
        };
        upgradesList.innerHTML = `
            <div class="upgrade-item"><div class="upgrade-info"><h4>Velocidad (Nvl ${levels.speed})</h4><small>Movimiento más rápido.</small></div><button onclick="upgradeShipStat('speed', ${costs.speed})">Mejorar ($${costs.speed.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Cadencia (Nvl ${levels.fireRate})</h4><small>Dispara más rápido. (Valor bajo = mejor)</small></div><button onclick="upgradeShipStat('fireRate', ${costs.fireRate})">Mejorar ($${costs.fireRate.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Daño (Nvl ${levels.damage})</h4><small>Aumenta el daño por disparo.</small></div><button onclick="upgradeShipStat('damage', ${costs.damage})">Mejorar ($${costs.damage.toLocaleString()})</button></div>
            <div class="upgrade-item"><div class="upgrade-info"><h4>Blindaje (Nvl ${levels.maxHealth})</h4><small>Aumenta la vida máxima.</small></div><button onclick="upgradeShipStat('maxHealth', ${costs.maxHealth})">Mejorar ($${costs.maxHealth.toLocaleString()})</button></div>`;
    }

    window.upgradeShipStat = async (stat, cost) => {
        await fetchPlayerData();
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
        document.getElementById('pieces-count').textContent = (playerData.pieces || 0).toLocaleString();
        document.getElementById('components-count').textContent = (playerData.components || 0).toLocaleString();
    }
    document.getElementById('exchange-pieces-btn').addEventListener('click', async () => {
        await fetchPlayerData();
        if (playerData.pieces >= 100) {
            await db.collection('players').doc(auth.currentUser.uid).update({
                pieces: firebase.firestore.FieldValue.increment(-100),
                components: firebase.firestore.FieldValue.increment(1),
                'baseLevels.Attacks': firebase.firestore.FieldValue.increment(1),
                'baseLevels.Defenses': firebase.firestore.FieldValue.increment(1)
            });
            await fetchPlayerData();
            renderExchange();
            alert("¡Has fabricado 1 Componente Avanzado! Tus niveles de Ataque y Defensa de Base han mejorado permanentemente.");
        } else {
            alert("No tienes suficientes piezas.");
        }
    });

    // --- LÓGICA DEL JUEGO DE PATRULLAJE ---
    const canvas = document.getElementById('patrol-game-canvas');
    const ctx = canvas.getContext('2d');
    let player, enemies, bullets, enemyBullets, frameCount, piecesCollected, enemyLevel, gameLoopId;
    let bgY1, bgY2, bgSpeed = 1;
    const spawnRate = 90; 
    const maxEnemies = 12; 

    startPatrolBtn.addEventListener('click', () => {
        gameplayOverlay.classList.remove('hidden');
        initPatrolGame();
    });
    
    document.getElementById('exit-patrol-btn').addEventListener('click', () => gameOver(false));

    function initPatrolGame() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        backgroundImg.width = Math.max(canvas.width, backgroundImg.naturalWidth);
        const shipStats = playerData.patrolShip;
        player = {
            x: canvas.width / 2 - 35, y: canvas.height - 100, width: 70, height: 50,
            // --- CAMBIO: Añadidas propiedades de hitbox para colisiones más justas ---
            hitboxWidth: 50,  // ~25% más pequeño que el ancho de la imagen
            hitboxHeight: 38, // ~25% más pequeño que el alto de la imagen
            fireRate: shipStats.fireRate, damage: shipStats.damage,
            targetX: canvas.width / 2 - 35,
            draw() { ctx.drawImage(playerImg, this.x, this.y, this.width, this.height); },
            update() { this.x += (this.targetX - this.x) * 0.1; }
        };
        bullets = []; enemyBullets = []; enemies = [];
        frameCount = 0; piecesCollected = 0; enemyLevel = 1;
        gameLoopId = null;
        bgY1 = 0;
        bgY2 = -canvas.height;
        gameLoop();
    }
    
    function drawBackground() {
        bgY1 += bgSpeed;
        bgY2 += bgSpeed;
        ctx.drawImage(backgroundImg, 0, bgY1, canvas.width, canvas.height);
        ctx.drawImage(backgroundImg, 0, bgY2, canvas.width, canvas.height);
        if (bgY1 > canvas.height) bgY1 = bgY2 - canvas.height;
        if (bgY2 > canvas.height) bgY2 = bgY1 - canvas.height;
    }

    function gameLoop() {
        drawBackground();
        frameCount++;
        if (frameCount % spawnRate === 0 && enemies.length < maxEnemies) spawnEnemy();
        player.update();
        player.draw();
        if (frameCount % player.fireRate === 0) bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 15, speed: 7 });
        bullets.forEach((b, i) => { b.y -= b.speed; ctx.fillStyle = '#f1c40f'; ctx.fillRect(b.x, b.y, b.width, b.height); if (b.y < 0) bullets.splice(i, 1); });
        enemyBullets.forEach((b, i) => { b.y += b.speed; ctx.fillStyle = '#f96666'; ctx.fillRect(b.x, b.y, b.width, b.height); if (b.y > canvas.height) enemyBullets.splice(i, 1); });
        
        // Bucle para actualizar enemigos
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.x += e.speedX * e.direction;
            // --- CAMBIO: Los enemigos ahora se mueven hacia abajo ---
            e.y += e.speedY;

            if (e.x <= 0 || e.x + e.width >= canvas.width) e.direction *= -1;
            
            // --- CAMBIO: Eliminar enemigos si salen por abajo ---
            if (e.y > canvas.height) {
                enemies.splice(i, 1);
                continue; // Saltar al siguiente enemigo
            }
            
            ctx.drawImage(enemyImg, e.x, e.y, e.width, e.height);
            if (frameCount % e.fireRate === 0) enemyBullets.push({ x: e.x + e.width / 2 - 3, y: e.y + e.height, width: 6, height: 12, speed: e.bulletSpeed });

            for (let j = bullets.length - 1; j >= 0; j--) {
                if (bullets[j].x < e.x + e.width && bullets[j].x + bullets[j].width > e.x && bullets[j].y < e.y + e.height && bullets[j].y + bullets[j].height > e.y) {
                    bullets.splice(j, 1);
                    e.health -= player.damage;
                    if (e.health <= 0) {
                        enemies.splice(i, 1);
                        piecesCollected += Math.floor(Math.random() * 3) + enemyLevel;
                        enemyLevel++;
                    }
                    break;
                }
            }
        }

        // Bucle para colisiones con el jugador
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            let b = enemyBullets[i];
            // --- CAMBIO: La detección de colisión ahora usa el hitbox ajustado ---
            const hitboxX = player.x + (player.width - player.hitboxWidth) / 2;
            const hitboxY = player.y + (player.height - player.hitboxHeight) / 2;

            if (b.x < hitboxX + player.hitboxWidth &&
                b.x + b.width > hitboxX &&
                b.y < hitboxY + player.hitboxHeight &&
                b.y + b.height > hitboxY) {
                gameOver(true);
                return;
            }
        }

        updateHUD();
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function spawnEnemy() {
        const health = 5 + Math.floor(enemyLevel * 1.8);
        const speedX = 1 + enemyLevel * 0.2;
        const fireRate = Math.max(15, 70 - enemyLevel * 2.5);
        const bulletSpeed = 3 + enemyLevel * 0.3;
        const enemyWidth = 60;
        const enemyHeight = 45;
        const randomX = Math.random() * (canvas.width - enemyWidth);
        // --- CAMBIO: Añadida velocidad vertical para que se muevan hacia abajo ---
        const speedY = 1 + Math.random() * 1; // Velocidad vertical variable para más dinamismo

        enemies.push({ x: randomX, y: -50, width: enemyWidth, height: enemyHeight, health, speedX, speedY, direction: 1, fireRate, bulletSpeed });
    }

    function updateHUD() {
        document.getElementById('hud-health').style.display = 'none';
        document.getElementById('hud-pieces').querySelector('span').textContent = piecesCollected;
    }

    async function gameOver(wasKilled) {
        if (!gameLoopId) return;
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
        gameplayOverlay.classList.add('hidden');
        if (piecesCollected > 0) {
            await db.collection('players').doc(auth.currentUser.uid).update({ pieces: firebase.firestore.FieldValue.increment(piecesCollected) });
            if (wasKilled) alert(`¡Has sido derribado! Recolectaste ${piecesCollected} piezas.`);
            else alert(`Patrullaje abandonado. Aseguraste ${piecesCollected} piezas.`);
        } else {
            if (wasKilled) alert("¡Has sido derribado! No recolectaste ninguna pieza.");
            else alert("Patrullaje abandonado.");
        }
        await fetchPlayerData();
        showView(patrolMenuView);
    }

    canvas.addEventListener('mousemove', e => { if (player) player.targetX = e.clientX - player.width / 2; });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (player && e.touches.length > 0) player.targetX = e.touches[0].clientX - player.width / 2;
    }, { passive: false });
});
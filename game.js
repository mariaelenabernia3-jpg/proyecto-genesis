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
        console.log("JUEGO: MODO DE PRUEBA LOCAL DETECTADO. CONECTANDO A EMULADORES...");
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    const CONFIG = {
        MATERIALS: { Helium3: { name: "Helio-3", baseValue: 2 }, AsteroidOre: { name: "Mineral de Asteroide", baseValue: 8 }, IceCrystals: { name: "Cristales de Hielo", baseValue: 20 }, AlienArtifacts: { name: "Artefactos Alienígenas", baseValue: 100 } },
        PLANETS: { Terra: { name: "Terra", travelCost: 0 }, Mars: { name: "Marte", travelCost: 500 }, Europa: { name: "Europa", travelCost: 2500 }, Kepler186f: { name: "Kepler-186f", travelCost: 10000 }, ProximaCentauri: { name: "Proxima Centauri", travelCost: 50000, requiresMap: true } },
        UPGRADES: { Drones: { name: "Drones de Minería", cost: 25, baseProd: { Helium3: 0.5 } }, Frigates: { name: "Fragatas de Carga", cost: 200, baseProd: { AsteroidOre: 0.2 } }, IceDrills: { name: "Taladros Criogénicos", cost: 1000, baseProd: { IceCrystals: 0.1 } }, Scanners: { name: "Escáneres de Largo Alcance", cost: 5000, baseProd: { AlienArtifacts: 0.01 } } },
        MODULES: [
            { id: 'c01', name: 'Micro-Condensador', description: '+3% a las ganancias por ventas.', rarity: 'common', effect: { type: 'sell_all', value: 1.03 } },
            { id: 'c02', name: 'Algoritmo de Minería Simple', description: '+2% a la producción de todos los materiales.', rarity: 'common', effect: { type: 'prod_all', value: 1.02 } },
            { id: 'u01', name: 'Optimizador de Carga', description: '+7% a la producción de todos los materiales.', rarity: 'uncommon', effect: { type: 'prod_all', value: 1.07 } },
            { id: 'u02', name: 'Enfriador de Taladro Básico', description: '+15% a la producción de Cristales de Hielo.', rarity: 'uncommon', effect: { type: 'prod_single', material: 'IceCrystals', value: 1.15 } },
            { id: 'r01', name: 'IA de Logística Avanzada', description: 'Reduce el coste de desbloqueo de planetas en un 10%.', rarity: 'rare', effect: { type: 'travel_cost', value: 0.90 } },
            { id: 'r02', name: 'Software de Corretaje Avanzado', description: '+20% a las ganancias por ventas.', rarity: 'rare', effect: { type: 'sell_all', value: 1.20 } },
            { id: 'l01', name: 'Archivos de la Humanidad Perdida', planet: 'Terra', description: 'Antiguos datos terrestres. Otorga $10,000 créditos al instante.', rarity: 'legendary', effect: { type: 'grant_money', value: 10000 } },
            { id: 'l02', name: 'Corazón de Forja Marciano', planet: 'Mars', description: 'Un núcleo de energía de antiguas forjas. +200% a la producción de Mineral de Asteroide.', rarity: 'legendary', effect: { type: 'prod_single', material: 'AsteroidOre', value: 3.0 } },
            { id: 'l03', name: 'Matriz Geotérmica', planet: 'Europa', description: 'Tecnología para licuar lunas heladas. +200% a la producción de Cristales de Hielo.', rarity: 'legendary', effect: { type: 'prod_single', material: 'IceCrystals', value: 3.0 } },
            { id: 'l04', name: 'Núcleo de Singularidad', planet: 'Kepler186f', description: 'Un objeto de poder incomprensible. Duplica todas las ganancias por ventas.', rarity: 'legendary', effect: { type: 'sell_all', value: 2.0 } },
            { id: 'l05', name: 'Esquema de Dron de Combate', source: 'pvp', description: 'Desbloquea la capacidad de construir drones de ataque en tu base.', rarity: 'legendary', effect: { type: 'unlock_pvp_unit' } }
        ],
        PLANET_ECONOMIES: { Terra: { Helium3: 1.1, AsteroidOre: 0.9, IceCrystals: 0.8, AlienArtifacts: 0.7 }, Mars: { Helium3: 0.8, AsteroidOre: 1.5, IceCrystals: 1.0, AlienArtifacts: 0.9 }, Europa: { Helium3: 1.6, AsteroidOre: 0.7, IceCrystals: 1.4, AlienArtifacts: 1.1 }, Kepler186f: { Helium3: 1.0, AsteroidOre: 1.2, IceCrystals: 1.3, AlienArtifacts: 2.0 } }
    };
    
    let gameState = {};
    let marketPrices = {};
    const moneyCountEl = document.getElementById('money-count'), 
          planetNameEl = document.getElementById('planet-name'), 
          inventoryListEl = document.getElementById('inventory-list'), 
          modulesListEl = document.getElementById('modules-list'), 
          upgradesListEl = document.getElementById('upgrades-list'), 
          marketListEl = document.getElementById('market-list'), 
          travelListEl = document.getElementById('travel-list'), 
          loadingOverlay = document.getElementById('loading-overlay'),
          travelOverlay = document.getElementById('travel-overlay'),
          notificationsListEl = document.getElementById('notifications-list');

    let saveTimeout;
    function requestSave() { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveGame, 2000); }
    function saveGame() { 
        const user = auth.currentUser;
        if (user && typeof gameState.money !== 'undefined') {
            db.collection('players').doc(user.uid).set(gameState, { merge: true });
            const playerName = user.displayName || user.email.split('@')[0];
            db.collection('leaderboard').doc(user.uid).set({ playerName: playerName, money: Math.floor(gameState.money) }, { merge: true });
        }
    }

    function getDefaultState() { return { money: 200, currentPlanet: 'Terra', inventory: Object.keys(CONFIG.MATERIALS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}), upgradeLevels: Object.keys(CONFIG.UPGRADES).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}), modules: [], unlockedPlanets: ['Terra'], lastLogin: null, achievedMissions: [], completedMissions: [], dailyMissionProgress: {}, completedDailyMissions: [], baseLevels: { Defenses: 0, Attacks: 0 }, notifications: [], alliance: null }; }
    
    function addNotification(message, type = 'info') {
        if (!gameState.notifications) gameState.notifications = [];
        gameState.notifications.push({ message, type, date: new Date().toISOString() });
        if (gameState.notifications.length > 50) gameState.notifications.shift();
    }

    function showFloatingText(text, element, color) {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const floatingText = document.createElement('div');
        floatingText.textContent = text;
        floatingText.className = 'floating-text';
        Object.assign(floatingText.style, { left: `${x}px`, top: `${y}px`, color: color });
        document.body.appendChild(floatingText);
        setTimeout(() => floatingText.remove(), 1500);
    }
    
    function updateUI() {
        if (typeof gameState.money === 'undefined') return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        planetNameEl.textContent = CONFIG.PLANETS[gameState.currentPlanet].name;
        inventoryListEl.innerHTML = Object.entries(gameState.inventory).map(([key, value]) => `<div class="resource-line"><span class="item-name">${CONFIG.MATERIALS[key].name}</span><span class="item-details">${Math.floor(value).toLocaleString()}</span></div>`).join('') || "<p>Bodega de carga vacía.</p>";
        upgradesListEl.innerHTML = Object.entries(gameState.upgradeLevels).map(([key, level]) => { const upgrade = CONFIG.UPGRADES[key]; const cost = Math.ceil(upgrade.cost * Math.pow(1.15, level)); return `<div class="resource-line"><div class="item-name">${upgrade.name} (Nvl ${level})</div><button onclick="buyUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled' : ''}">Coste: ${cost.toLocaleString()}</button></div>`; }).join('');
        
        if (marketPrices && marketPrices[gameState.currentPlanet]) {
            marketListEl.innerHTML = Object.entries(CONFIG.MATERIALS).map(([key, material]) => {
                const modifier = marketPrices[gameState.currentPlanet][key];
                const price = material.baseValue * modifier;
                const hasMaterial = gameState.inventory[key] >= 1;
                const amountOwned = Math.floor(gameState.inventory[key]);
                const totalValue = Math.floor(price * amountOwned);
                return `<div class="resource-line"><div class="item-name">${material.name}<div class="item-details"><span>Precio: $${price.toFixed(2)}</span></div></div><div class="button-group"><button onclick="sellMaterial(event, '${key}', 1)" class="sell-btn ${!hasMaterial ? 'disabled' : ''}">Vender 1</button><button onclick="sellMaterial(event, '${key}', 'all')" class="sell-all-btn ${!hasMaterial ? 'disabled' : ''}">Vender Todo ($${totalValue.toLocaleString()})</button></div></div>`;
            }).join('');
        } else {
            marketListEl.innerHTML = "<p>Sincronizando con la red de mercados...</p>";
        }

        travelListEl.innerHTML = Object.entries(CONFIG.PLANETS).map(([key, planet]) => { 
            if (planet.requiresMap && !(gameState.modules || []).some(m => m.effect.type === 'unlock_planet' && m.effect.planet === key)) return '';
            const isUnlocked = gameState.unlockedPlanets.includes(key); 
            let travelCost = planet.travelCost;
            (gameState.modules || []).forEach(m => { if (m.effect.type === 'travel_cost') travelCost *= m.effect.value; });
            const cost = Math.ceil(travelCost); 
            return `<button onclick="travelToPlanet('${key}')" class="travel-btn ${gameState.currentPlanet === key ? 'disabled' : ''}">${isUnlocked ? `Viajar a ${planet.name}` : `Desbloquear ruta a ${planet.name} <span class='travel-cost'>($${cost.toLocaleString()})</span>`}</button>`; 
        }).join('');
        
        modulesListEl.innerHTML = (gameState.modules || []).map(module => `<div class="resource-line module-item"><div class="module-info"><h4 class="item-rarity ${module.rarity}">${module.name}</h4><p>${module.description}</p></div></div>`).join('') || "<p>No hay módulos instalados.</p>";
        notificationsListEl.innerHTML = (gameState.notifications || []).slice(-10).reverse().map(n => `<div class="notification-item type-${n.type}">${n.message}</div>`).join('') || "<p>Sin sucesos recientes.</p>";
    }

    window.sellMaterial = (event, key, amount) => {
        let amountToSell = (amount === 'all') ? Math.floor(gameState.inventory[key]) : parseInt(amount, 10);
        if (gameState.inventory[key] >= amountToSell && amountToSell > 0) {
            const material = CONFIG.MATERIALS[key];
            const modifier = marketPrices[gameState.currentPlanet]?.[key] || 1;
            let price = material.baseValue * modifier;
            (gameState.modules || []).forEach(m => { if (m.effect.type === 'sell_all') price *= m.effect.value; });
            const earnings = price * amountToSell;

            // ===== LÍNEA DE CONFIRMACIÓN ELIMINADA =====
            // if (amount === 'all' && !confirm(`¿Vender...`)) return;
            
            gameState.inventory[key] -= amountToSell;
            gameState.money += earnings;
            
            showFloatingText(`+$${Math.floor(earnings).toLocaleString()}`, event.target, 'var(--accent-sell)');

            if (!gameState.dailyMissionProgress) gameState.dailyMissionProgress = {};
            gameState.dailyMissionProgress[`sell_${key}`] = (gameState.dailyMissionProgress[`sell_${key}`] || 0) + amountToSell;
            gameState.dailyMissionProgress['earn'] = (gameState.dailyMissionProgress['earn'] || 0) + earnings;
            if (Math.random() < 1 / 250) { findModule('sell'); }
            requestSave();
        }
    };

    window.buyUpgrade = (key) => { const upgrade = CONFIG.UPGRADES[key]; const cost = Math.ceil(upgrade.cost * Math.pow(1.15, (gameState.upgradeLevels[key] || 0))); if (gameState.money >= cost) { gameState.money -= cost; gameState.upgradeLevels[key]++; requestSave(); } };
    
    window.travelToPlanet = (key) => {
        if (gameState.currentPlanet === key) return;
        const travelAction = () => {
            travelOverlay.classList.remove('hidden');
            setTimeout(() => travelOverlay.classList.add('visible'), 10);
            setTimeout(() => {
                gameState.currentPlanet = key;
                requestSave();
                updateUI();
                travelOverlay.classList.remove('visible');
                setTimeout(() => travelOverlay.classList.add('hidden'), 500);
            }, 2500);
        };
        const isUnlocked = gameState.unlockedPlanets.includes(key);
        if (isUnlocked) {
            travelAction();
        } else {
            let travelCost = CONFIG.PLANETS[key].travelCost;
            (gameState.modules || []).forEach(m => { if (m.effect.type === 'travel_cost') travelCost *= m.effect.value; });
            const cost = Math.ceil(travelCost);
            if (gameState.money >= cost) {
                if (confirm(`¿Desbloquear la ruta a ${CONFIG.PLANETS[key].name} por $${cost.toLocaleString()}?`)) {
                    gameState.money -= cost;
                    gameState.unlockedPlanets.push(key);
                    if (!gameState.achievedMissions.includes('M03') && key === 'Mars') {
                        gameState.achievedMissions.push('M03');
                        addNotification('Misión: Objetivo "Viajero Frecuente" completado.', 'reward');
                    }
                    travelAction();
                }
            } else {
                alert(`Créditos insuficientes para desbloquear esta ruta. Necesitas $${cost.toLocaleString()}.`);
            }
        }
    };

    function findModule(source) {
        const roll = Math.random() * 10000;
        let foundModule = null;
        if (source === 'production') {
            if (roll < 20) { foundModule = CONFIG.MODULES.find(m => m.id === 'u01'); } 
            else if (roll < 520) { foundModule = CONFIG.MODULES.find(m => m.id === 'c02'); }
        } else if (source === 'sell') {
            if (roll < 20) { foundModule = CONFIG.MODULES.find(m => m.id === 'r02'); } 
            else if (roll < 120) { foundModule = CONFIG.MODULES.find(m => m.id === 'u02'); }
            else if (roll < 820) { foundModule = CONFIG.MODULES.find(m => m.id === 'c01'); }
        }
        if (foundModule) {
            const newModule = { ...foundModule, id: `mod_${Date.now()}` };
            if (!gameState.modules) gameState.modules = [];
            gameState.modules.push(newModule);
            addNotification(`Módulo Encontrado: ${newModule.name} (${newModule.rarity})`, 'reward');
            requestSave();
        }
    }

    function checkForPlanetArtifact(planetKey) {
        const PLANET_ARTIFACT_CHANCE = 1 / 50000;
        if (Math.random() < PLANET_ARTIFACT_CHANCE) {
            const planetArtifact = CONFIG.MODULES.find(m => m.planet === planetKey);
            if (planetArtifact && !(gameState.modules || []).some(m => m.id === planetArtifact.id)) {
                const newModule = { ...planetArtifact, id: `mod_${Date.now()}` };
                if (!gameState.modules) gameState.modules = [];
                gameState.modules.push(newModule);
                addNotification(`¡Hallazgo Legendario en ${CONFIG.PLANETS[planetKey].name}: ${newModule.name}!`, 'reward');
                if (newModule.effect.type === 'grant_money') { gameState.money += newModule.effect.value; }
                requestSave();
            }
        }
    }
    
    function calculateProduction() { const production = {}; for (const key in CONFIG.UPGRADES) { const upgrade = CONFIG.UPGRADES[key]; const level = gameState.upgradeLevels[key] || 0; if (level > 0) { for (const material in upgrade.baseProd) { production[material] = (production[material] || 0) + (upgrade.baseProd[material] * level); } } } (gameState.modules || []).forEach(module => { if (module.effect.type === 'prod_all') { for (const mat in production) { production[mat] *= module.effect.value; } } else if (module.effect.type === 'prod_single') { if (production[module.effect.material]) { production[module.effect.material] *= module.effect.value; } } }); return production; }
    
    function gameLoop() {
        const production = calculateProduction();
        for (const material in production) { gameState.inventory[material] += production[material] / 10; }
        if (Math.random() < 1 / 500) { findModule('production'); }
        let artifactProduction = (production['AlienArtifacts'] || 0);
        if (artifactProduction > 0 && Math.random() < (artifactProduction / 10)) { checkForPlanetArtifact(gameState.currentPlanet); }
        updateUI();
    }
    
    auth.onAuthStateChanged(user => {
        if (user) {
            initializeGame();
        } else {
            window.location.href = 'menu.html';
        }
    });

    async function initializeGame() {
        await Promise.all([ loadGame(), loadInitialMarketPrices() ]);
        updateUI();
        setInterval(gameLoop, 100);
        setInterval(requestSave, 15000);
        window.addEventListener('beforeunload', saveGame);
        listenForMarketUpdates();
        loadingOverlay.classList.remove('visible');
    }

    async function loadGame() {
        const user = auth.currentUser;
        if (!user) { gameState = getDefaultState(); return; }
        const docRef = db.collection('players').doc(user.uid);
        const doc = await docRef.get();
        gameState = doc.exists ? { ...getDefaultState(), ...doc.data() } : getDefaultState();
    }
    
    async function loadInitialMarketPrices() {
        try {
            const doc = await db.collection('marketState').doc('globalPrices').get();
            if (doc.exists && Object.keys(doc.data()).length > 0) {
                marketPrices = doc.data();
            } else {
                throw new Error("Documento de precios no existe o está vacío.");
            }
        } catch (error) {
            console.warn("Precios del servidor no encontrados. Usando economías base por defecto como fallback.", error);
            marketPrices = CONFIG.PLANET_ECONOMIES;
        }
    }

    function listenForMarketUpdates() {
        db.collection('marketState').doc('globalPrices').onSnapshot((doc) => {
            if (doc.exists && Object.keys(doc.data()).length > 0) {
                marketPrices = doc.data();
            }
        });
    }
});
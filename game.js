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
        auth.useEmulator("http://localhost:9099");
        db.useEmulator("localhost", 8080);
    }

    const CONFIG = {
        MATERIALS: { Helium3: { name: "Helio-3", baseValue: 10 }, AsteroidOre: { name: "Mineral de Asteroide", baseValue: 25 }, IceCrystals: { name: "Cristales de Hielo", baseValue: 60 }, AlienArtifacts: { name: "Artefactos Alienígenas", baseValue: 250 } },
        PLANETS: { 
            Terra: { name: "Terra", travelCost: 0 }, 
            Mars: { name: "Marte", travelCost: 1000 }, 
            Europa: { name: "Europa", travelCost: 5000 }, 
            Kepler186f: { name: "Kepler-186f", travelCost: 25000 }
        },
        UPGRADES: { Drones: { name: "Drones de Minería", cost: 50, baseProd: { Helium3: 0.5 } }, Frigates: { name: "Fragatas de Carga", cost: 500, baseProd: { AsteroidOre: 0.2 } }, IceDrills: { name: "Taladros Criogénicos", cost: 2500, baseProd: { IceCrystals: 0.1 } }, Scanners: { name: "Escáneres de Largo Alcance", cost: 15000, baseProd: { AlienArtifacts: 0.01 } } },
        MODULES: [
            { id: 'm01', name: 'Optimizador de Minería Básico', description: '+5% a la producción.', rarity: 'common', effect: { type: 'prod_all', value: 1.05 } },
            { id: 'm02', name: 'Software de Corretaje', description: '+10% a las ventas.', rarity: 'rare', effect: { type: 'sell_all', value: 1.10 } },
            { id: 'm03', name: 'Extractor de Helio Cuántico', description: '+100% a la producción de Helio-3.', rarity: 'rare', effect: { type: 'prod_single', material: 'Helium3', value: 2.0 } },
            { id: 'm04', name: 'Fragmento de Nave Legendaria', description: '+25% a toda la producción.', rarity: 'legendary', effect: { type: 'prod_all', value: 1.25 } },
            { id: 's01', name: 'Núcleo de Singularidad', description: 'Un objeto de poder incomprensible. +100% a la fortuna total obtenida por ventas.', rarity: 'legendary', effect: { type: 'sell_all', value: 2.0 } }
        ]
    };
    
    let gameState = {};
    let marketPrices = {};
    const moneyCountEl = document.getElementById('money-count'), planetNameEl = document.getElementById('planet-name'), inventoryListEl = document.getElementById('inventory-list'), modulesListEl = document.getElementById('modules-list'), upgradesListEl = document.getElementById('upgrades-list'), marketListEl = document.getElementById('market-list'), travelListEl = document.getElementById('travel-list'), loadingOverlay = document.getElementById('loading-overlay');

    let saveTimeout;
    function requestSave() { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveGame, 2000); }
    function saveGame() { const user = auth.currentUser; if (user && typeof gameState.money !== 'undefined') { db.collection('players').doc(user.uid).set(gameState, { merge: true }); const playerName = user.displayName || user.email.split('@')[0]; db.collection('leaderboard').doc(user.uid).set({ playerName: playerName, money: Math.floor(gameState.money) }, { merge: true }); } }

    function getDefaultState() { return { money: 100, currentPlanet: 'Terra', inventory: Object.keys(CONFIG.MATERIALS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}), upgradeLevels: Object.keys(CONFIG.UPGRADES).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}), modules: [], unlockedPlanets: ['Terra'], lastLogin: null, achievedMissions: [], completedMissions: [] }; }
    
    function updateUI() {
        if (typeof gameState.money === 'undefined' || Object.keys(marketPrices).length === 0) return;
        moneyCountEl.textContent = Math.floor(gameState.money).toLocaleString();
        planetNameEl.textContent = CONFIG.PLANETS[gameState.currentPlanet].name;
        inventoryListEl.innerHTML = Object.entries(gameState.inventory).map(([key, value]) => `<div class="resource-line"><span class="item-name">${CONFIG.MATERIALS[key].name}</span><span class="item-details">${Math.floor(value).toLocaleString()}</span></div>`).join('') || "<p>Bodega de carga vacía.</p>";
        upgradesListEl.innerHTML = Object.entries(gameState.upgradeLevels).map(([key, level]) => { const upgrade = CONFIG.UPGRADES[key]; const cost = Math.ceil(upgrade.cost * Math.pow(1.15, level)); return `<div class="resource-line"><div class="item-name">${upgrade.name} (Nvl ${level})</div><button onclick="buyUpgrade('${key}')" class="upgrade-btn ${gameState.money < cost ? 'disabled' : ''}">Coste: ${cost.toLocaleString()}</button></div>`; }).join('');
        marketListEl.innerHTML = Object.entries(CONFIG.MATERIALS).map(([key, material]) => { const modifier = marketPrices[gameState.currentPlanet][key]; const price = material.baseValue * modifier; const hasMaterial = gameState.inventory[key] >= 1; return `<div class="resource-line"><div class="item-name">${material.name}<div class="item-details"><span>Precio: $${price.toFixed(2)}</span></div></div><div class="button-group"><button onclick="sellMaterial('${key}', 1)" class="sell-btn ${!hasMaterial ? 'disabled' : ''}">Vender 1</button><button onclick="sellMaterial('${key}', 'all')" class="sell-all-btn ${!hasMaterial ? 'disabled' : ''}">Vender Todo</button></div></div>`; }).join('');
        travelListEl.innerHTML = Object.entries(CONFIG.PLANETS).map(([key, planet]) => { const isUnlocked = gameState.unlockedPlanets.includes(key); const cost = planet.travelCost; return `<button onclick="travelToPlanet('${key}')" class="travel-btn ${gameState.currentPlanet === key ? 'disabled' : ''}">${isUnlocked ? `Viajar a ${planet.name}` : `Desbloquear ruta a ${planet.name} <span class='travel-cost'>($${cost.toLocaleString()})</span>`}</button>`; }).join('');
        modulesListEl.innerHTML = gameState.modules.map(module => `<div class="resource-line module-item"><div class="module-info"><h4 class="item-rarity ${module.rarity}">${module.name}</h4><p>${module.description}</p></div></div>`).join('') || "<p>No hay módulos instalados.</p>";
    }

    window.sellMaterial = (key, amount) => { let amountToSell = (amount === 'all') ? Math.floor(gameState.inventory[key]) : parseInt(amount, 10); if (gameState.inventory[key] >= amountToSell && amountToSell > 0) { const material = CONFIG.MATERIALS[key]; const modifier = marketPrices[gameState.currentPlanet][key]; let price = material.baseValue * modifier; gameState.modules.forEach(m => { if (m.effect.type === 'sell_all') price *= m.effect.value; }); gameState.inventory[key] -= amountToSell; gameState.money += price * amountToSell; requestSave(); } };
    window.buyUpgrade = (key) => { const upgrade = CONFIG.UPGRADES[key]; const cost = Math.ceil(upgrade.cost * Math.pow(1.15, gameState.upgradeLevels[key])); if (gameState.money >= cost) { gameState.money -= cost; gameState.upgradeLevels[key]++; requestSave(); } };
    
    window.travelToPlanet = (key) => {
        if (gameState.currentPlanet === key) return;
        const isUnlocked = gameState.unlockedPlanets.includes(key);
        if (isUnlocked) {
            gameState.currentPlanet = key;
            requestSave();
        } else {
            const cost = CONFIG.PLANETS[key].travelCost;
            if (gameState.money >= cost) {
                gameState.money -= cost;
                gameState.unlockedPlanets.push(key);
                gameState.currentPlanet = key;
                if (!gameState.achievedMissions.includes('M03') && key === 'Mars') {
                    gameState.achievedMissions.push('M03');
                    alert(`¡Misión Actualizada! Has completado el objetivo de "Viajero Frecuente". ¡Ve al panel de misiones para reclamar tu recompensa!`);
                }
                requestSave();
            } else {
                alert(`Créditos insuficientes para desbloquear esta ruta. Necesitas $${cost.toLocaleString()}.`);
            }
        }
    };

    function checkForModuleDrop(materialKey) {
        if (materialKey !== 'AlienArtifacts') return;
        const SINGULARITY_CHANCE = 1 / 10000;
        if (Math.random() < SINGULARITY_CHANCE) {
            const singularityCore = CONFIG.MODULES.find(m => m.id === 's01');
            const newModule = { ...singularityCore, id: `mod_${Date.now()}` };
            gameState.modules.push(newModule);
            alert(`\n\n¡¡¡HALLAZGO TRASCENDENTAL!!!\n\nEntre los restos de un artefacto, has encontrado un ${newModule.name}. Este objeto es de un valor incalculable.\n\n`);
            requestSave();
            return;
        }
        const dropChance = 1 / 500;
        if (Math.random() < dropChance) {
            const regularModules = CONFIG.MODULES.filter(m => m.id !== 's01');
            const randomModule = regularModules[Math.floor(Math.random() * regularModules.length)];
            const newModule = { ...randomModule, id: `mod_${Date.now()}` };
            gameState.modules.push(newModule);
            alert(`¡Descubrimiento Afortunado!\n\nHas encontrado un módulo de nave: ${newModule.name} (${newModule.rarity})`);
            requestSave();
        }
    }
    
    function calculateProduction() {
        const production = {};
        for (const key in CONFIG.UPGRADES) {
            const upgrade = CONFIG.UPGRADES[key];
            const level = gameState.upgradeLevels[key];
            if (level > 0) {
                for (const material in upgrade.baseProd) {
                    production[material] = (production[material] || 0) + (upgrade.baseProd[material] * level);
                }
            }
        }
        gameState.modules.forEach(module => {
            if (module.effect.type === 'prod_all') {
                for (const mat in production) { production[mat] *= module.effect.value; }
            } else if (module.effect.type === 'prod_single') {
                if (production[module.effect.material]) { production[module.effect.material] *= module.effect.value; }
            }
        });
        return production;
    }

    function gameLoop() {
        const production = calculateProduction();
        let artifactProductionPerTick = (production['AlienArtifacts'] || 0) / 10;
        if(artifactProductionPerTick > 0){
            for(let i = 0; i < Math.floor(artifactProductionPerTick); i++){
                checkForModuleDrop('AlienArtifacts');
            }
             if(Math.random() < (artifactProductionPerTick - Math.floor(artifactProductionPerTick))){
                checkForModuleDrop('AlienArtifacts');
            }
        }
        for (const material in production) {
            gameState.inventory[material] += production[material] / 10;
        }
        updateUI();
    }
    
    async function loadGame() {
        const user = auth.currentUser;
        if (!user) { gameState = getDefaultState(); loadingOverlay.classList.add('hidden'); return; }
        const docRef = db.collection('players').doc(user.uid);
        const doc = await docRef.get();
        gameState = doc.exists ? { ...getDefaultState(), ...doc.data() } : getDefaultState();
        if (!gameState.modules) gameState.modules = [];
        if (!gameState.unlockedPlanets) gameState.unlockedPlanets = ['Terra'];
        if (!gameState.achievedMissions) gameState.achievedMissions = [];
        if (!gameState.completedMissions) gameState.completedMissions = [];
        loadingOverlay.classList.add('hidden');
    }

    db.collection('marketState').doc('globalPrices').onSnapshot((doc) => {
        if (doc.exists) {
            marketPrices = doc.data();
            console.log("Precios del mercado actualizados en tiempo real.");
        } else {
            console.log("No se encontraron precios de mercado. Asegúrate de haber desplegado la Cloud Function.");
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) { loadGame(); } 
        else { window.location.href = 'menu.html'; }
    });

    setInterval(gameLoop, 100);
    setInterval(requestSave, 15000);
    window.addEventListener('beforeunload', saveGame);
});
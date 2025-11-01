const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

/**
 * Procesa un ataque de un jugador a otro de forma segura en el servidor.
 */
exports.attackPlayer = functions.https.onCall(async (data, context) => {
  // 1. Verificación de seguridad: ¿El que llama está conectado?
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes estar conectado para atacar.');
  }
  
  const attackerId = context.auth.uid;
  const defenderId = data.targetId;

  if (attackerId === defenderId) {
    throw new functions.https.HttpsError('invalid-argument', 'No te puedes atacar a ti mismo.');
  }

  // 2. Transacción: O todo se ejecuta, o nada se ejecuta. Evita errores a mitad.
  return db.runTransaction(async (transaction) => {
    const attackerRef = db.collection('players').doc(attackerId);
    const defenderRef = db.collection('players').doc(defenderId);
    
    // 3. Obtener los datos reales y seguros desde la base de datos
    const [attackerDoc, defenderDoc] = await transaction.getAll(attackerRef, defenderRef);

    if (!attackerDoc.exists || !defenderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Uno de los jugadores no existe.');
    }

    const attackerData = attackerDoc.data();
    const defenderData = defenderDoc.data();

    // 4. Calcular el poder real de cada jugador desde los datos del servidor
    const attackerPower = (attackerData.baseLevels && attackerData.baseLevels.Attacks) || 0;
    const defenderPower = (defenderData.baseLevels && defenderData.baseLevels.Defenses) || 0;

    // 5. Lógica de Combate: Se calcula aquí, en el servidor, de forma 100% segura
    const attackRoll = attackerPower * (Math.random() * 0.4 + 0.8); // +/- 20% de aleatoriedad
    const defenseRoll = defenderPower * (Math.random() * 0.4 + 0.8);

    const notification = {
      id: `notif_${Date.now()}`,
      read: false,
      timestamp: new Date().toISOString()
    };

    if (attackRoll > defenseRoll) {
      // VICTORIA DEL ATACANTE
      const maxLoot = defenderData.money * 0.10; // Puede robar hasta el 10% del dinero del defensor
      const loot = Math.floor(Math.random() * maxLoot);

      // 6. Actualizar la base de datos de forma segura
      transaction.update(attackerRef, { money: admin.firestore.FieldValue.increment(loot) });
      transaction.update(defenderRef, { 
        money: admin.firestore.FieldValue.increment(-loot),
        notifications: admin.firestore.FieldValue.arrayUnion({
          ...notification,
          type: 'defense_loss',
          message: `¡Tu base fue atacada por ${attackerData.playerName || 'un desconocido'}! Perdiste $${loot.toLocaleString()} créditos.`
        })
      });
      
      // 7. Devolver el resultado al cliente
      return { success: true, message: `¡Victoria! Has saqueado $${loot.toLocaleString()} créditos.` };
    } else {
      // DERROTA DEL ATACANTE
      transaction.update(defenderRef, {
        notifications: admin.firestore.FieldValue.arrayUnion({
          ...notification,
          type: 'defense_win',
          message: `¡Tu base repelió un ataque de ${attackerData.playerName || 'un desconocido'}!`
        })
      });
      
      return { success: false, message: "¡Derrota! Tus flotas no pudieron superar sus defensas." };
    }
  });
});
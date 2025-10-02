"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredData = exports.onAllocationChange = exports.suggestResourceAllocation = exports.calculateUserWorkload = exports.repairUserIds = exports.cleanupOrphanUser = exports.cleanAuthUser = exports.updateUserLogin = exports.createUserWithLogin = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Import de la fonction de création d'utilisateur
var createUser_1 = require("./createUser");
Object.defineProperty(exports, "createUserWithLogin", { enumerable: true, get: function () { return createUser_1.createUserWithLogin; } });
// Import de la fonction de modification du login
var updateUserLogin_1 = require("./updateUserLogin");
Object.defineProperty(exports, "updateUserLogin", { enumerable: true, get: function () { return updateUserLogin_1.updateUserLogin; } });
// Import de la fonction de nettoyage auth
var cleanAuthUser_1 = require("./cleanAuthUser");
Object.defineProperty(exports, "cleanAuthUser", { enumerable: true, get: function () { return cleanAuthUser_1.cleanAuthUser; } });
// Import de la fonction de nettoyage d'utilisateur orphelin
var cleanupOrphanUser_1 = require("./cleanupOrphanUser");
Object.defineProperty(exports, "cleanupOrphanUser", { enumerable: true, get: function () { return cleanupOrphanUser_1.cleanupOrphanUser; } });
// Import de la fonction de réparation des IDs utilisateurs
var repairUserIds_1 = require("./repairUserIds");
Object.defineProperty(exports, "repairUserIds", { enumerable: true, get: function () { return repairUserIds_1.repairUserIds; } });
// =============================================================================
// FONCTIONS INTERNES
// =============================================================================
/**
 * Fonction interne pour calculer la charge de travail sans contexte Firebase
 */
async function calculateUserWorkloadInternal(data) {
    const { userId, startDate, endDate } = data;
    const db = admin.firestore();
    const start = new Date(startDate);
    const end = new Date(endDate);
    try {
        // Charger les données utilisateur
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('Utilisateur non trouvé');
        }
        const userData = userDoc.data();
        const userCapacity = (userData === null || userData === void 0 ? void 0 : userData.capacity) || { theoretical: 40, available: 35 };
        // Charger les congés approuvés dans la période
        const leavesSnapshot = await db
            .collection('leaves')
            .where('userId', '==', userId)
            .where('status', '==', 'approved')
            .where('startDate', '>=', start)
            .where('endDate', '<=', end)
            .get();
        // Charger les allocations confirmées
        const allocationsSnapshot = await db
            .collection('allocations')
            .where('userId', '==', userId)
            .where('status', 'in', ['confirmed', 'tentative'])
            .where('startDate', '>=', start)
            .where('endDate', '<=', end)
            .get();
        // Calculer les heures de congé
        const totalLeaveHours = leavesSnapshot.docs.reduce((sum, doc) => {
            const leave = doc.data();
            return sum + (leave.workingDaysCount * 8); // 8h par jour ouvré
        }, 0);
        // Calculer les heures allouées
        const totalAllocatedHours = allocationsSnapshot.docs.reduce((sum, doc) => {
            const allocation = doc.data();
            const weeks = Math.ceil((new Date(allocation.endDate).getTime() - new Date(allocation.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7));
            return sum + (weeks * userCapacity.theoretical * allocation.allocationPercentage);
        }, 0);
        // Calculer les métriques
        const totalWeeks = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const totalTheoreticalHours = totalWeeks * userCapacity.theoretical;
        const totalAvailableHours = totalTheoreticalHours - totalLeaveHours;
        const remainingHours = totalAvailableHours - totalAllocatedHours;
        const utilisationRate = totalAllocatedHours / totalAvailableHours;
        // Déterminer le niveau de risque
        let overloadRisk;
        if (utilisationRate < 0.7) {
            overloadRisk = 'none';
        }
        else if (utilisationRate < 0.85) {
            overloadRisk = 'low';
        }
        else if (utilisationRate < 0.95) {
            overloadRisk = 'medium';
        }
        else if (utilisationRate < 1.1) {
            overloadRisk = 'high';
        }
        else {
            overloadRisk = 'critical';
        }
        const result = {
            userId,
            calculatedAt: new Date(),
            period: { start, end },
            availability: {
                capacity: {
                    theoretical: totalTheoreticalHours,
                    net: totalAvailableHours,
                    available: remainingHours
                },
                allocated: {
                    total: totalAllocatedHours,
                    confirmed: totalAllocatedHours
                },
                leaves: totalLeaveHours,
                utilization: {
                    rate: utilisationRate,
                    percentage: Math.round(utilisationRate * 100)
                },
                overloadRisk
            }
        };
        // Sauvegarder le snapshot
        await db.collection('workload_snapshots').doc(`${userId}_${start.toISOString().split('T')[0]}`).set(result);
        return result;
    }
    catch (error) {
        console.error('Erreur lors du calcul de charge:', error);
        throw error;
    }
}
// =============================================================================
// CLOUD FUNCTIONS POUR CALCULS COMPLEXES - MODULE RESSOURCES
// =============================================================================
/**
 * Cloud Function pour calculer la charge de travail d'un utilisateur
 * Déclenché par appel HTTP ou par trigger Firestore
 */
exports.calculateUserWorkload = functions
    .region('europe-west1')
    .runWith({
    memory: '1GB',
    timeoutSeconds: 120,
})
    .https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Vérification de l'authentification
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'La fonction doit être appelée par un utilisateur authentifié.');
    }
    const { userId, startDate, endDate } = data;
    if (!userId || !startDate || !endDate) {
        throw new functions.https.HttpsError('invalid-argument', 'Les paramètres userId, startDate et endDate sont requis.');
    }
    try {
        const db = admin.firestore();
        const start = new Date(startDate);
        const end = new Date(endDate);
        // 1. Récupérer les données utilisateur
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Utilisateur non trouvé');
        }
        const userData = userDoc.data();
        // 2. Calculer la capacité théorique
        const weeklyHours = ((_a = userData.workingHours) === null || _a === void 0 ? void 0 : _a.weeklyHours) || 35;
        const productivityRate = ((_b = userData.productivity) === null || _b === void 0 ? void 0 : _b.rate) || 0.8;
        const workingDays = ((_c = userData.workingHours) === null || _c === void 0 ? void 0 : _c.workingDays) || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        // 3. Récupérer les congés approuvés dans la période
        const leavesSnapshot = await db
            .collection('leaves')
            .where('userId', '==', userId)
            .where('status', '==', 'approved')
            .where('startDate', '<=', end)
            .where('endDate', '>=', start)
            .get();
        // 4. Récupérer les affectations dans la période
        const allocationsSnapshot = await db
            .collection('allocations')
            .where('userId', '==', userId)
            .where('startDate', '<=', end)
            .where('endDate', '>=', start)
            .get();
        // 5. Calculer semaine par semaine
        const weeklySnapshots = [];
        const alerts = [];
        let currentWeek = getMonday(start);
        while (currentWeek <= end) {
            const weekEnd = new Date(currentWeek);
            weekEnd.setDate(weekEnd.getDate() + 6); // Dimanche
            const snapshot = await calculateWeeklyWorkload(userId, currentWeek, weekEnd, {
                weeklyHours,
                productivityRate,
                workingDays,
                leaves: leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                allocations: allocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            });
            weeklySnapshots.push(snapshot);
            // Générer des alertes si nécessaire
            if (snapshot.overloadRisk === 'high' || snapshot.overloadRisk === 'critical') {
                alerts.push({
                    id: `workload_${userId}_${currentWeek.toISOString()}`,
                    userId,
                    type: 'overload',
                    severity: snapshot.overloadRisk === 'critical' ? 'critical' : 'high',
                    message: `Surcharge détectée pour la semaine du ${currentWeek.toLocaleDateString('fr-FR')}`,
                    threshold: snapshot.capacity.net,
                    currentValue: snapshot.allocated.total,
                    createdAt: new Date()
                });
            }
            // Semaine suivante
            currentWeek.setDate(currentWeek.getDate() + 7);
        }
        // 6. Sauvegarder les snapshots en batch
        const batch = db.batch();
        weeklySnapshots.forEach(snapshot => {
            const snapshotRef = db
                .collection('workload_snapshots')
                .doc(`${userId}_${snapshot.weekStart.toISOString().split('T')[0]}`);
            batch.set(snapshotRef, {
                ...snapshot,
                calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
                validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h cache
            });
        });
        // 7. Sauvegarder les alertes
        alerts.forEach(alert => {
            const alertRef = db.collection('workload_alerts').doc(alert.id);
            batch.set(alertRef, {
                ...alert,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        // 8. Calculer le résumé global
        const totalCapacity = weeklySnapshots.reduce((sum, s) => sum + s.capacity.theoretical, 0);
        const totalNet = weeklySnapshots.reduce((sum, s) => sum + s.capacity.net, 0);
        const totalAllocated = weeklySnapshots.reduce((sum, s) => sum + s.allocated.total, 0);
        const totalAvailable = weeklySnapshots.reduce((sum, s) => sum + s.capacity.available, 0);
        const overallRisk = calculateOverallRisk(weeklySnapshots);
        return {
            userId,
            period: { start, end },
            availability: {
                weekStart: start,
                weekEnd: end,
                capacity: {
                    theoretical: totalCapacity,
                    net: totalNet,
                    available: totalAvailable
                },
                allocated: {
                    confirmed: weeklySnapshots.reduce((sum, s) => sum + s.allocated.confirmed, 0),
                    tentative: weeklySnapshots.reduce((sum, s) => sum + s.allocated.tentative, 0),
                    total: totalAllocated
                },
                deductions: weeklySnapshots.reduce((acc, s) => ({
                    leaves: acc.leaves + s.deductions.leaves,
                    training: acc.training + s.deductions.training,
                    meetings: acc.meetings + s.deductions.meetings,
                    other: acc.other + s.deductions.other
                }), { leaves: 0, training: 0, meetings: 0, other: 0 }),
                overloadRisk: overallRisk,
                calculatedAt: new Date(),
                validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
            },
            suggestions: generateSuggestions(weeklySnapshots, userData),
            alerts: alerts,
            weeklySnapshots
        };
    }
    catch (error) {
        console.error('Erreur lors du calcul de charge:', error);
        throw new functions.https.HttpsError('internal', 'Erreur lors du calcul de charge');
    }
});
/**
 * Cloud Function pour suggérer des affectations de ressources
 * Utilise un algorithme d'optimisation pour matcher compétences et disponibilités
 */
exports.suggestResourceAllocation = functions
    .region('europe-west1')
    .runWith({
    memory: '1GB',
    timeoutSeconds: 120,
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
    }
    const { requiredSkills, estimatedHours, startDate, endDate, priority = 'medium' } = data;
    try {
        const db = admin.firestore();
        const start = new Date(startDate);
        const end = new Date(endDate);
        // 1. Récupérer tous les utilisateurs actifs
        const usersSnapshot = await db
            .collection('users')
            .where('isActive', '==', true)
            .get();
        const suggestions = [];
        // 2. Pour chaque utilisateur, calculer la compatibilité
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            // Récupérer les compétences de l'utilisateur
            const skillsSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('skills')
                .get();
            const userSkills = skillsSnapshot.docs.map(doc => doc.data());
            // Calculer le score de compatibilité des compétences
            const skillScore = calculateSkillMatch(requiredSkills, userSkills);
            if (skillScore === 0)
                continue; // Pas de compétences compatibles
            // Calculer la disponibilité
            const workloadResult = await calculateUserWorkloadInternal({
                userId,
                startDate: start.toISOString(),
                endDate: end.toISOString()
            });
            const availability = workloadResult.availability;
            const availableHours = availability.capacity.available;
            // Calculer le score de disponibilité
            const availabilityScore = Math.min(availableHours / estimatedHours, 1);
            // Score composite
            const totalScore = (skillScore * 0.6) + (availabilityScore * 0.4);
            if (totalScore > 0.3) { // Seuil minimum
                suggestions.push({
                    userId,
                    userName: userData.displayName,
                    skillScore,
                    availabilityScore,
                    totalScore,
                    availableHours,
                    estimatedHours,
                    matchingSkills: getMatchingSkills(requiredSkills, userSkills),
                    recommendation: getRecommendation(skillScore, availabilityScore),
                    workloadRisk: availability.overloadRisk
                });
            }
        }
        // 3. Trier par score et retourner les meilleures suggestions
        suggestions.sort((a, b) => b.totalScore - a.totalScore);
        return {
            suggestions: suggestions.slice(0, 10),
            metadata: {
                requiredSkills,
                estimatedHours,
                period: { start, end },
                candidatesEvaluated: usersSnapshot.docs.length,
                calculatedAt: new Date()
            }
        };
    }
    catch (error) {
        console.error('Erreur lors de la suggestion d\'allocation:', error);
        throw new functions.https.HttpsError('internal', 'Erreur lors de la suggestion');
    }
});
/**
 * Trigger Firestore pour recalculer automatiquement les charges
 * Déclenché lors de modifications d'allocations ou de congés
 */
exports.onAllocationChange = functions
    .region('europe-west1')
    .firestore
    .document('allocations/{allocationId}')
    .onWrite(async (change, context) => {
    const allocation = change.after.exists ? change.after.data() : null;
    const previousAllocation = change.before.exists ? change.before.data() : null;
    // Déterminer les utilisateurs affectés
    const userIds = new Set();
    if (allocation === null || allocation === void 0 ? void 0 : allocation.userId)
        userIds.add(allocation.userId);
    if (previousAllocation === null || previousAllocation === void 0 ? void 0 : previousAllocation.userId)
        userIds.add(previousAllocation.userId);
    // Recalculer la charge pour chaque utilisateur affecté
    const promises = Array.from(userIds).map(async (userId) => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3); // 3 mois à l'avance
        return calculateUserWorkloadInternal({
            userId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });
    });
    await Promise.all(promises);
    console.log(`Recalcul de charge effectué pour ${userIds.size} utilisateur(s)`);
});
/**
 * Trigger pour nettoyer les données expirées
 * Exécuté quotidiennement
 */
exports.cleanupExpiredData = functions
    .region('europe-west1')
    .runWith({
    memory: '512MB',
    timeoutSeconds: 540,
})
    .pubsub
    .schedule('0 2 * * *') // Tous les jours à 2h du matin
    .timeZone('Europe/Paris')
    .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    // Supprimer les snapshots expirés
    const expiredSnapshots = await db
        .collection('workload_snapshots')
        .where('validUntil', '<', now)
        .get();
    const batch = db.batch();
    expiredSnapshots.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    // Supprimer les alertes résolues anciennes (> 30 jours)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    const oldAlerts = await db
        .collection('workload_alerts')
        .where('resolvedAt', '<', oldDate)
        .get();
    oldAlerts.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Nettoyage effectué: ${expiredSnapshots.docs.length} snapshots et ${oldAlerts.docs.length} alertes supprimés`);
});
// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}
async function calculateWeeklyWorkload(userId, weekStart, weekEnd, context) {
    const { weeklyHours, productivityRate, workingDays, leaves, allocations } = context;
    // Calculer les heures théoriques pour cette semaine
    const theoreticalHours = weeklyHours;
    // Calculer les déductions
    const weekLeaves = leaves.filter(leave => {
        const leaveStart = new Date(leave.startDate.seconds * 1000);
        const leaveEnd = new Date(leave.endDate.seconds * 1000);
        return leaveStart <= weekEnd && leaveEnd >= weekStart;
    });
    const leaveDeduction = weekLeaves.reduce((sum, leave) => {
        return sum + Math.min(leave.workingDaysCount * 7, theoreticalHours * 0.2);
    }, 0);
    // Déductions fixes (meetings, formation, etc.)
    const meetingDeduction = theoreticalHours * 0.1; // 10% pour les réunions
    const trainingDeduction = 0;
    const otherDeduction = 0;
    const totalDeductions = leaveDeduction + meetingDeduction + trainingDeduction + otherDeduction;
    const netCapacity = Math.max(0, theoreticalHours * productivityRate - totalDeductions);
    // Calculer les allocations
    const weekAllocations = allocations.filter(allocation => {
        const allocStart = new Date(allocation.startDate.seconds * 1000);
        const allocEnd = new Date(allocation.endDate.seconds * 1000);
        return allocStart <= weekEnd && allocEnd >= weekStart;
    });
    const confirmedHours = weekAllocations
        .filter(alloc => alloc.status === 'confirmed')
        .reduce((sum, alloc) => sum + (alloc.estimatedHours * alloc.allocationPercentage || 0), 0);
    const tentativeHours = weekAllocations
        .filter(alloc => alloc.status === 'tentative')
        .reduce((sum, alloc) => sum + (alloc.estimatedHours * alloc.allocationPercentage || 0), 0);
    const totalAllocated = confirmedHours + tentativeHours;
    const availableCapacity = Math.max(0, netCapacity - totalAllocated);
    // Calculer le risque de surcharge
    const loadRatio = totalAllocated / netCapacity;
    let overloadRisk;
    if (loadRatio <= 0.7)
        overloadRisk = 'none';
    else if (loadRatio <= 0.85)
        overloadRisk = 'low';
    else if (loadRatio <= 0.95)
        overloadRisk = 'medium';
    else if (loadRatio <= 1.1)
        overloadRisk = 'high';
    else
        overloadRisk = 'critical';
    return {
        userId,
        weekStart,
        weekEnd,
        capacity: {
            theoretical: theoreticalHours,
            net: netCapacity,
            available: availableCapacity
        },
        allocated: {
            confirmed: confirmedHours,
            tentative: tentativeHours,
            total: totalAllocated
        },
        deductions: {
            leaves: leaveDeduction,
            training: trainingDeduction,
            meetings: meetingDeduction,
            other: otherDeduction
        },
        overloadRisk
    };
}
function calculateSkillMatch(requiredSkills, userSkills) {
    if (requiredSkills.length === 0)
        return 1;
    let totalScore = 0;
    let matchCount = 0;
    requiredSkills.forEach(requiredSkill => {
        const userSkill = userSkills.find(skill => skill.name.toLowerCase() === requiredSkill.toLowerCase());
        if (userSkill) {
            matchCount++;
            const levelScores = {
                'beginner': 0.25,
                'intermediate': 0.5,
                'advanced': 0.75,
                'expert': 1.0
            };
            const levelScore = levelScores[userSkill.level] || 0.25;
            const validationBonus = userSkill.managerValidated ? 1.2 : 1.0;
            totalScore += levelScore * validationBonus;
        }
    });
    return matchCount > 0 ? (totalScore / requiredSkills.length) : 0;
}
function getMatchingSkills(requiredSkills, userSkills) {
    return requiredSkills.map(required => {
        const userSkill = userSkills.find(skill => skill.name.toLowerCase() === required.toLowerCase());
        return {
            name: required,
            userLevel: (userSkill === null || userSkill === void 0 ? void 0 : userSkill.level) || null,
            validated: (userSkill === null || userSkill === void 0 ? void 0 : userSkill.managerValidated) || false
        };
    }).filter(skill => skill.userLevel);
}
function getRecommendation(skillScore, availabilityScore) {
    if (skillScore > 0.8 && availabilityScore > 0.8) {
        return 'Excellent candidat - Compétences et disponibilité parfaites';
    }
    else if (skillScore > 0.6 && availabilityScore > 0.6) {
        return 'Bon candidat - Profil adapté';
    }
    else if (skillScore > 0.4 || availabilityScore > 0.4) {
        return 'Candidat possible - Vérifier les détails';
    }
    else {
        return 'Candidat à risque - Ressources limitées';
    }
}
function generateSuggestions(weeklySnapshots, userData) {
    const suggestions = [];
    weeklySnapshots.forEach(snapshot => {
        if (snapshot.overloadRisk === 'high' || snapshot.overloadRisk === 'critical') {
            suggestions.push({
                type: 'reallocation',
                severity: snapshot.overloadRisk === 'critical' ? 'critical' : 'warning',
                message: `Considérer une réallocation pour la semaine du ${snapshot.weekStart.toLocaleDateString('fr-FR')}`,
                actions: [
                    'Repousser des tâches non critiques',
                    'Réaffecter à d\'autres ressources',
                    'Négocier les délais avec le client'
                ]
            });
        }
        else if (snapshot.capacity.available > snapshot.capacity.theoretical * 0.3) {
            suggestions.push({
                type: 'capacity_available',
                severity: 'info',
                message: `Capacité disponible importante (${Math.round(snapshot.capacity.available)}h)`,
                actions: [
                    'Planifier des tâches supplémentaires',
                    'Former sur de nouvelles compétences',
                    'Contribuer à d\'autres projets'
                ]
            });
        }
    });
    return suggestions;
}
function calculateOverallRisk(snapshots) {
    const riskCounts = snapshots.reduce((acc, snapshot) => {
        acc[snapshot.overloadRisk] = (acc[snapshot.overloadRisk] || 0) + 1;
        return acc;
    }, {});
    if (riskCounts.critical > 0)
        return 'critical';
    if (riskCounts.high > snapshots.length * 0.3)
        return 'high';
    if (riskCounts.medium > snapshots.length * 0.5)
        return 'medium';
    if (riskCounts.low > 0)
        return 'low';
    return 'none';
}
//# sourceMappingURL=index.js.map
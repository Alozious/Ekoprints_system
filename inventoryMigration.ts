import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import type { DocumentData, Firestore, DocumentReference } from 'firebase/firestore';
import { department, nonNegative, wholeUnits } from './stockMath.ts';

export interface OpeningPreview {
  documentId: string; skuId: string; itemName: string; module: string;
  currentMeters: number; referenceRolls: string; lastPricePerRoll: number;
  fingerprint: string; migrated: boolean;
  currentUnits?: number;
}
function fingerprint(data: DocumentData) {
  return JSON.stringify([data.totalStockMeters ?? 0, data.lastPurchasePricePerRoll_UGX ?? 0, data.skuId ?? '', data.module ?? '']);
}
export async function previewInventoryMigration(db: Firestore): Promise<OpeningPreview[]> {
  const snapshot = await getDocs(collection(db, 'stockItems'));
  return snapshot.docs.map(s => {
    const d = s.data();
    return { documentId: s.id, skuId: d.skuId || s.id, itemName: d.itemName || s.id, module: d.module || 'Unassigned', currentMeters: d.totalStockMeters ?? 0,
      referenceRolls: ((d.totalStockMeters ?? 0) / 50).toFixed(2), lastPricePerRoll: d.lastPurchasePricePerRoll_UGX ?? 0, fingerprint: fingerprint(d), migrated: d.inventoryVersion === 1,
      ...(d.inventoryVersion === 1 ? { currentUnits: d.unitsOnHand } : {}) };
  });
}
export interface MigrationConfirmation {
  userId: string; settingsId: string; backupConfirmed: boolean; confirmed: boolean;
  preview: OpeningPreview[]; countedUnits: Record<string, number>;
  materialsOnly?: boolean;
}
/** Manual only. Resumable per-document migration; no rounding or automatic meter conversion.
 * Run in maintenance mode against a copy/emulator first. No top-level side effects. */
export async function migrateInventory(db: Firestore, input: MigrationConfirmation) {
  if (!input.backupConfirmed || !input.confirmed) throw new Error('Back up Firestore and confirm migration first.');
  for (const row of input.preview.filter(r => !r.migrated)) wholeUnits(input.countedUnits[row.documentId] ?? NaN);
  for (const row of input.preview.filter(r => r.migrated && rowKeyProvided(r))) wholeUnits(input.countedUnits[row.documentId]);
  function rowKeyProvided(row: OpeningPreview) { return Object.hasOwn(input.countedUnits, row.documentId); }
  const settingsRef = doc(db, 'settings', input.settingsId);
  const migrationRef = doc(db, 'inventoryMigrations', 'unopened-v1');
  async function checkedUpdate(ref: DocumentReference, change: (data: DocumentData, name: string) => Record<string, unknown> | null) {
    await runTransaction(db, async tx => {
      const [user, settings, snapshot] = await Promise.all([tx.get(doc(db, 'users', input.userId)), tx.get(settingsRef), tx.get(ref)]);
      if (user.data()?.role !== 'admin') throw new Error('Admin access required.');
      if (!settings.data()?.inventoryMigrationEnabled) throw new Error('Enable inventory migration in Settings first.');
      if (!snapshot.exists()) throw new Error(`Missing document: ${ref.path}`);
      const patch = change(snapshot.data(), String(user.data()?.username || input.userId));
      if (patch) tx.update(ref, patch);
    });
  }
  await runTransaction(db, async tx => {
    const [user, settings, marker] = await Promise.all([tx.get(doc(db, 'users', input.userId)), tx.get(settingsRef), tx.get(migrationRef)]);
    if (user.data()?.role !== 'admin' || !settings.data()?.inventoryMigrationEnabled) throw new Error('Admin and migration settings flag required.');
    if (marker.data()?.complete || settings.data()?.inventoryMigrationV1) throw new Error('Migration is already complete.');
    tx.set(migrationRef, { running: true, complete: false }, { merge: true });
  });
  // Recheck the variant list, including additions since preview.
  const current = await getDocs(collection(db, 'stockItems'));
  if (current.docs.some(s => !input.preview.some(r => r.documentId === s.id))) throw new Error('Variants changed. Reload preview before continuing.');
  for (const row of input.preview) {
    const ref = doc(db, 'stockItems', row.documentId);
    const openingRef = doc(db, 'stockTransactions', `opening-v1-${row.documentId}`);
    const countedRef = doc(db, 'stockTransactions', `migration-count-v1-${row.documentId}`);
    await runTransaction(db, async tx => {
      const [user, settings, stock, opening, counted] = await Promise.all([tx.get(doc(db, 'users', input.userId)), tx.get(settingsRef), tx.get(ref), tx.get(openingRef), tx.get(countedRef)]);
      if (user.data()?.role !== 'admin' || !settings.data()?.inventoryMigrationEnabled) throw new Error('Admin and migration flag required.');
      if (!stock.exists()) throw new Error('Variant removed. Reload preview.');
      const data = stock.data();
      if (data.inventoryVersion === 1) {
        // A newly created variant can already have an Opening. Apply an explicit
        // physical count as an Adjustment, preserving its existing opening/history.
        if (!row.migrated || !rowKeyProvided(row) || counted.exists()) return;
        if (data.unitsOnHand !== row.currentUnits) throw new Error(`Balance changed: ${row.itemName}. Reload preview.`);
        const units = wholeUnits(input.countedUnits[row.documentId]), cost = nonNegative(data.avgCostPerUnit, 'Average cost');
        if (units === data.unitsOnHand) return;
        tx.update(ref, { unitsOnHand: units, lastMovementId: countedRef.id });
        tx.set(countedRef, { transactionId: countedRef.id, skuId: row.documentId, entity: 'material', type: 'Adjustment', units: units - data.unitsOnHand,
          unitCost: cost, totalValue: Math.abs(units - data.unitsOnHand) * cost, beforeUnits: data.unitsOnHand, afterUnits: units,
          module: department(data.module), date: new Date().toISOString(), userId: input.userId, userName: user.data()?.username || input.userId,
          notes: 'Admin confirmed unopened-unit count during migration; existing Opening retained.' });
        return;
      }
      if (fingerprint(data) !== row.fingerprint) throw new Error(`Variant changed: ${row.itemName}. Reload preview.`);
      if (opening.exists()) throw new Error('Opening record conflict; investigate before retrying.');
      const units = wholeUnits(input.countedUnits[row.documentId]);
      const cost = nonNegative(data.lastPurchasePricePerRoll_UGX ?? 0, 'Legacy cost');
      tx.update(ref, { unitsOnHand: units, avgCostPerUnit: cost, unit: 'roll', rollLengthMeters: 50, inventoryVersion: 1, reorderLevelNeedsReview: true, variantLabel: data.variantLabel || `${data.width ?? ''} m`, isActive: data.isActive !== false });
      tx.set(openingRef, { transactionId: openingRef.id, skuId: row.documentId, legacySkuId: row.skuId, entity: 'material', type: 'Opening', units, unitCost: cost, totalValue: units * cost,
        module: department(data.module), date: new Date().toISOString(), userId: input.userId, userName: user.data()?.username || input.userId, notes: 'Physical count of unopened units; legacy meters retained for reference only.' });
    });
  }
  for (const snapshot of (await getDocs(collection(db, 'stockTransactions'))).docs) {
    await checkedUpdate(snapshot.ref, data => data.transactionType && !data.legacy ? { legacy: true } : null);
    // No IDs or original transaction fields are replaced.
  }
  if (input.materialsOnly) {
    await runTransaction(db, async tx => {
      const [user, settings] = await Promise.all([tx.get(doc(db, 'users', input.userId)), tx.get(settingsRef)]);
      if (user.data()?.role !== 'admin' || !settings.data()?.inventoryMigrationEnabled) throw new Error('Admin and migration flag required.');
      tx.update(settingsRef, { inventoryMaterialMigrationV1: true, inventoryMigrationEnabled: false });
      tx.set(migrationRef, { running: false, complete: false, materialCountsComplete: true, materialCountsCompletedAt: new Date().toISOString(), userId: input.userId }, { merge: true });
    });
    return;
  }
  for (const snapshot of (await getDocs(collection(db, 'inventory'))).docs) {
    await checkedUpdate(snapshot.ref, data => {
      if (data.inventoryMigrationV1) return null;
      const cost = data.avgCost ?? data.purchasePrice;
      const valid = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
      // Missing cost remains absent, not a false zero.
      return { inventoryMigrationV1: true, costMissing: !valid, ...(valid ? { avgCost: cost } : {}) };
    });
  }
  for (const snapshot of (await getDocs(collection(db, 'sales'))).docs) {
    await checkedUpdate(snapshot.ref, data => {
      if (data.departmentMigrationV1) return null;
      const items = (data.items || []) as Array<Record<string, unknown> & { metadata?: { tab?: string } }>;
      return { departmentMigrationV1: true, items: items.map(item => ({ ...item, module: item.module || department(item.metadata?.tab) })) };
      // Historical resale COGS is unknown and is not invented here.
    });
  }
  for (const snapshot of (await getDocs(collection(db, 'expenses'))).docs) {
    await checkedUpdate(snapshot.ref, data => data.departmentMigrationV1 ? null : { departmentMigrationV1: true, module: data.module || 'Unassigned', expenseType: 'operating' });
  }
  await runTransaction(db, async tx => {
    const [user, settings] = await Promise.all([tx.get(doc(db, 'users', input.userId)), tx.get(settingsRef)]);
    if (user.data()?.role !== 'admin' || !settings.data()?.inventoryMigrationEnabled) throw new Error('Admin and migration flag required.');
    tx.update(settingsRef, { inventoryMigrationV1: true, inventoryMigrationEnabled: false });
    tx.set(migrationRef, { running: false, complete: true, completedAt: new Date().toISOString(), userId: input.userId });
  });
}

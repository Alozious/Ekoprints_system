import { collection, doc, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { consolidateCategory, CONSOLIDATED_CATEGORY } from './customerCategories';

// User-requested one-time migration. Read each record again in its transaction
// so a concurrent customer edit cannot be overwritten.
export async function migrateCustomerCategories() {
    const settingsSnapshot = await getDocs(collection(db, 'settings'));
    const settingsRef = settingsSnapshot.docs[0]?.ref || doc(db, 'settings', 'system');
    const saved = await getDoc(settingsRef);
    if (saved.data()?.customerCategoryMigrationV3) return;
    const customers = await getDocs(collection(db, 'customers'));
    const pending = customers.docs.filter(customer => consolidateCategory(customer.data().category) !== (customer.data().category || ''));
    // Bounded parallel transactions avoid a long serial wait on large imports.
    for (let offset = 0; offset < pending.length; offset += 20) {
        await Promise.all(pending.slice(offset, offset + 20).map(customer => runTransaction(db, async tx => {
            const fresh = await tx.get(customer.ref);
            if (!fresh.exists()) return;
            const before = fresh.data().category || '';
            const after = consolidateCategory(before);
            if (before !== after) tx.update(customer.ref, { category: after });
        })));
    }
    const verified = await getDocs(collection(db, 'customers'));
    if (verified.docs.some(c => consolidateCategory(c.data().category) !== (c.data().category || ''))) throw new Error('Category consolidation incomplete. Reload to retry.');
    await runTransaction(db, async tx => {
        const current = await tx.get(settingsRef);
        tx.set(settingsRef, { customerCategories: [CONSOLIDATED_CATEGORY], customerCategoryMigrationV1: true, customerCategoryMigrationV2: true, customerCategoryMigrationV3: true }, { merge: true });
    });
    return pending.length;
}

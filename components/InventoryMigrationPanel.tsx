import ActionButton from './ActionButton';
import InfoTooltip from './InfoTooltip';
import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { migrateInventory, previewInventoryMigration } from '../inventoryMigration';
import type { OpeningPreview } from '../inventoryMigration';
import type { SystemSettings } from '../types';
import Modal from './Modal';

export default function InventoryMigrationPanel({ settings, onUpdateSettings }: { settings: SystemSettings; onUpdateSettings: (s: SystemSettings) => Promise<void> }) {
  const [rows, setRows] = useState<OpeningPreview[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false), [backup, setBackup] = useState(false), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [materialsOnly, setMaterialsOnly] = useState(true);
  const [backupExported, setBackupExported] = useState(false);
  const [backupDownload, setBackupDownload] = useState<{ url: string; filename: string } | null>(null);
  async function exportBackup() {
    setBusy(true); setMessage('');
    try {
      const names = ['stockItems', 'stockTransactions', 'inventory', 'sales', 'expenses', 'settings', 'inventoryMigrations'];
      const snapshots = await Promise.all(names.map(name => getDocs(collection(db, name))));
      const collections = Object.fromEntries(names.map((name, index) => [name, snapshots[index].docs.map(snapshot => ({ documentId: snapshot.id, data: snapshot.data() }))]));
      const exportedAt = new Date().toISOString();
      const json = JSON.stringify({ format: 'eko-inventory-migration-backup-v1', projectId: db.app.options.projectId, exportedAt, collections }, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      if (backupDownload) URL.revokeObjectURL(backupDownload.url);
      setBackupDownload({ url, filename: `eko-inventory-backup-${exportedAt.replace(/[:.]/g, '-')}.json` });
      setBackupExported(true);
      setMessage(`Backup ready for all ${names.length} affected collections. Use the download link and verify the JSON file is saved before confirming migration.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Backup export failed.'); }
    finally { setBusy(false); }
  }
  async function preview() {
    setBusy(true);
    try { setRows(await previewInventoryMigration(db)); setCounts({}); setBackup(false); setConfirm(false); setOpen(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Preview failed.'); }
    finally { setBusy(false); }
  }
  async function migrate() {
    setBusy(true); setMessage('');
    try {
      if (!auth.currentUser) throw new Error('Sign in as admin.');
      const settingsDocs = await getDocs(collection(db, 'settings'));
      // Legacy settings may contain an embedded id pointing at another document.
      // Use the unique document whose migration flag was explicitly enabled.
      const enabled = settingsDocs.docs.filter(s => s.data().inventoryMigrationEnabled === true);
      const selected = enabled.length === 1 ? enabled[0] : undefined;
      if (!selected) throw new Error('Enable migration on exactly one Settings document before continuing.');
      await migrateInventory(db, { userId: auth.currentUser.uid, settingsId: selected.id, preview: rows, materialsOnly,
        countedUnits: Object.fromEntries(Object.entries(counts).filter(([, count]) => String(count).trim() !== '').map(([id, count]) => [id, Number(count)])), backupConfirmed: backup, confirmed: confirm });
      setMessage(materialsOnly ? 'Material counts saved. Reload Inventory to see the confirmed unopened units. Sales and expenses were not changed.' : 'Migration complete. Reload the app. Legacy Sales/Dashboard stock actions must wait for Step 3.'); setOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Migration failed. Reload preview to resume.'); }
    finally { setBusy(false); }
  }
  return <section className="bg-white p-6 rounded-2xl space-y-4 border border-gray-100">
    <h3 className="font-bold">Unopened inventory migration (admin)</h3>
    <p className="text-sm text-gray-600">Back up/export Firestore first. Test on a project copy or emulator. Keep other users out during migration. No automatic meter conversion.</p>
    <ActionButton className="bg-gray-100 text-gray-900 px-4 py-2 rounded-xl" disabled={busy} onClick={exportBackup}>Export migration backup (JSON)</ActionButton>
    {backupDownload && <a className="block text-blue-700 underline" href={backupDownload.url} download={backupDownload.filename}>Download inventory backup JSON</a>}
    <p className="text-xs text-gray-500">Exports the seven collections this migration can change, including document IDs. This is an application JSON snapshot, not a managed full-database export. {backupExported ? 'Backup download requested.' : ''}</p>
    <label className="flex gap-2"><input type="checkbox" disabled={busy || settings.inventoryMigrationV1} checked={!!settings.inventoryMigrationEnabled} onChange={async e => {
      try { await onUpdateSettings({ ...settings, inventoryMigrationEnabled: e.target.checked }); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Settings update failed.'); }
    }} />Enable manual migration</label>
    <ActionButton className="bg-gray-900 text-yellow-400 px-4 py-2 rounded-xl" disabled={busy || !settings.inventoryMigrationEnabled || settings.inventoryMigrationV1} onClick={preview}>Preview opening counts</ActionButton>
    <p role="status" className="text-sm">{message}</p>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Confirm counted unopened stock" size="xl">
      <div className="space-y-4">
        <InfoTooltip label="Opening stock information">Reference rolls are meters / 50 rounded to 2 decimals only. Enter actual unopened units. Opening creates no profit gain.</InfoTooltip>
        <label className="block"><input type="checkbox" checked={materialsOnly} disabled={busy} onChange={e => setMaterialsOnly(e.target.checked)} /> Material counts only — leave sales, resale goods and expenses unchanged.</label>
        <div className="overflow-auto"><table className="w-full text-sm"><thead><tr>{['Variant', 'Meters', 'Reference rolls', 'Last cost UGX', 'Counted unopened units'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.documentId}><td className="p-2">{row.itemName}{row.migrated ? ` (current units: ${row.currentUnits})` : ''}</td><td>{row.currentMeters}</td><td>{row.referenceRolls}</td><td>{row.lastPricePerRoll.toLocaleString()}</td><td><input aria-label={`Count ${row.itemName}`} type="number" min="0" step="1" value={counts[row.documentId] ?? ''} disabled={busy} className="w-24 border rounded p-2 text-gray-900" onChange={e => setCounts({ ...counts, [row.documentId]: e.target.value })} /></td></tr>)}</tbody>
        </table></div>
        <label className="block"><input type="checkbox" checked={backup} disabled={busy} onChange={e => setBackup(e.target.checked)} /> I exported/backed up Firestore.</label>
        <label className="block"><input type="checkbox" checked={confirm} disabled={busy} onChange={e => setConfirm(e.target.checked)} /> I confirm physical counts and maintenance mode.</label>
        <ActionButton className="bg-yellow-400 text-gray-900 px-4 py-3 rounded-xl font-bold" disabled={busy || !backup || !confirm} onClick={migrate}>{busy ? 'Migrating…' : 'Create opening balances'}</ActionButton>
        <p role="alert">{message}</p>
      </div>
    </Modal>
  </section>;
}

# Inventory restructuring — Step 1

Complete source files are saved in this workspace. No Firebase data or rules were deployed or changed by the implementation/testing work.

## Files

- `types.ts`: new departments, unit stock, costed resale/sale types, Opening ledger records; compatibility fields remain. Legacy `StockItem.width` remains required until old screens are replaced; the new `UnitStockItem` allows non-roll widths to be absent. Legacy optional costs remain representable; new product entry forms must use `CostedInventoryItem`.
- `stockMath.ts`, `stockMath.test.mjs`: pure accounting calculations and unit tests.
- `stockService.ts`: injected Firestore instance and user context, transaction-based stock operations.
- `inventoryMigration.ts`: preview and explicit, resumable migration.
- `components/InventoryMigrationPanel.tsx`, `components/SettingsView.tsx`: admin Settings preview and confirmation UI.
- `firestore.inventory.proposed.rules`: merge proposal, not a deployment-ready replacement for existing rules.
- `package.json`: `test:stock` command.

## Accounting conventions

Material Purchase adds assets, Start removes one unit and recognizes COGS. Opening never affects profit. Adjustments have signed units; `Stock adjustments (net) = -sum(units * unitCost)` for Adjustment entries only. COGS = Starts + resale `cogsAtSale`; net profit = sales - COGS - operating expenses - stock adjustments (net). `totalValue` is an unsigned movement magnitude; direction comes from signed `units`. Cost calculations retain full precision; format UGX for display instead of rounding carrying values repeatedly.

New services never touch legacy meter balances. Materials must be migrated before new stock actions. Staff cannot request negative stock; an admin must pass `adminOverride: true`, which is recorded on the issue entry. A deficit requires an admin physical count adjustment before restocking through the non-negative weighted-average function. No purchase is written to Expenses.

Paid purchases are cash out on `Purchase.date`. Credit purchases create `supplierPayables/{purchaseId}` and count as payable, not cash out. `paySupplier()` writes an immutable `supplierPayments` record, dated at payment, and updates the outstanding amount atomically. Full landed cost, including optional freight, follows the chosen payment status. Payment does not rewrite the original Purchase record. Cash-flow reports must include supplier payment records separately without double counting credit purchases.

Resale receives update `avgCost` and `purchasePrice`. Missing legacy purchase costs block sale/adjustment until reviewed. Explicit zero costs are valid. `saveSale()` writes the entire sale and all product movements in a single transaction. Pass `productId` or Calculator `metadata.selectedProductId` for resale lines; do not infer a product from its name or split a UUID. Other service lines have zero COGS. `sellProduct()` is an alias for this whole-sale operation.

Edits reverse every previous resale issue at its original cost, restoring its carrying value before issuing the edited quantities. Reversal entries link to original movement IDs. Deletion is a soft void (`reverseSale()`): previous stock issues are reversed and the sale is retained with `voidedAt`. Step 3/4 sales displays and reports must exclude voids. Already voided sales cannot be reversed twice. Historical sales without inventoryVersion=1 cannot be edited/deleted through the new service until reviewed; the migration does not invent historical COGS or pretend historic stock deductions were reliable.

## Try Step 1

1. Run `npm run test:stock`, `npx tsc --noEmit`, and `npm run build`.
2. Use a **copy** of your Firebase project or the Firestore/Auth emulators. The checked-in `firebase.ts` still points at your existing project. Do not click migration against that project just to test. For a copy, use its Firebase configuration; for emulators, connect both Auth and Firestore immediately after initialization, before any reads. Do not mix emulator Auth with production Firestore.
3. Export/back up Firestore. Keep all other users out and stop legacy stock/sale operations. Under admin Settings, enable manual inventory migration, then Preview opening counts.
4. Each variant shows current meters, meters/50 to two decimals for reference, last purchase cost, and a blank physical-count input. Blank/fractional/negative counts are rejected; explicit zero is accepted. Enter counted unopened units and tick both backup and confirmation checkboxes.
5. Confirm migration. Verify stock document IDs, stored skuId values, old meters and old prices remain unchanged. New Opening entries use Firestore stock document IDs as skuId; `legacySkuId` retains any separately stored SKU. Existing transaction document IDs and transactionId values are untouched; only `legacy: true` is added.
6. Verify each material Opening equals counted units × last roll cost. Legacy resale quantities remain unchanged; missing costs receive `costMissing: true`. Calculator metadata assigns sale departments; unknowns and expenses become Unassigned. Migration does not compute old resale COGS. The Unassigned reassignment screen is a later UI step.
7. Completion disables the flag and marks inventoryMigrationV1. If interrupted, the running marker keeps the new stock service paused. Reload preview and resume; per-document markers prevent duplicate openings. Do not manually clear the marker and resume trading partway through a migration. Old handlers do not check this marker, which is why maintenance mode is required.

Service exercise in a test harness (use an authenticated test user matching actor.id):

```ts
const service = createStockService(testDb, { id: uid, username: 'Test', role: 'admin' });
await service.receiveStock(stockDocumentId, { units: 3, unitCost: 450000, supplier: 'Test supplier', paymentStatus: 'Paid' });
await service.startUnit(stockDocumentId, 'large-format');
await service.adjustStock(stockDocumentId, 1, 'Physical count');
```

On a variant opening at zero, receiving 3 × 450,000 and starting 1 must leave 2 units worth 900,000 and a Start of 450,000. To test concurrency, launch two starts simultaneously against one available unit: exactly one must succeed without override. Repeat concurrent receives; neither purchase may be lost. Submit a sale with two product lines and one insufficient balance: no sale, movement or balance write should commit. Edit a valid sale after an intervening restock and verify reversal restores original COGS, then void it and verify another void is rejected. These Firestore/emulator integration checks are manual; the included automated tests exercise the accounting math, not Firebase security or concurrency.

## Staging limits

Steps 2–3 have NOT replaced existing App.tsx stock/sale callbacks. They still use their legacy behavior. The new service is ready to wire into those screens; this step must not be treated as the completed rollout. After migrating, do not resume using old stock/sale handlers. Calculator pricing tiers, width and category references were left unchanged. New migration UI is only mounted inside the existing admin Settings route. Material/transaction cost and profit UI hiding across the remaining screens is completed with Steps 2–4, not by these types alone.

**UI hiding is not real confidentiality.** Staff who can read documents can inspect their cost fields using browser developer tools or the SDK. This accepted architecture keeps cost data in those same documents. Role checks in the service are defense-in-depth, not a replacement for Firestore rules.

## Rules: exactly what to provide

In Firebase console, select the **test/copy project**, then **Build → Firestore Database → your database → Rules**. Copy the **entire currently published rules text**, starting with `rules_version` (if present) through the final closing brace of `service cloud.firestore`. Include every helper function, wildcard match and unrelated collection rule: broad matches can override narrower restrictions because matching allows are ORed. If you have multiple Firestore databases, provide the complete rules for the database used by this app and its database ID. Also provide the Firebase project ID, without private keys or service account credentials. No Storage or Realtime Database rules are needed for this merge.

The proposal blocks staff ledger updates/deletes and direct material stock writes, allowing only a paired new Purchase/Start and its validated balance change. It uses user role documents; your existing user rules must prevent staff changing their own role. Admin ledger edits are prohibited except adding the legacy annotation; mistakes need new reversing entries. The current proposal permits admin stock/setup/migration writes and needs further restrictions/tests when all setup and sales handlers are wired.

**Do not deploy this file as a replacement.** It intentionally contains no unrelated permissions and conservatively blocks staff product writes until Step 3's multi-product sale/reversal rules are implemented. Deploying it now would break existing staff sale handlers. Before merge/deploy, test admin/user/anonymous access, paired vs unpaired updates, insufficient stock, forged overrides, ledger edits/deletes, credit payable pairing, settings flags, role escalation, and multi-product transaction access-call limits in the emulator. Rule syntax and enforcement have not been tested against a running emulator in this step. Existing permissive wildcard rules must be removed or narrowed during merge.

Stop after Step 1. Next: Inventory screens, after the user's “continue”.

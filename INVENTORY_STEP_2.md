# Inventory restructuring — Step 2

## Complete updated files

- `components/InventoryView.tsx`: replaces the old meter/usage UI with department tabs; Materials, Resale products, Setup and basic cost valuation tabs; typed modals; error feedback and duplicate-submit protection.
- `inventorySetupService.ts`: admin-checked Firestore transactions for materials, bulk variants, variant configuration, activation, resale product opening/editing, product categories and Calculator tiers.
- `inventorySetup.ts`: bulk label/width parsing and validation.
- `stockService.ts`: receipts now also reject inactive resale stock.
- `App.tsx`: connects the new Inventory view and performs inventory-only refreshes; removes the old inventory stock-in and direct product quantity callbacks from that screen.
- `components/Sidebar.tsx`: staff can open Inventory to Receive/Start/Restock.
- `components/CalculatorView.tsx`: excludes inactive materials/products/categories and non-roll materials from new dimension selections; keeps category IDs, widths and tier pricing unchanged.
- `types.ts`: activation, document identity and reorder-threshold review fields.
- `inventoryMigration.ts`: flags legacy meter-based reorder thresholds for review rather than misinterpreting them as units.
- `inventorySetup.test.mjs`, `inventoryView.test.mjs`, `package.json`: bulk setup tests, actual component render tests with isolated Firebase/toasts, and `test:inventory` command.

No migration, stock mutation, rule deployment or Firebase configuration change was performed during implementation or automated testing. Component render tests stub the database instance and do not initialize or contact Firebase.

## Behavior

Materials are grouped by department, material and variant, with unit, unopened quantity and reorder threshold. Admins also see average cost and value. Low-stock highlighting applies at `unitsOnHand <= reorderLevel` after the threshold has been reviewed in units. Legacy uncounted variants show “Physical count required” and have Receive/Start disabled. No balances are derived from meters.

Receive asks for units, incoming invoice unit price, supplier, Paid/Credit, optional freight and reference. Staff may enter the invoice price for the new receipt, but do not see stored average cost, valuation, COGS, profit, or receipt-value summaries. This permits staff to record purchases without exposing existing cost figures through the screen. As agreed, **UI hiding is not real confidentiality**: cost fields remain readable in the underlying documents.

Start removes one unopened unit. It defaults to the variant's department, permits choosing another department, and shows COGS cost to admins only. Actual cost and availability are checked again inside the transaction. At zero stock, staff cannot start; admins must explicitly tick the override checkbox. The table shows the last started date for information only.

Setup adds Materials with one of seven unit types, then up to 40 variants separated by commas/newlines. Numeric roll widths become meter widths and labels; A3/A4, colours and other labels have no physical width (the compatibility StockItem shape stores width=0). New variants start at zero, with an Opening record. Stock comes in through Receive. Bulk setup checks both existing variants and a transactionally maintained label registry to reject duplicate labels, including concurrent requests.

Existing materials retain their unit and department; create a new material to change those dimensions. Edit setup changes display name, reorder units and reference roll length only. No stock quantity or average-cost field is editable. Legacy reorder values are never automatically divided or rounded: review them once in Materials → Edit setup. Saving marks the threshold as reviewed. Variants migrated by the earlier Step 1 build without a review flag also show the review reminder.

All removal actions are confirmed **deactivations**, even for unused records. This retains transactions and avoids deleting a variant while another user is receiving stock. Show inactive permits reactivation. Deactivation preserves balances and does not exclude their value from the department's valuation. Calculator hides inactive selections without changing tier pricing.

Resale products show quantity, selling price, reorder level, plus purchase cost and valuation to admins. Creation requires purchase price and permits opening quantity, both written atomically with an Opening. Editing has no quantity field. Known purchase costs change through restocking, not direct form edits. Missing legacy costs are explicitly flagged; an admin can enter a reviewed purchase cost, recording the opening valuation without changing quantity. Restock updates weighted average cost and creates a Purchase record. Product category setup retains all five attribute labels; existing category names stay fixed because products currently link to category names.

## Test on the project copy/emulator

Run:

```powershell
npm run test:inventory
npx tsc --noEmit
npm run build
```

The test command includes the 11 Step 1 math tests, 3 bulk-setup tests and 2 admin/staff render tests. It verifies meter widths, non-roll labels, invalid/duplicate batches, cost valuation, low-stock highlighting, pending legacy counts, last-started information, and staff cost hiding. Firebase integration/security and interactive browser submission are manual checks below; these are not claimed as automated coverage.

1. Point the app at a test project or connect both emulators before any reads, as described in `INVENTORY_STEP_1.md`. The checked-in Firebase configuration has not been redirected. Do not perform these write tests against the live project.
2. Admin → Inventory → Large Format → Setup: add Flex Banner, unit roll. Add `1.07, 1.1, 1.3, 1.6, 1.8`, reorder 1, with an optional reference length. Verify five zero-unit variants and five zero-unit Opening records. Try the same widths again; no duplicate variants should be created.
3. Receive 3 units at 450,000 UGX for one variant, Paid. Verify quantity 3, average 450,000 and value 1,350,000. Start one; verify quantity 2 and a Start entry for 450,000 charged to the selected department. No meter fields or Expenses should change.
4. Receive 1 more at 500,000 plus 10,000 freight on Credit. Verify quantity 3, average 470,000 and supplier payable 510,000. Two units at 450,000 plus one landed at 510,000 give inventory value 1,410,000.
5. Digital/Bizhub → Setup: add Plain Paper, unit ream, variants A3/A4. Add Toner, unit cartridge, variants Cyan/Magenta/Yellow/Black. DTF: add Ink, unit bottle, and five colours. Verify these stay out of Calculator roll selections and show the appropriate Start button.
6. Review a legacy variant's reorder threshold in units. Verify the review reminder disappears and highlighting applies at or below the threshold. Unmigrated records must still require physical-count migration.
7. Deactivate a stocked variant after confirmation. Verify it is hidden by default, retained under Show inactive, unavailable for Calculator selection and still included in valuation. Reactivate it and verify its stock/history are preserved.
8. In Setup add a resale category and attribute labels. Add a resale product with opening quantity 5 and purchase price 10,000. Verify the Opening and value 50,000. Edit it: quantity is visible as text, not editable. Restock 5 at 12,000; quantity becomes 10 and average cost 11,000. For a missing-cost legacy product, enter reviewed cost and verify quantity does not change.
9. Sign in as staff. Inventory is available, Materials/Resale products are visible, and stored average cost, valuation, Setup/Reports, product edit and deactivation controls are absent. Receive asks for the new invoice price; Start does not display COGS. At zero stock staff Start is disabled. Actual role enforcement depends on your deployed rules: the rules merge is still pending.
10. Verify existing Calculator pricing for a large-format roll, DTF preset, and resale product. Existing pricing tier IDs and calculations remain unchanged.

## Scope and remaining work

Count/Adjust and full movement history are Step 3. Sales/Dashboard still have legacy usage logging and sale writes; their replacement, module/COGS stamping and reversal wiring are Step 3. Do not treat this as a completed production rollout. Do not use legacy Sales/Dashboard stock actions after migrating test data. Dashboard and full reports are Step 4; the Inventory Reports tab currently shows only department stock valuation at cost, including inactive stock and excluding missing-cost/uncounted records.

The Step 1 proposed rules are still a **merge proposal**, not deployment-ready. In particular, the conservative product rules still deny staff product writes until multi-product sale/reversal permissions are integrated and tested in Step 3. No claim is made that unknown deployed Firebase rules already enforce these controls. Provide the entire currently published Firestore Rules tab, project ID and database ID for a safe merge; do not provide credentials.

Wait for the user's “continue” before Step 3.

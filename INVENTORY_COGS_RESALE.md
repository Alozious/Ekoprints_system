# COGS reports and unopened material resale

## Behavior

- Business Reports now uses one ordered financial row: Total invoiced, Cash collected, Cost of goods (COGS), Gross profit, Operating expenses, Stock adjustments (net), Net profit, Inventory value. The separate profit section and department breakdown were removed. Dashboard and Inventory profit calculations share the same cash-collected basis.
- COGS = dated Start movement costs + saved sale-line COGS for products and unopened material resales. Purchases and Opening balances are excluded. A Sale ledger entry is not counted a second time.
- Every financial card follows the existing period, custom-date/range and department filters. Department selection uses saved module identifiers, with Calculator metadata for older lines, never name keywords. Invoice totals and receipts, including discount/tax shares, are allocated proportionally across departments. Gross profit = selected-period cash collected - selected-period COGS. Net profit = gross profit - operating expenses - signed stock adjustments. Receipts are filtered by payment date even when the invoice is older. Uganda dates are used by the profit calculation and custom-date defaults.
- The Business Reports inventory card/table show closing value at the selected period end, grouped by department. Current periods use current carrying cost; past periods reconstruct signed unit/cost movements from recorded Opening history. Missing history is excluded/flagged, and fully unavailable historical values say No history rather than inventing a zero balance. Inventory → Reports shows all-time profit for the selected department and current stock valued at average cost. Uncounted/missing-cost records are excluded and flagged. Inactive stock still carries value.
- Every active, counted material variant has **Sell unopened** when at least one unopened unit is available. Open Inventory → Materials → expand material → Sell unopened, enter whole units and selling price, then Continue to invoice. Choose the customer/payment details and save through the existing Sales flow. No stock is deducted merely by preparing an invoice.
- Invoice save rereads all relevant material/product documents in one Firestore transaction, blocks insufficient stock, deducts whole units, snapshots average-cost COGS, and writes a Sale movement. No Start is generated for a resale. Services keep COGS=0 at sale time because their material cost was recognized by Start.
- Sale edits reverse old issues at original cost before applying new issues. Voiding a new-format sale restores stock with linked Reversal entries and retains a voided sale record. Payment/notes-only updates preserve original COGS and movement references. Duplicate new-sale submits are blocked while a save is running.
- Old per-job usage buttons are disabled and the App meter-write callback is blocked, so an unopened resale cannot also be deducted as guessed printing usage. The old modal source remains pending the wider Step 3 cleanup.

## Files changed

`reportAccounting.ts`, `components/ProfitReport.tsx`, `components/ReportsView.tsx`, `components/DashboardView.tsx`, `components/InventoryView.tsx`, `components/SalesView.tsx`, `stockService.ts`, `App.tsx`, `types.ts`, `reportAccounting.test.mjs`, `stockService.test.mjs`, `package.json`.

## Validation

```powershell
npm run test:accounting
npm run test:inventory
npx tsc --noEmit
npm run build
```

The accounting tests cover Start/resale COGS without double counting, discount/tax allocation, adjustment signs, Uganda date boundaries, historical missing costs, unopened material issues, all-or-nothing mixed sales, edit/void reversals after restocks, and preservation of movement references on notes/payment updates. Stock-service tests use an isolated in-memory transaction adapter, not Firebase or a running emulator.

Browser checks verified COGS in both report screens, the Sell unopened dialog, and the block when requested resale quantity exceeds available units. No test invoice or resale was saved to the connected project during implementation.

For a full integration test, use the project copy/emulator: receive 3 units at 100,000, sell 1 at 150,000, and verify 2 unopened units remain with resale COGS=100,000 and gross profit=50,000. Start 1 more and verify an additional 100,000 COGS, leaving 1 unopened unit. Edit/void the resale and verify only the sold unit is restored; the started unit must remain consumed. Try simultaneous resales against the last unit: only one should succeed.

## Existing data and rollout limits

Historical sales without COGS snapshots remain flagged; current average costs are not used to invent past costs. Their profit is provisional. Legacy stock-affecting sale edits/voids require a reviewed reconciliation; notes/payment-only changes remain available. Existing expense history has not been reclassified or deleted.

Cost/profit figures are hidden from staff in the new screens. UI hiding is not confidentiality because underlying cost documents are still readable. The proposed Firestore rule merge is still pending the entire published Rules tab; no rules were deployed or weakened. In particular, the existing draft restricts staff resale writes and needs review/testing for the now-connected material/product sale paths before deployment. The remaining full inventory reconciliation, supplier/cash-flow reports, history/count UI, and rule/emulator work are not claimed complete by this change.

Browser checks for the consolidated row: This Month + LF matched cash collected minus COGS and operating expenses; custom Oct 1–21 filtered out Oct 22 Starts and flagged missing historical inventory openings. No business data was written by these checks.

# Marketing

Open **Marketing** in the administrator sidebar. Choose **SMS Marketing** or **WhatsApp**.

## SMS setup and campaigns

1. In EGO SMS, open Settings > API Settings and obtain the API username and password. Use a sender ID configured in that account.
2. Enter those values in **EGO SMS API setup**, save, and use **Check balance** to verify credentials without sending a message.
3. Create a campaign, select customers (optionally filter by district/category), and write the message. Choose all contacts or the first contact per customer. Invalid contacts are excluded and repeated phone numbers receive only one message. Review individual contacts to exclude any unwanted numbers.
4. Save the draft, review its complete message and audience, and use the explicit send control. A campaign supports up to 1,000 unique contacts.
5. The result shows accepted/rejected/unknown, the provider cost and tracking code when available. Accepted is not handset delivery. After an uncertain result or interrupted submission, inspect EGO SMS before creating another campaign; the app does not automatically retry it.

WhatsApp campaigns save drafts and provide individual prefilled chat links. They do not automatically send messages or report delivery.

## Running and storage

`npm run dev` serves both the app and Marketing API through Vite. `npm run build` followed by `npm start` serves the built app and API from a Node server. `npm run preview` also includes the API. Node 22 or later is recommended.

Campaigns and EGO SMS credentials are stored on this server in `.marketing.local/store.json`, excluded from Git and blocked by Vite's file access rules. Back up and restrict operating-system access to this directory: it contains credentials and campaign contact lists. Credentials never go to Firestore, localStorage, client bundles, or API read responses. Use one server process for this file store. This is local persistent storage, not cross-machine cloud synchronization.

Every API request requires a Firebase ID token, verified with Firebase Auth, and an administrator role from the existing Firestore user record. Existing Firestore security rules must protect role changes. Marketing is limited to localhost by default. For deployment, set `MARKETING_ORIGIN` to the exact HTTPS origin, terminate TLS at the hosting proxy, and set `HOST`/`PORT` as appropriate. Serve the Node backend; static hosting alone cannot send SMS. Do not expose the data directory as static content.

Delivery webhooks need a publicly reachable protected endpoint. They are not connected in this localhost version. Check EGO SMS for delivery details. Never treat an accepted request as proof of delivery.

## Provider references

- https://developers.pahappa.com/docs/sending-sms/api-specs-and-usage/
- https://developers.pahappa.com/docs/balance-inquiry/api-specs-and-usage/
- https://developers.pahappa.com/docs/transaction-status/api-specs-and-usage/

## Verification

`node --experimental-strip-types --test server/marketing.test.mjs marketing.test.mjs customerImport.test.mjs` runs server tests using stub provider responses. No live SMS is sent. This also checks audience selection and the existing customer import behavior.


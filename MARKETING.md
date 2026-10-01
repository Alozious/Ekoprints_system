# Marketing

Administrators open **Marketing**, then **SMS Marketing** or **WhatsApp**.

## SMS settings

Enter the API username and API password from EGO SMS Settings > API Settings and click **Save SMS settings to Firebase**. Sender ID is optional; blank uses the provider default, EgoSMS. Use an approved sender ID if your account requires one. **Check balance** verifies the saved credentials without sending SMS.

Credentials are stored encrypted with AES-256-GCM in Firestore at `marketingSettings/egoSms`. The API never returns the password to the browser. Existing credentials are retained when the password box is left blank with the same username. Changing the username requires a password. Saving both values replaces existing settings.

The encryption key stays on the backend in `.marketing.local/encryption.key`, or can be supplied as a base64 encoded 32-byte `MARKETING_ENCRYPTION_KEY`. Back it up securely: another server needs the same key to decrypt Firebase settings. If the key is lost, enter and save both credentials again. No real credentials are included in source control. Legacy local credentials are removed after a successful Firebase settings save.

Firebase requests use the signed-in user's ID token. Existing Firestore rules must permit administrators to read/write `marketingSettings/egoSms` and protect the user role records against unauthorized edits. No security rules are deployed or loosened automatically. A denied Firebase save displays an error rather than claiming success. For a ruleset that currently denies this collection, merge an admin-only match into the existing rules (do not replace unrelated rules):

```
match /marketingSettings/{settingId} {
  allow read, write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

## Campaign audiences

Select system customers by category, search text, district text, or customer registration date range (inclusive, Africa/Kampala time). Sort by name or registration date. Selection is stored by customer ID independently of the visible filter, so changing search, filters or sort retains checked customers. **Select filtered customers** adds to the selection. **Clear selection** explicitly clears system and manual contacts.

Add manual contacts by name and phone; slash-separated numbers are accepted and standardized to +256. Manual contacts belong to the campaign only, not the customer registry. Repeated numbers across all sources receive one message. Review/exclude individual contacts before saving. Maximum 1,000 contacts per campaign.

Write the message, save a draft, review, then explicitly send. The app records accepted/rejected/unknown, cost and tracking code when provided. Accepted is not handset delivery. After an uncertain or interrupted submission, inspect EGO SMS before another send; the app does not automatically retry.

WhatsApp campaigns provide individual prefilled chat links. They do not automatically send messages or report delivery.

## Running and storage

`npm run dev` serves the app and Marketing API. `npm run build` then `npm start` serves the production build and API. `npm run preview` also includes the API. Node 24.5+ is recommended so managed operating-system certificate roots can be used while retaining TLS verification.

Campaigns remain in `.marketing.local/store.json`; only SMS settings are stored in Firebase. Restrict operating-system access and back up this directory. It is ignored by Git and blocked by Vite file-serving rules. Use one backend process for the local campaign store.

Every API request requires Firebase authentication and an administrator role. Marketing is limited to localhost by default. For deployment, set `MARKETING_ORIGIN` to the exact HTTPS origin and configure `HOST`/`PORT`. Serve the Node backend through TLS; static hosting alone cannot send SMS. Never serve the data directory publicly.

Delivery webhooks are not connected on localhost. Check EGO SMS for delivery details.

## References and checks

- https://developers.pahappa.com/docs/sending-sms/api-specs-and-usage/
- https://developers.pahappa.com/docs/balance-inquiry/api-specs-and-usage/

Run `node --experimental-strip-types --test server/marketing.test.mjs server/firebaseSettings.test.mjs marketing.test.mjs customerImport.test.mjs` for mocked-provider and Firebase persistence tests. Tests send no live SMS and do not modify production Firebase.

# Passwords

The Passwords page is a secure vault for storing credentials and secrets. It uses KeePassXC encryption to keep your data safe.

## First-time vault setup

If you have not set up a vault before, Falcon Dash will guide you through creating one. You will choose a master password that protects all entries in the vault. Keep this password somewhere safe -- it cannot be recovered if lost.

## Unlocking the vault

Each time you visit the Passwords page, you need to unlock the vault by entering your master password. The vault locks automatically when you leave the page or after a period of inactivity.

You can also lock the vault manually by clicking the "Lock" button in the top toolbar.

## Browsing passwords

Once unlocked, you see a list of all stored entries. Click any entry to view its details.

## Viewing a password

When you select an entry, Falcon Dash shows its details including the username, website, and any notes. The password itself is hidden by default. Use the reveal or copy options to see or use it:

- **Reveal** -- shows the password in plain text.
- **Copy** -- copies the password to your clipboard so you can paste it where needed.

## Adding a new password

Click the "+ Add Entry" button in the toolbar. A form appears where you can enter:

- A title for the entry.
- The username or email.
- The password.
- The website URL.
- Any additional notes.

Click "Save" when you are finished.

## Editing a password

Open an existing entry and click "Edit." Make your changes in the form and save.

## Importing secrets

If you have secrets stored elsewhere that you want to bring into the vault, click the "Import Secrets" button in the toolbar. This opens a migration tool that helps you move credentials into the vault in bulk.

Click "Back to Passwords" when the import is complete.

## Security notes

- Your vault is encrypted locally using KeePassXC. Falcon Dash never stores your master password.
- The vault stays locked until you explicitly unlock it with your master password.
- Always use a strong, unique master password.
- When you are done working with passwords, lock the vault or navigate away from the page.

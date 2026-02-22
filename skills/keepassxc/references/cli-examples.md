# keepassxc-cli Reference

All commands authenticate with keyfile — no master password prompt.

```
VAULT=~/.openclaw/passwords.kdbx
AUTH="--no-password --key-file ~/.openclaw/vault.key"
```

## List entries

```bash
# List all entries recursively with full paths
keepassxc-cli ls $AUTH -R -f $VAULT
```

## Show entry (with password)

```bash
keepassxc-cli show $AUTH $VAULT "Services/GitHub"
```

## Show entry (metadata only, no password)

```bash
keepassxc-cli show $AUTH -s $VAULT "Services/GitHub"
```

## Add entry

```bash
# Basic entry (prompts for password via stdin)
keepassxc-cli add $AUTH $VAULT "Services/NewService" \
    -u "admin@example.com" \
    --url "https://example.com" \
    -p <<< "the-password"

# Entry without password
keepassxc-cli add $AUTH $VAULT "Notes/SomeNote"
```

## Edit entry

```bash
# Update username
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" -u "new-user"

# Update URL
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" --url "https://new-url.com"

# Update title
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" -t "GitHub Enterprise"

# Update notes
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" -n "Updated 2026-02"

# Update password (prompts via stdin)
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" -p <<< "new-password"
```

## Custom attributes

```bash
# Set a custom attribute
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" \
    --set-attribute "api-scope" \
    --attribute-value "repo,read:org"

# Remove a custom attribute
keepassxc-cli edit $AUTH $VAULT "Services/GitHub" \
    --remove-attribute "api-scope"
```

## Delete entry

```bash
keepassxc-cli rm $AUTH $VAULT "Services/OldService"
```

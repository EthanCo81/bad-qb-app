# bad-qb-app

Discord button → modal (two names) → Google Sheet. The row also stores the Discord username that opened the form.

Sheet columns written: `timestamp`, `discord_username`, `discord_user_id`, `name1`, `name2`.

## Setup

### 1. Discord

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. Bot tab: create a bot, copy the token.
3. OAuth2 → URL Generator: scopes `bot` and `applications.commands`. Bot permission: **Send Messages**.
4. Invite the bot to your server.
5. Copy the application ID (that is `DISCORD_CLIENT_ID`). Optionally copy the server ID for `DISCORD_GUILD_ID`.

### 2. Google Sheet

1. Create a Google Cloud project, enable **Google Sheets API**.
2. Create a **service account**, download the JSON key, save it as `service-account.json` in this folder.
3. Share the spreadsheet with the service account email (`...@...iam.gserviceaccount.com`) as **Editor**.
4. Put the spreadsheet ID (from the sheet URL) in `.env`.
5. First row can be headers: `timestamp | discord_username | discord_user_id | name1 | name2`.

### 3. Run

```bash
cp .env.example .env
# fill in .env and place service-account.json
npm install
npm start
```

`/post-button` is registered when the bot starts. Use `DISCORD_GUILD_ID` so it appears immediately on that server.

In Discord, run `/post-button` in the channel where you want the button. Click **Log two names**, fill the modal, submit.

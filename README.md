# bad-qb-app

Discord **/pick** command → two searchable QBs → Google Sheet. The row also stores the Discord username that submitted.

No Google Cloud project or service account. The bot POSTs to a small **Apps Script** attached to the spreadsheet (runs as your Google account).

Sheet columns written: `timestamp`, `discord_username`, `discord_user_id`, `name1`, `name2`, `week`, `score_1`, `score_2`.

On each pick, `week` is the Tuesday-start week number (1, 2, 3, …). `score_1` / `score_2` stay blank until the **Tuesday after that week**. Then the bot fills them with that QB's fantasy points using [League of Villains](https://sleeper.com/leagues/1322259662862581760) scoring (`SLEEPER_LEAGUE_ID`) and Sleeper's public stats API. The bot retries every minute until stats exist (so it still works if you start it mid-Tuesday).

After scores land, Apps Script writes a readable tab named **Week 1**, **Week 2**, and so on. Each tab lists username, both picks, both scores, that week's total, and a **season total** (all weeks combined). Older week tabs are refreshed so season totals stay current.

## Setup

### 1. Discord

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications).
2. Bot tab: create a bot, copy the token. Enable **Server Members Intent** (required so the bot can see who is in `#bad-qb` for the daily reminder).
3. OAuth2 → URL Generator: scopes `bot` and `applications.commands`. Bot permissions: **Send Messages**, **Mention Members** if shown (otherwise Send Messages is enough to ping users).
4. Invite the bot to your server.
5. Copy the application ID (that is `DISCORD_CLIENT_ID`). Optionally copy the server ID for `DISCORD_GUILD_ID`.

Every day at **11:00** (`DISPLAY_TIMEZONE`, default America/Chicago) the bot posts in `#bad-qb` and tags members who can see that channel and have not submitted this week. Override with `DISCORD_NUDGE_CHANNEL` / `DISCORD_NUDGE_HOUR` in `.env`. Keep `npm start` running or that reminder will not fire.

### 2. Google Sheet via Apps Script

1. Create or open the spreadsheet. Optional header row: `timestamp | discord_username | discord_user_id | name1 | name2 | week | score_1 | score_2`.
2. **Extensions** → **Apps Script**.
3. Replace the default `Code.gs` with the contents of `apps-script/Code.gs` from this repo. Save.
4. **Project Settings** (gear) → **Script properties** → add:
   - `WEBHOOK_SECRET` — any long random string
   - `SHEET_TAB` — optional, defaults to `Sheet1`
5. **Deploy** → **New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Deploy, then copy the web app URL into `.env` as `SHEETS_WEBHOOK_URL`. Put the same secret in `SHEETS_WEBHOOK_SECRET`.

“Anyone” is required so the bot can POST without a Google login. The secret is what keeps strangers from writing to the sheet. If you change the script later, **Deploy** → **Manage deployments** → edit → **New version**. After a 405, restart the bot as well: Node must POST through Google's redirects (opening `/exec` in a browser is a GET).

The weekly message title is **Bad QB picks for week X**. Week 1 starts Tuesday **2026-09-08** (through Monday 9/14); week 2 starts Tuesday 9/15, and so on. Picks are logged with **/pick**: type in each QB field to search the list. Edit `src/qbs.js` to change the names. The channel embed does **not** list anyone's picks. Timezone is `DISPLAY_TIMEZONE` in `.env` (default `America/Chicago`). Re-run `/post-message` after upgrading so the bot can track that message.

### 3. Run

```bash
cp .env.example .env
# fill in Discord vars, SHEETS_WEBHOOK_URL, and SHEETS_WEBHOOK_SECRET
npm install
npm start
```

`/post-message` and `/pick` register when the bot starts. Use `DISCORD_GUILD_ID` so they appear immediately on that server.

In Discord, run `/post-message` in the channel where you want the weekly message. Log names with `/pick` and type to search each QB.

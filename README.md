# 🎉 Discord Giveaway Bot (v14)

A fast, self-hosted **Discord.js v14** Giveaway Bot with interactive button entries, admin quick-end controls, crash-proof JSON auto-saving, and VIP/Booster bonus entry multipliers.

---

## ✨ Features

* **Modern Button Entries:** Users join with a single click on the **Enter Giveaway** button—no messy emoji reactions.
* **Admin "End Now" Button:** Staff can immediately end any active giveaway early and pick a winner with one click.
* **Crash-Proof Auto-Saving (`giveaways.json`):** Active giveaways and entries are automatically saved to disk and resume seamlessly if the bot restarts.
* **VIP & Booster Multipliers:** Give Server Boosters or VIP roles `2x`, `3x`, or custom bonus entry chances in `config.json`.
* **Role Requirements:** Restrict specific giveaways so only members with a chosen role can enter.
* **Instant Rerolls:** Pick a new winner from an ended giveaway anytime using `/giveaway reroll`.

---

## 🛠️ Commands

| Command | Description |
| :--- | :--- |
| `/giveaway start` | Start a new giveaway with a prize, duration (minutes), winner count, and optional role requirement. |
| `/giveaway reroll` | Pick a new winner for an ended giveaway using its Message ID. |

---

## 🚀 Quick Setup (3 Minutes)

### 1. Prerequisites
* Install [Node.js](https://nodejs.org) (LTS version recommended).

### 2. Create Your Bot on Discord
1. Go to the [Discord Developer Portal](https://discord.com) and click **New Application**.
2. Copy your **Application ID** from the **General Information** tab.
3. Go to the **Bot** tab, click **Reset Token**, and copy your **Bot Token**.
4. Scroll down to **Privileged Gateway Intents**, enable **Server Members Intent**, and click **Save Changes**.
5. Go to **OAuth2 → URL Generator**, check `bot` and `applications.commands`, select `Administrator` permissions, and invite the bot to your server.

### 3. Configure & Run
1. Download or clone this repository.
2. Open `config.json` and paste your Bot Token and Application ID:
   ```json
   {
     "token": "PASTE_YOUR_BOT_TOKEN_HERE",
     "clientId": "PASTE_YOUR_APPLICATION_ID_HERE",
     "embedColor": "#5865F2",
     "hostRoleId": "",
     "bonusRoles": {
       "OPTIONAL_BOOSTER_ROLE_ID": 2
     }
   }
   ```
3. Open a terminal in the project folder and run:
   ```bash
   npm install
   node index.js
   ```

---

## 💬 Custom Bots & Support
Want custom features added to this bot or need a custom Discord bot built for your server? Feel free to open an issue or reach out!

# Putting Towventure online — the easy way

This gets the game running on your own Ubuntu server so you and your friends can play.
You need: a VPS running **Ubuntu 22.04 or 24.04** (you have one at Hostinger) and its
IP address + root login. A domain name is **optional** (see the bottom).

Everything below is copy-paste. The script installs Docker, opens the firewall, makes
your passwords, and starts the game behind automatic HTTPS. It's safe to run again.

---

## 1. Connect to your server

From your own computer's terminal (Hostinger shows you the IP and root password):

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Run one command

```bash
curl -fsSL https://raw.githubusercontent.com/EinPallux/Towventure/claude/phase-1-vzddey/ops/deploy.sh | sudo bash
```

It will ask you **one question**: your domain. If you don't have one, **just press Enter**
— it will use your server's IP with automatic HTTPS. Then it builds and starts everything
(the first build takes a few minutes). When it finishes it prints your link, e.g.
`https://203-0-113-5.sslip.io`.

> Prefer to see the files first? Do this instead of the one-liner:
> ```bash
> sudo apt install -y git
> git clone -b claude/phase-1-vzddey https://github.com/EinPallux/Towventure.git /opt/towventure
> cd /opt/towventure && sudo bash ops/deploy.sh
> ```

## 3. Open it and make yourself the admin

1. Open the link it printed, and **register** your account in the game.
2. Back in the server terminal, make that account an admin:
   ```bash
   cd /opt/towventure
   sudo bash ops/deploy.sh admin YOUR_ACCOUNT_NAME
   ```
   Refresh the page — a **⚔ Admin** button appears in the top bar (moderation, broadcasts, etc.).

## 4. Send your friends the link. That's it 🎉

---

## Everyday commands

Run these from the server (`cd /opt/towventure` first):

| Command | What it does |
|---|---|
| `sudo bash ops/deploy.sh logs`   | Watch what's happening live (Ctrl-C to exit) |
| `sudo bash ops/deploy.sh status` | Show what's running |
| `sudo bash ops/deploy.sh update` | Get the latest game version + restart |
| `sudo bash ops/deploy.sh backup` | Save a database backup right now |
| `sudo bash ops/deploy.sh stop`   | Pause the game (`start` resumes it) |

**Backups happen automatically every day** and are kept on the server. To also copy them
off-server (recommended before you rely on it), set `RCLONE_REMOTE` in `/opt/towventure/.env`.

## Using your own domain (optional, removes the one-time browser note)

The IP/`sslip.io` option works out of the box. If you'd rather use a nice name like
`play.yourgame.com`:

1. In your domain provider, add an **A record** pointing that name to your server's IP.
2. On the server: `cd /opt/towventure`, edit `.env`, set `SITE_ADDRESS=play.yourgame.com`
   and `PUBLIC_ORIGIN=https://play.yourgame.com`, then run `sudo bash ops/deploy.sh update`.

Caddy fetches a free, trusted HTTPS certificate automatically — no extra steps.

## If something's off

- **"Not answering yet."** — the first HTTPS certificate can take a minute. Wait, then open
  the link again, or check `sudo bash ops/deploy.sh logs`.
- **Custom domain not loading?** — make sure its A record points to the server IP (DNS can
  take a few minutes to update), then re-run `update`.
- **Start completely fresh?** — `cd /opt/towventure && docker compose down -v` wipes
  everything (including all accounts), then run the deploy again.

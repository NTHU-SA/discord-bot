# NTHUSA hosting and handoff guide

This guide deploys [NTHU-SA/discord-bot](https://github.com/NTHU-SA/discord-bot) on infrastructure owned and operated by NTHUSA. That infrastructure has **not been inspected or changed for this fork**. The Linux + Docker Compose recipe below is a reference for their operator to adapt after confirming the host. It does not assume a hostname, existing login, reverse proxy, or secret store.

The Discord Developer Portal owns the application registration and credentials. The bot processes run on NTHUSA's host. Final bot name, avatar, domain, and description approval belong to NTHUSA.

## 1. Record the deployment decisions

Have the association's operator fill this in before running host commands.

| Item                        | Record                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Operator and backup contact | Who can administer and recover this service                                                                        |
| Host and runtime            | OS, CPU architecture, Docker Engine/Compose availability, orchestration policy                                     |
| Capacity                    | Available memory, CPU, disk, and storage monitoring; allow room for worker images, models, and retained workspaces |
| Network                     | Chosen domain, DNS owner, TLS/reverse proxy, outbound access                                                       |
| Storage                     | Persistent volume location, encrypted backup destination, retention, restore owner                                 |
| Application ownership       | NTHUSA Discord team, application ID, selected name/avatar, guild ID                                                |
| Privileged operator         | Discord user ID allowed to request repository changes and deployment                                               |
| Service accounts            | NTHUSA-managed Codex, GitHub, Google, registry access, and secret store                                            |
| Optional destinations       | X accounts/channels, PR repositories/channel/reviewer mapping                                                      |

Use an always-on Linux host with Docker Engine and Compose for this recipe. Images target AMD64 and ARM64. If NTHUSA uses another orchestrator, preserve the boundaries in [architecture.md](architecture.md) and adapt mounts, health checks, networking, and deployment integration with its operator. Do not install this stack over an existing service or reuse its volumes by accident.

## 2. Create a separate Discord application

Use an NTHUSA-controlled [Discord Developer Team](https://support-dev.discord.com/hc/en-us/articles/34905563063703-Creating-and-Managing-a-Developer-Team), with an identified owner and backup maintainer. Create a new application in the [Developer Portal](https://discord.com/developers/applications). Record recovery ownership in the association's handoff records.

In General Information and Bot settings, choose the application name, bot username, icon/avatar, and description. Set `NTHUSA_BOT_NAME` to the chosen display name in both core and worker environment files. `NTHUSA Bot` is a placeholder. A description draft for NTHUSA to edit is:

> 清華學生會的 Discord 小幫手。支援校園資訊、文件查詢、會辦預約、提醒與專案協作。請在伺服器內標註我。

Generate a new bot token and record the application ID. Enable **Message Content Intent**. This implementation requests Guilds, Guild Messages, and Message Content; it does not request voice, DM, member-list, or presence intents. Use **Guild Install** only, with the `bot` scope. Leave the Interactions Endpoint URL empty: Calendar buttons arrive over the Gateway. See Discord's [application setup reference](https://docs.discord.com/developers/quick-start/getting-started).

Once the production environment file is filled, run this from a trusted machine with Bun and this checkout:

```sh
bun --env-file=.env.production scripts/sync-install-settings.mjs
```

The script verifies that the token belongs to the supplied application, updates install permissions, clears this application's global and configured-guild commands, and prints an invite URL. Invite the new bot to the intended NTHUSA server using that URL. See [discord-setup.md](discord-setup.md) for permission purposes. There is no `/ask`; use guild mentions/replies.

## 3. Prepare images and the host checkout

Enable Actions for the fork in GitHub if GitHub displays the fork workflow activation notice. After the stack is reviewed and merged to `main`, run or wait for **Container image** (`image.yml`). It publishes:

- `ghcr.io/nthu-sa/discord-bot:sha-<full-commit>`
- `ghcr.io/nthu-sa/discord-bot-worker:sha-<full-commit>`

Both images must come from the same commit. Confirm both builds succeeded. Configure package access for the NTHUSA host; log in to GHCR using the operator's approved method if packages are private. GitHub documents [workflow activation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).

On the confirmed host, with operator privileges, choose an unused directory. These examples use `/srv/nthusa-discord-bot/app`:

```sh
sudo install -d -m 0755 /srv/nthusa-discord-bot
sudo git clone https://github.com/NTHU-SA/discord-bot.git /srv/nthusa-discord-bot/app
cd /srv/nthusa-discord-bot/app
sudo cp .env.deploy.example .env.deploy
sudo cp .env.production.example .env.production
sudo cp .env.worker.example .env.worker
sudo chmod 600 .env.deploy .env.production .env.worker
sudo install -d -m 0755 /var/lib/nthusa-discord-bot
sudo install -d -m 0700 /var/lib/nthusa-sandbox
sudo install -d -m 0750 /run/nthusa-discord-bot
```

Edit these files with the association's approved secret-management workflow. They are ignored by Git and excluded from Docker build contexts. The inherited `MINISAGO_*` variable names are retained as technical configuration names; they do not connect to the upstream bot or its host.

In `.env.deploy`, set `NTHUSA_IMAGE_TAG=sha-<full-commit>` and choose an unused `NTHUSA_HTTP_PORT`. If changing host paths, keep the sandbox jobs path identical inside and outside its container: the broker passes these paths to the host Docker daemon.

In `.env.production`, supply the new application/token/guild, privileged owner user ID, allowed guilds or channels, and a random bridge secret of at least 32 bytes. Generate the secret locally, for example with `openssl rand -hex 32`. Copy that secret and owner ID to `.env.worker`. Set the same bot display name in both. Never copy upstream `.env` files, tokens, session directories, or state volumes.

For initial installation, leave optional X/GitHub/Google settings empty and self-deployment disabled. Fill each integration after the basic bot works. [configuration.md](configuration.md) describes every setup group.

## 4. Sign in the Linux worker

Install Bun 1.3.9 on the operator's trusted machine if using repository scripts. The worker image already includes Bun and the pinned Codex CLI. First pull images and initialize the two authentication volumes without starting the bot:

```sh
sudo docker compose --env-file .env.deploy pull
sudo docker compose --env-file .env.deploy run --rm --no-deps worker codex login --device-auth
sudo docker compose --env-file .env.deploy run --rm --no-deps worker gh auth login --hostname github.com --git-protocol https
sudo docker compose --env-file .env.deploy run --rm --no-deps worker codex login status
sudo docker compose --env-file .env.deploy run --rm --no-deps worker gh auth status
```

Use the NTHUSA-managed accounts and follow the displayed sign-in instructions. Codex device-code login may need enabling in account or workspace settings; see [Codex authentication](https://learn.chatgpt.com/docs/auth#preferred-device-code-authentication-beta). Keep authentication volumes private and recoverable by NTHUSA.

The worker discovers repositories accessible to its GitHub account. Give that account access only to the repositories it should work on. `MINISAGO_CHATBOT_REPOSITORY=NTHU-SA/discord-bot` must be among them; at least one accessible repository is required to start this worker. Ensure it can read Actions runs and create branches/PRs for the selected development workflow. Set `NTHUSA_GIT_AUTHOR_NAME` and `NTHUSA_GIT_AUTHOR_EMAIL` to an association-approved commit identity.

## 5. Start and verify

```sh
sudo docker compose --env-file .env.deploy config --quiet
sudo docker compose --env-file .env.deploy up -d --wait --wait-timeout 180
sudo docker compose --env-file .env.deploy ps
sudo docker compose --env-file .env.deploy logs --tail 100 core worker sandbox
curl --fail http://127.0.0.1:3000/api/health
```

Use the selected HTTP port in the last command. Compose waits for dependency health before starting the worker; see [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/). `/api/health` reports configuration and worker availability; HTTP 200 alone does not prove a Discord round trip or Google access. Worker `/health` is internal and returns 503 until usable.

The core binds to host loopback only. Ask NTHUSA's operator to configure its existing reverse proxy and TLS for the chosen domain. Normal Discord messages use an outbound Gateway connection; there is no public Discord interaction callback to configure. Public inbound routes needed for optional integrations are `/api/github/webhook`, `/calendar`, and `/calendar/privacy`. Worker bridge/MCP/media routes can remain private with this Compose topology. Do not publish the sandbox broker, worker health port, or Docker socket. The worker needs outbound HTTPS to Codex, GitHub, campus MCP, and configured data providers.

Before announcing the bot, check the following in the intended server:

1. A mention and a reply/follow-up work in an allowed channel. A DM produces no answer; `/ask` is absent.
2. Ordinary members cannot request repository work or owner-only expression changes. An unlisted channel outside allowed guild coverage cannot use chat.
3. A campus question and an attachment work; generate a small file and verify its filename/content. A Python request exercises the sandbox.
4. Create a short reminder, receive it, then cancel it. Save and remove a harmless server-memory fact.
5. Check quiet mode and an Instagram/X preview in a test channel. Enable ambient reactions only if the association wants them initially.
6. From the configured owner, create a small coding task, see its thread/progress, stop it, and verify repository access and PR ownership.
7. After each optional integration is configured, run its specific acceptance checks below.

## 6. Enable the retained integrations

**Drive.** Set `MINISAGO_GOOGLE_DRIVE_ACCESS=roles` and the host-only service-account JSON. The code currently binds to guild `1514899496797212683` and `discord-drive@nthusa-discord-drive.iam.gserviceaccount.com`. NTHUSA must verify the guild, approved shared-drive IDs, current term, and Google-group/Discord-role mapping in `src/chatbot/google-drive.ts` and `src/chatbot/google-drive-permissions.ts`. These are existing NTHUSA integration settings, not proof that credentials or ownership are ready. If the association chooses a different Google project or guild, change and review those bindings first; mismatched credentials are rejected. Test one accessible document and one denied document with ordinary role accounts. Sensitive student-rights drives stay outside the approved list.

**Calendar.** The code binds to the same guild, the calendar ID in `src/chatbot/google-calendar.ts`, and booking account `nthusa@gapp.nthu.edu.tw`. For guest invitations, use OAuth via the `nthusa-discord-calendar` Desktop client and `bun scripts/calendar-authorize.mjs CLIENT_JSON OUTPUT_JSON` on the operator's trusted machine. Authorize the designated account, then place compact output JSON in `MINISAGO_GOOGLE_CALENDAR_OAUTH_JSON`. The alternative service account is `discord-calendar@nthusa-discord-calendar.iam.gserviceaccount.com` and does not support guest invitations. Verify calendar sharing and Google project ownership with NTHUSA. Review `/calendar/privacy`, its contact address, and the actual backup/retention practice before publishing those pages or linking them from Google's consent configuration. Test preview, cancel, confirm, guest list, and denial of another requester's confirmation.

**X feeds.** Configure `X_POST_FEEDS_JSON` with explicit accounts, guilds, and channels. On first observation the monitor establishes its baseline; test with a later post. Feed availability depends on the configured provider. Destinations are changed through deployment configuration, not chat tools.

**GitHub review lifecycle.** Set all required variables in [configuration.md](configuration.md), then create webhooks on the allowlisted repositories pointing to `https://<chosen-domain>/api/github/webhook`, using the configured secret, JSON payloads, and Pull requests / Pull request reviews events. A draft marked ready creates its review thread; approval notifies the mapped author, and closure archives the thread. The configured reviewers other than the author are pinged. Test with a dedicated draft PR, including an unmapped author and a valid signed event for a repository outside the allowlist. No webhook should inherit personal reviewers or destinations.

## 7. Optional self-deployment

The coding and self-development features work without self-deployment. To enable deployment from Discord, NTHUSA's operator must first install the supplied host runner. It controls Docker for this one stack and remains outside the model worker. The worker has only its Unix socket, not the Docker socket or host SSH credentials.

For the reference Linux/systemd host, install Bun at the path in the unit (or edit `ExecStart`), confirm the checkout path, and determine the worker's `bun` group ID:

```sh
sudo docker compose --env-file .env.deploy run --rm --no-deps --entrypoint id worker -g bun
sudo install -m 0644 deploy/nthusa-discord-deploy.service /etc/systemd/system/nthusa-discord-deploy.service
sudo systemctl daemon-reload
sudo systemctl enable --now nthusa-discord-deploy.service
sudo systemctl status nthusa-discord-deploy.service
```

The unit defaults to worker GID 1000. Set `NTHUSA_WORKER_GID` in `/etc/nthusa-discord-deploy.env` if the command reports another GID, and restart the service. For custom paths, also set `NTHUSA_DEPLOY_CHECKOUT`, `NTHUSA_DEPLOY_SOCKET_DIR`, and `NTHUSA_DEPLOY_STATE_DIR` consistently with `.env.deploy`. Keep the checkout, unit, and environment files writable only by trusted operators.

Set `MINISAGO_DEPLOY_SOCKET=/run/nthusa-deploy/deploy.sock` in `.env.worker`, then recreate the worker. The owner can explicitly request deployment after merging code. `bun run deploy` requires a clean checkout of current `origin/main`, waits for its image workflow, and submits its full SHA and Discord channel. The runner checks that SHA against `NTHU-SA/discord-bot` main, deploys both images, waits for health, persists the tag after success, and writes status for the core to report. Only one deployment runs at a time.

The runner updates images; it does **not** update the host's Compose file, environment files, or service code. Infrastructure/configuration changes require operator review and an update of the host checkout. If the infrastructure uses another orchestrator, implement the same bounded deployment contract there before setting the worker socket variable.

## 8. Recovery and ownership transfer

See [operations.md](operations.md) for backup contents, rollback commands, and diagnosis. Rehearse a restore on an isolated instance before handoff. Keep a record of the deployed full commit, image tags, host configuration revision, account owners, secret-store entries, approved Discord/Google mappings, and last successful restore. Transfer those records and account administration to the next NTHUSA team; the original MiniSago operator is not a runtime dependency.

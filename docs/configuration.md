# Configuration

Copy the examples into three operator-managed files. Do not commit populated files.

| File              | Used by                        | Purpose                                                                                                |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `.env.deploy`     | Docker Compose / host operator | Image tag, registry names, host port and bind paths                                                    |
| `.env.production` | Core                           | Discord token, authorization, Google credentials, feeds/webhooks, persistent state                     |
| `.env.worker`     | Worker                         | Bridge authentication, owner ID, selected identity/repository, concurrency, optional deployment socket |
| `.env.local`      | Local development only         | Copy of `.env.example` for a separate test bot                                                         |

The core and worker use the same `NTHUSA_BOT_NAME`, `MINISAGO_CHATBOT_OWNER_USER_ID`, `MINISAGO_WORKER_BRIDGE_SECRET`, and worker ID (`oracle` in the reference Compose deployment). `oracle` is the retained internal development-route/worker identifier; it does not require Oracle Cloud. `MINISAGO_*` keys retain their existing technical names.

## Core settings

| Variables                                                                   | Meaning                                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`           | New application, bot token, intended install guild                                                                                                   |
| `NTHUSA_BOT_NAME`                                                           | NTHUSA-selected display name, up to 32 characters; set identically on worker and in Portal branding                                                  |
| `MINISAGO_CHATBOT_OWNER_USER_ID`                                            | One Discord user ID with development and owner-only capabilities                                                                                     |
| `MINISAGO_CHATBOT_GUILD_IDS`, `MINISAGO_CHATBOT_CHANNEL_IDS`                | Comma-separated static chat coverage. Guild coverage enables all accessible channels in that guild; use channel coverage alone for a limited rollout |
| `MINISAGO_CHATBOT_ROLE_IDS`                                                 | Role IDs whose mentions also address the bot; not requester-role grants                                                                              |
| `MINISAGO_WORKER_BRIDGE_SECRET`                                             | At least 32 random bytes, shared only between core and worker                                                                                        |
| `MINISAGO_WORKER_ID`                                                        | Authenticated worker identity; `oracle` in Compose                                                                                                   |
| `MINISAGO_AMBIENT_REACTIONS_ENABLED`                                        | Explicit `true` to enable ambient attention in covered channels; default false                                                                       |
| `MINISAGO_AMBIENT_ATTENTION_CHANCE`, `MINISAGO_AMBIENT_MAX_CHECKS_PER_HOUR` | Ambient sampling and model-call limit; examples use 0.25 and 4                                                                                       |
| `DISCORD_GATEWAY_DISABLED`                                                  | `true` for diagnostics without connecting to Discord                                                                                                 |

Owner access bypasses guild/channel chat coverage within servers where the bot is installed. DMs are always rejected. Discord channel/member permission checks still apply when resolving context. Social embed repair and configured background jobs have their own delivery paths; chat coverage is not a universal block on those services. Use Discord permissions and explicit feed/webhook destinations to control those paths.

Persistent core paths in the production example are under `/app/state`: reminders, guild memory, Calendar drafts, X checkpoints, PR threads, and deployment notification deduplication. Keep the whole core-state volume. Deployment status is read from the separate read-only `/run/deployment` mount.

## Static X feeds

Set a JSON array in `.env.production`, with one object per account/destination pair:

```dotenv
X_POST_FEEDS_JSON='[{"handle":"ACCOUNT","guildId":"123456789012345678","channelId":"234567890123456789","onlyAuthoredPosts":true}]'
X_POST_CHECK_INTERVAL_MS=300000
X_POST_STATE_DIRECTORY=/app/state/x-posts
```

Replace the placeholder account and IDs. `handle` has no `@`. An optional HTTPS `feedUrl` replaces the default FXTwitter feed URL. Multiple destinations for an account share a checkpoint and must use the same feed URL/filter. There are no default subscriptions. Restart/recreate the core after changing configuration; chat cannot edit it. An empty array disables monitoring.

## GitHub PR lifecycle

```dotenv
GITHUB_WEBHOOK_SECRET=REPLACE_WITH_RANDOM_SECRET
GITHUB_PR_REPOSITORIES=NTHU-SA/discord-bot
GITHUB_PR_THREAD_CHANNEL_ID=234567890123456789
GITHUB_REVIEWERS_JSON='{"github-login":"345678901234567890","second-login":"456789012345678901"}'
GITHUB_PR_THREAD_STATE_FILE=/app/state/github-pr-threads.json
```

Use an explicit comma-separated repository allowlist. Repository and GitHub login matching is case-insensitive. Each configured reviewer other than the author is notified once when a draft becomes ready. The mapping also identifies authors and mergers for lifecycle mentions; unmapped accounts are not mentioned. An empty mapping sends no user pings. The destination must permit public thread creation, thread messages, member addition, and message pinning. An `approved` custom emoji is used when available, otherwise ✅.

The webhook is disabled unless token, secret, repository list, and destination channel are present. The webhook accepts only signed payloads. See the hosting guide for event setup and acceptance checks.

## Google integrations

`MINISAGO_GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` stays in the core; set `MINISAGO_GOOGLE_DRIVE_ACCESS=roles` to enable it. The approved drives, current term, guild, and Google-group/Discord-role bindings are checked-in NTHUSA settings. Review them with the association before activation. Access is evaluated for the requester; the owner has no Drive-role bypass.

`MINISAGO_GOOGLE_CALENDAR_OAUTH_JSON` contains `client_id`, `client_secret`, and `refresh_token` for the designated booking account. It supports confirmed guest invitations. `MINISAGO_GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON` is an alternative without invitations when OAuth is absent. Store compact JSON in a single quoted dotenv value, preserving JSON `\n` escapes in private keys. Do not put credentials in the worker file. See [hosting](nthusa-hosting.md#6-enable-the-retained-integrations) for fixed account/project bindings and authorization.

## Worker and host

The worker gets `MINISAGO_CHATBOT_REPOSITORY=NTHU-SA/discord-bot`, the shared owner/bridge values, and NTHUSA's chosen name. GitHub discovery determines available repositories from its dedicated login. `NTHUSA_GIT_AUTHOR_NAME` and `NTHUSA_GIT_AUTHOR_EMAIL` set commit identity. The Compose file supplies private bridge/MCP/sandbox URLs; do not replace those with an upstream domain. Default concurrency is two jobs; tune after observing the host.

Set `MINISAGO_DEPLOY_SOCKET` only after installing the optional host service. `MINISAGO_DEPLOY_STATUS_FILE` and `MINISAGO_DEPLOY_NOTIFICATION_STATE_FILE` enable result reporting by the core. There is no personal SSH fallback.

`.env.deploy` selects the same immutable `NTHUSA_IMAGE_TAG` for core, worker, and sandbox. Change `NTHUSA_HTTP_PORT`, registry image names, or host bind paths only with the operator. The sandbox's jobs bind path must be identical inside and outside the container. Environment edits take effect after container recreation, for example `docker compose --env-file .env.deploy up -d`.

# NTHUSA Discord bot

NTHUSA's Discord assistant, maintained in [NTHU-SA/discord-bot](https://github.com/NTHU-SA/discord-bot), forked from [MiniSago](https://github.com/sago-cream/mini-sago).

The bot supports guild mentions, replies and follow-ups; campus information; role-aware NTHUSA Drive access; Calendar bookings with confirmation buttons; reminders; server memory; reactions; media/document processing; static X feeds; and owner-authorized repository work with coding threads and optional self-deployment.

It has no DM assistant, `/ask`, live voice, personal Mac file delivery, Skillbook synchronization, TOEFL/Bahamut jobs, Kyushu planner, arbitrary cross-channel send tool, or runtime feature/feed configuration tools. The full [feature decisions](docs/nthu-sa-fork-scope.md) record the selected scope.

## Set up an NTHUSA instance

Start with the **[NTHUSA hosting and handoff guide](docs/nthusa-hosting.md)**. It covers a new association-owned Discord application, name/avatar/description choices, separate credentials, the Linux Compose deployment, Google integrations, launch checks, and operator handoff. NTHUSA's existing infrastructure has not been inspected or deployed by this work.

- [Configuration](docs/configuration.md)
- [Discord installation and permissions](docs/discord-setup.md)
- [Architecture](docs/architecture.md) and [worker setup](docs/workers.md)
- [Operations and recovery](docs/operations.md)
- [Trust boundaries](docs/security.md)

## Local development

Use Bun 1.3.9. Copy `.env.example` to `.env.local` and configure a separate test application, guild/channel coverage, and operator ID. Worker credentials are separate; see the hosting guide. Do not run a second Gateway process with the production bot token.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run build
bun run --cwd worker build
bun test
bun --env-file=.env.local --watch src/server.ts
```

`bun run eval:prompts` is an optional live-model suite that needs Codex authentication. Unit tests use fixtures; they do not demonstrate a working production account or host. Runtime environment keys inherited as `MINISAGO_*` remain supported configuration names; branding is selected through `NTHUSA_BOT_NAME`.

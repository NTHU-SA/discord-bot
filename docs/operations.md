# Operations and recovery

Commands below assume the reference checkout and operator-managed `.env.deploy`. Use NTHUSA's actual paths and privileges. Keep one core Gateway process per bot token and upgrade core/worker together.

## Check service health

```sh
cd /srv/nthusa-discord-bot/app
sudo docker compose --env-file .env.deploy ps
sudo docker compose --env-file .env.deploy logs --tail 100 core worker sandbox
curl --fail http://127.0.0.1:3000/api/health
```

Use the configured host port. Check worker availability in the JSON response as well as HTTP status. Test a Discord mention after deployment. The internal worker `/health` endpoint reports authentication/bridge readiness. The broker's `/health` checks its Docker connection. Do not publish internal health endpoints just to monitor them; use the host or container network.

| Symptom                  | Inspect                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| No Discord response      | Correct new token/application; Gateway logs; Message Content Intent; channel permissions; coverage; quiet mode                            |
| Worker offline           | Matching bridge secret and worker ID; core reachability; `codex login status`; GitHub repository discovery; account limits                |
| Media/Python unavailable | Sandbox health, exact host jobs bind path, worker image present locally, disk space, container limits                                     |
| Drive denied             | Requester's actual Discord roles, Google group grants, approved drives, service-account identity; do not bypass access checks to diagnose |
| Calendar unavailable     | Bound guild, OAuth account/client, refresh-token validity, calendar sharing, confirmation ownership/expiry                                |
| No X post                | Explicit feed/destination settings, provider response, first-run baseline, channel/guild match                                            |
| No PR thread             | Signed webhook delivery, repository allowlist, ready-for-review event, channel permissions, persisted webhook state                       |
| Deployment unavailable   | `journalctl -u nthusa-discord-deploy.service`; socket ownership/mount; current main SHA; completed image build; GHCR pull access          |

Retained diagnostics include Codex usage windows and bounded previous-answer traces. Worker traces expire after 14 days; snapshots/backups may retain them longer according to NTHUSA's chosen policy. Logs and traces can contain request/document content, so limit access and use the association's retention rules.

## Backup and restore

Back up these as one coordinated installation:

- `.env.deploy`, `.env.production`, `.env.worker`, operator overrides/unit, and the deployed code/image SHA.
- `nthusa-discord-bot_core-state`: reminders, server-memory files and Git history, Calendar drafts, X checkpoints, PR thread state, deployment notification state.
- `nthusa-discord-bot_codex-auth` and `nthusa-discord-bot_github-auth`: the association's authenticated sessions.
- `nthusa-discord-bot_worker-state`: trace database.
- `nthusa-discord-bot_workspace`: coding workspaces and resumable work.
- The operator's deployment status directory, if self-deployment is enabled.

The names above follow the Compose project name. Confirm with `docker volume ls` before selecting volumes. Sandbox job directories are temporary processing data; do not treat them as durable artifacts.

For a simple consistent backup, arrange a maintenance window, stop the stack with `docker compose --env-file .env.deploy stop`, snapshot/export its volumes using the host's approved backup tool, and start it with `docker compose --env-file .env.deploy up -d --wait`. Alternatively, use the storage platform's coordinated snapshot procedure. Avoid copying a live SQLite file by itself. Encrypt backups containing credentials or requests, record their retention and location, and test restoration with NTHUSA's backup operator.

To restore, provision an isolated target, restore matching configuration and volumes with their ownership, pull the recorded image tags, and complete the hosting guide's smoke checks. Keep the restored core disconnected from the production token until the old instance is stopped. Expired Calendar drafts must be recreated. Verify reminder and feed checkpoints to avoid duplicate delivery. Never use `docker compose down -v` as an upgrade command: it removes persistent volumes.

## Updates and rollback

Review and merge through PRs. Deploy the same full commit image tag for core, worker, and sandbox. For manual updates, edit `NTHUSA_IMAGE_TAG` in `.env.deploy`, then:

```sh
sudo docker compose --env-file .env.deploy pull
sudo docker compose --env-file .env.deploy up -d --wait --wait-timeout 180
```

The optional host runner performs those image steps for current main only. A successful run persists the tag; a failed run records failure but may have partially restarted services. Check health and logs before retrying. Host Compose/environment/service changes are operator tasks: update the host checkout and review them separately before restarting the host runner.

To roll back, disable new deployment requests temporarily (`sudo systemctl stop nthusa-discord-deploy.service` when installed), set `NTHUSA_IMAGE_TAG` to the last known good full commit tag, and run the manual commands above. Roll back both core and worker together. If a change alters state format, follow its migration/restore instructions and use the coordinated backup as needed. Check Discord and enabled integrations before restarting the deployment service. Preserve the failed run's logs and SHA for diagnosis without posting credentials or document contents in issues.

## Handoff

Transfer the Discord Developer Team/application, GitHub repository/package access, managed Codex/GitHub accounts, Google project/calendar/drive administration, DNS/TLS, host administration, and encrypted backup access to the incoming team. Record the privileged Discord operator ID and update it in both core and worker if it changes. Rotate credentials when ownership changes, restart the relevant services, and verify one end-to-end request. The association should be able to recover the bot without access to the original developer's accounts or computers.

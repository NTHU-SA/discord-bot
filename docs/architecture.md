# Architecture

NTHUSA's bot separates Discord/Google authority from model execution.

| Component                        | Responsibilities                                                                                                                                                               | Persistent state                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Core                             | Discord Gateway/REST, requester permissions, context, reminder/feed jobs, Google integrations, Calendar confirmations, signed GitHub webhooks, request-scoped MCP/media routes | Reminders, guild memory, Calendar drafts, feed/PR checkpoints, deployment notifications |
| Linux worker                     | Authenticated job execution, Codex, request-local media tools, repository checkouts, coding thread progress/steering/resume                                                    | Codex and GitHub sessions, traces, coding workspaces                                    |
| Sandbox broker                   | Create bounded offline Python containers through Docker; clean temporary workspaces                                                                                            | Temporary job files only                                                                |
| Optional host deployment service | Verify current main SHA, deploy matching images, wait for health, record result                                                                                                | Operator-managed Compose/env files and deployment status                                |

Discord events arrive over an outbound Gateway connection. The core resolves the requester and checks coverage/permissions before reserving a worker workflow. A workflow keeps related routing, context, trace, and answer jobs on one worker. Owner requests may route to development in an accessible repository; community requests remain bounded conversation jobs. The worker returns results to the core, which performs Discord delivery.

Core credentials stay in the core. A short-lived token binds each MCP/media session to its requester and available tools. Google Drive applies Discord-role/Google-group checks; Calendar mutations require requester confirmation. Worker and core separately enforce owner-only development. The optional deployment socket accepts a fixed request format and repository/main revision, with no arbitrary host command argument.

The reference Compose stack exposes only the core's loopback HTTP port. Worker and broker health ports are internal. The broker's network is private, and Python containers have no network. Docker access is held by the broker and optional host service, not the model worker. Read [security.md](security.md) for the trust boundaries and [nthusa-hosting.md](nthusa-hosting.md) before adapting the stack to the association's host.

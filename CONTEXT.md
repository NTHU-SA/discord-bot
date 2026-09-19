# NTHUSA Discord bot

This fork is maintained in `NTHU-SA/discord-bot`. It receives guild Discord requests, assigns authorized jobs to the Linux worker, and returns results through the core. See `docs/nthu-sa-fork-scope.md` for the selected features and `docs/nthusa-hosting.md` for operator setup.

A **workflow** reserves one worker across related jobs. An **answer job** produces a chat reply or performs owner-authorized repository work. An **execution route job** classifies an owner's request before an answer job. A **trace lookup job** retrieves bounded observable metadata about an earlier answer. A **social action job** decides whether to react to a buffered conversation.

Core and worker share protocol version 37. `oracle` is the internal Linux development route/worker identifier; `MINISAGO_*` remains the technical environment prefix. Neither implies access to the upstream deployment. NTHUSA chooses the final display name through `NTHUSA_BOT_NAME` and configures the avatar in its own Discord application.

Do not reintroduce removed features or personal destinations while porting upstream changes. Keep Google/Discord authorization, Calendar confirmation, and core/worker credential separation intact. Host infrastructure and account ownership must be verified with NTHUSA rather than inferred from upstream documentation.

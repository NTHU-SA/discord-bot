# Trust boundaries

The core owns the Discord token and Google credentials. The worker owns its dedicated Codex/GitHub sessions. Host deployment and sandbox container creation are separate capabilities. Keep these credentials and persistent volumes under NTHUSA administration.

Messages, attachments, retrieved pages, repository content, and model output are untrusted input. Core tools bind identity and Discord permissions to the request; model-supplied arguments cannot select another identity. DMs are rejected. The owner-only development capability is checked again at the worker boundary. Static guild/channel coverage controls chat; Discord permissions and explicit destinations govern other delivery paths.

Google Drive applies the checked-in NTHUSA guild, approved-drive list, and Google-group/Discord-role mapping. The bot owner does not bypass those document permissions. Calendar credentials are core-only, and writes require the original requester to confirm the displayed details. Review those mappings and the public Calendar privacy text with the association before activation.

Ordinary chat does not get repository shell access. Python processing uses a broker with bounded inputs, time/memory/process limits, no container network, and no worker credentials. The broker has Docker-daemon authority and belongs on its private network. Do not expose it publicly or attach unrelated workloads to that network.

Owner-authorized coding uses the dedicated GitHub account and isolated working copies. Limit that account's repository access to the intended scope. Self-deployment is an explicit additional operator setup: the host service accepts only a full SHA matching current `NTHU-SA/discord-bot` main, pulls matching images, and uses operator-owned Compose configuration. It does not accept a shell command or change host configuration on behalf of the model.

Protect `.env` files, Codex/GitHub session volumes, operational traces, document-derived request content, and backups. Use the association's chosen encrypted storage and retention policy. See [operations.md](operations.md) for recovery and ownership transfer. Report a suspected exposure privately to the association's maintainer and rotate affected credentials; do not paste tokens or private documents into public issues.

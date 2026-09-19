# Linux worker

The supported deployment is the Linux worker in `compose.yaml`. See [worker sign-in](nthusa-hosting.md#4-sign-in-the-linux-worker) and [configuration](configuration.md#worker-and-host) for setup.

The worker connects outbound to `/api/worker/ws`, authenticates using `MINISAGO_WORKER_BRIDGE_SECRET`, and advertises chat/development capacity. Protocol version 37 requires core and worker to be updated together. The reference worker ID and internal development route are named `oracle`; this does not select a cloud provider.

Codex authentication, the dedicated GitHub login, traces, and coding workspaces live in separate persistent volumes. The GitHub account's accessible repositories determine the available coding repositories. The selected bot repository must be accessible. Only the configured Discord owner receives development capabilities, and the worker rechecks that authorization.

Ordinary answers have bounded context/media tools, including NTHU campus MCP. Offline Python runs through the private sandbox broker, which creates restricted temporary containers. The worker does not have the host Docker socket. Generated outputs are validated before Discord delivery. Coding jobs run in isolated repository checkouts and retain progress, steering, stop, and continuation support.

There is no personal Mac file search, desktop lock/session monitor, voice stream, or Skillbook synchronization. Optional self-deployment uses a host-installed bounded Unix socket; see [host runner setup](nthusa-hosting.md#7-optional-self-deployment).

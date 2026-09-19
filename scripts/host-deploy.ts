import { createServer } from "node:net";
import {
  chmod,
  chown,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";

const REPOSITORY = "https://github.com/NTHU-SA/discord-bot.git";

export function parseDeployRequest(line: string) {
  const match = /^deploy ([0-9a-f]{40}) (\d{17,20})\n$/u.exec(line);
  return match ? { commit: match[1]!, channelId: match[2]! } : null;
}

export function deploymentEnvironment(source: string, commit: string) {
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("Invalid commit SHA.");
  const lines = source
    .split("\n")
    .filter((line) => !/^\s*NTHUSA_IMAGE_TAG=/u.test(line));
  return `${lines.join("\n").trimEnd()}\nNTHUSA_IMAGE_TAG=sha-${commit}\n`;
}

async function run(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const child = Bun.spawn(args, {
    cwd,
    env,
    stdout: "pipe",
    stderr: "inherit",
  });
  const timer = setTimeout(() => child.kill(), 15 * 60_000);
  try {
    const [stdout, code] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ]);
    if (code !== 0) throw new Error(`${args[0]} exited ${code}`);
    return stdout.trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function startHostDeploy() {
  const root = resolve(
    process.env.NTHUSA_DEPLOY_CHECKOUT || "/srv/nthusa-discord-bot/app",
  );
  const socketDirectory =
    process.env.NTHUSA_DEPLOY_SOCKET_DIR || "/run/nthusa-discord-bot";
  const statusDirectory =
    process.env.NTHUSA_DEPLOY_STATE_DIR || "/var/lib/nthusa-discord-bot";
  const socketPath = join(socketDirectory, "deploy.sock");
  const workerGid = Number(process.env.NTHUSA_WORKER_GID || "1000");
  if (!Number.isInteger(workerGid) || workerGid < 0)
    throw new Error("Invalid worker GID.");
  await mkdir(socketDirectory, { recursive: true, mode: 0o750 });
  await mkdir(statusDirectory, { recursive: true, mode: 0o755 });
  await chown(socketDirectory, 0, workerGid);
  await chmod(statusDirectory, 0o755);
  // The service manager owns the singleton process and removes stale sockets on restart.
  await unlink(socketPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  let busy = false;
  const server = createServer((socket) => {
    socket.setTimeout(10_000, () => socket.destroy());
    socket.setEncoding("utf8");
    let input = "";
    let handled = false;
    socket.on("error", (error) =>
      console.error("Deploy connection:", error.message),
    );
    socket.on("data", async (data) => {
      if (handled) return;
      input += data;
      if (Buffer.byteLength(input) > 128) {
        handled = true;
        socket.end("invalid request\n");
        return;
      }
      if (!input.includes("\n")) return;
      handled = true;
      const request = parseDeployRequest(input);
      if (!request || busy) {
        socket.end(request ? "busy\n" : "invalid request\n");
        return;
      }
      busy = true;
      try {
        const remote = await run(
          ["git", "ls-remote", "--exit-code", REPOSITORY, "refs/heads/main"],
          root,
        );
        if (remote.split(/\s/u)[0] !== request.commit) {
          socket.end("commit is not current main\n");
          return;
        }
        socket.end(`accepted ${request.commit}\n`);
        let exitCode = 0;
        try {
          const env = {
            ...process.env,
            NTHUSA_IMAGE_TAG: `sha-${request.commit}`,
          };
          const compose = ["docker", "compose", "--env-file", ".env.deploy"];
          // Compose and secrets are operator-managed; application code comes from immutable images.
          await run([...compose, "pull"], root, env);
          await run(
            [...compose, "up", "-d", "--wait", "--wait-timeout", "180"],
            root,
            env,
          );
          const envFile = join(root, ".env.deploy");
          await writeFile(
            `${envFile}.next`,
            deploymentEnvironment(
              await readFile(envFile, "utf8"),
              request.commit,
            ),
            { mode: 0o600 },
          );
          await rename(`${envFile}.next`, envFile);
        } catch (error) {
          exitCode = 1;
          console.error("Deployment failed:", error);
        }
        const statusPath = join(statusDirectory, "deploy-status.json");
        await writeFile(
          `${statusPath}.next`,
          JSON.stringify({
            ...request,
            status: exitCode ? "failed" : "complete",
            exitCode,
            updatedAt: new Date().toISOString(),
          }) + "\n",
          { mode: 0o644 },
        );
        await chmod(`${statusPath}.next`, 0o644);
        await rename(`${statusPath}.next`, statusPath);
      } catch (error) {
        console.error(error);
        if (!socket.writableEnded) socket.end("deployment unavailable\n");
      } finally {
        busy = false;
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  await chown(socketPath, 0, workerGid);
  await chmod(socketPath, 0o660);
  console.log(`NTHUSA deployment runner listening on ${socketPath}`);
  return server;
}

if (import.meta.main) await startHostDeploy();

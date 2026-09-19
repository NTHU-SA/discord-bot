import { execFileSync, spawnSync } from "node:child_process";

import { requestMinisagoDeployment } from "./deploy-socket";

const repository = "NTHU-SA/discord-bot";
const workflow = "image.yml";
function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasRemote(name) {
  return output("git", ["remote"]).split("\n").includes(name);
}

function remoteBranchCommit(remote, branch) {
  return output("git", [
    "ls-remote",
    "--exit-code",
    remote,
    `refs/heads/${branch}`,
  ]).split(/\s/u)[0];
}

async function deploy(commit) {
  const deploySocket = process.env.MINISAGO_DEPLOY_SOCKET?.trim();
  if (!deploySocket) {
    throw new Error(
      "MINISAGO_DEPLOY_SOCKET is required. Ask the NTHUSA host operator to install the deployment runner described in docs/nthusa-hosting.md.",
    );
  }

  const channelId = process.env.MINISAGO_DISCORD_CHANNEL_ID?.trim() || "";
  await requestMinisagoDeployment(deploySocket, commit, channelId);
  console.log(
    `NTHUSA Bot deployment for ${commit} was accepted. The core and worker will restart.`,
  );
}

function waitForImage(commit) {
  let runId = "";

  for (let attempt = 0; attempt < 30 && !runId; attempt += 1) {
    const runs = JSON.parse(
      output("gh", [
        "run",
        "list",
        "--repo",
        repository,
        "--workflow",
        workflow,
        "--commit",
        commit,
        "--limit",
        "1",
        "--json",
        "databaseId",
      ]),
    );

    runId = runs[0]?.databaseId?.toString() ?? "";
    if (!runId) run("sleep", ["2"]);
  }

  if (!runId) {
    console.error(`No ${workflow} run appeared for ${commit}.`);
    process.exit(1);
  }

  run("gh", ["run", "watch", runId, "--repo", repository, "--exit-status"]);
}

const branch = output("git", ["branch", "--show-current"]);

if (branch !== "main") {
  console.error(
    `Deploy from main. Current branch is ${branch || "(detached)"}.`,
  );
  process.exit(1);
}

if (output("git", ["status", "--porcelain"])) {
  console.error("Commit or stash local changes before deploying.");
  process.exit(1);
}

if (!hasRemote("origin")) {
  console.error("Missing origin remote.");
  process.exit(1);
}

const commit = output("git", ["rev-parse", "HEAD"]);
const remoteCommit = remoteBranchCommit("origin", branch);

if (commit !== remoteCommit) {
  console.error(
    "Local main does not match origin/main. Merge changes through a PR, then update local main before deploying. This script never pushes code.",
  );
  process.exit(1);
}

waitForImage(commit);
await deploy(commit);

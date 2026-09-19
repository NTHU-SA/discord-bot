import { access } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { isIP } from "node:net";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  getChatbotAccessConfig,
  type ChatbotAccessConfig,
} from "../../src/chatbot/access";

export type WorkerConfig = {
  bridgeUrl: string;
  bridgeSecret: string;
  codexHome: string;
  codexPath: string;
  deploySocketPath?: string;
  githubConfigDir: string;
  githubRepositories: string[];
  chatbotRepository?: string;
  chatbotAccess: ChatbotAccessConfig;
  githubWorktreeRoot: string;
  maxConcurrentJobs: number;
  mcpUrl: string;
  sandboxUrl: string;
  traceDatabasePath: string;
  workspaceRoot: string;
  workerId: string;
};

const bundledCodexPath = "/Applications/ChatGPT.app/Contents/Resources/codex";
const defaultApplicationSupport =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "NTHUSA Bot")
    : join(homedir(), ".local", "state", "minisago");

export function deploySocketPath(
  configured = process.env.MINISAGO_DEPLOY_SOCKET,
) {
  const path = configured?.trim();
  if (!path) return undefined;
  if (!isAbsolute(path)) {
    throw new Error("MINISAGO_DEPLOY_SOCKET must be an absolute path.");
  }
  return resolve(path);
}

async function isExecutable(path: string) {
  try {
    await access(path, 1);
    return true;
  } catch {
    return false;
  }
}

async function resolveCodexPath() {
  const configured = process.env.MINISAGO_CODEX_PATH?.trim();
  const candidates = [configured, bundledCodexPath, Bun.which("codex")].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No working Codex executable was found. Set MINISAGO_CODEX_PATH.",
  );
}

export async function discoverGitHubRepositories(githubConfigDir: string) {
  const child = Bun.spawn(
    [
      "gh",
      "api",
      "--paginate",
      "user/repos?per_page=100&affiliation=owner,collaborator,organization_member",
      "--jq",
      ".[].full_name",
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        GH_CONFIG_DIR: githubConfigDir,
        GH_HOST: "github.com",
        GH_PROMPT_DISABLED: "1",
      },
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      stderr.trim().split("\n").at(-1) || "GitHub repository discovery failed.",
    );
  }
  return parseGitHubRepositories(stdout);
}

export function parseGitHubRepositories(stdout: string) {
  const repositories = stdout
    .split("\n")
    .map((repository) => repository.trim())
    .filter((repository) => /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(repository));
  return [...new Set(repositories)].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
}

export function validateBridgeUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  const ipVersion = isIP(hostname);
  const isLocal =
    ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    (ipVersion === 0 && !hostname.includes(".") && !hostname.includes(":"));

  if (url.protocol !== "wss:" && !(isLocal && url.protocol === "ws:")) {
    throw new Error(
      "MINISAGO_BRIDGE_URL must use wss:// unless it is local or container-local.",
    );
  }

  return url.toString();
}

export function validateMcpUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  const ipVersion = isIP(hostname);
  const isLocal =
    ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    (ipVersion === 0 && !hostname.includes(".") && !hostname.includes(":"));

  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error(
      "MINISAGO_MCP_URL must use https:// unless it is local or container-local.",
    );
  }

  return url.toString();
}

function defaultMcpUrl(bridgeUrl: string) {
  const url = new URL(bridgeUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/api/chatbot/mcp";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function workspaceChild(root: string, candidate: string, name: string) {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(candidate);
  const pathFromRoot = relative(absoluteRoot, absoluteCandidate);
  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(
      `${name} must be a directory inside MINISAGO_WORKSPACE_ROOT.`,
    );
  }
  return absoluteCandidate;
}

export async function loadWorkerConfig(
  discoverRepositories = discoverGitHubRepositories,
): Promise<WorkerConfig> {
  const chatbotAccess = getChatbotAccessConfig();
  const bridgeSecret = process.env.MINISAGO_WORKER_BRIDGE_SECRET?.trim();

  if (!bridgeSecret || Buffer.byteLength(bridgeSecret) < 32) {
    throw new Error(
      "MINISAGO_WORKER_BRIDGE_SECRET must contain at least 32 bytes.",
    );
  }
  const defaultWorkerId = `linux-${hostname()}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 64);
  const workerId = process.env.MINISAGO_WORKER_ID?.trim() || defaultWorkerId;
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(workerId)) {
    throw new Error("MINISAGO_WORKER_ID must be a safe 1-64 character ID.");
  }
  const githubConfigDir =
    process.env.MINISAGO_GITHUB_CONFIG_DIR?.trim() ||
    join(defaultApplicationSupport, "github");
  const githubRepositories = await discoverRepositories(githubConfigDir);
  if (githubRepositories.length === 0) {
    throw new Error(
      "The worker GitHub account has no accessible repositories.",
    );
  }
  const configuredChatbotRepository =
    process.env.MINISAGO_CHATBOT_REPOSITORY?.trim();
  if (
    configuredChatbotRepository &&
    !githubRepositories.some(
      (repository) =>
        repository.toLocaleLowerCase("en-US") ===
        configuredChatbotRepository.toLocaleLowerCase("en-US"),
    )
  ) {
    throw new Error(
      "MINISAGO_CHATBOT_REPOSITORY must name an accessible GitHub repository.",
    );
  }
  const chatbotRepository =
    configuredChatbotRepository ||
    (githubRepositories.length === 1 ? githubRepositories[0] : undefined);
  const workspaceRoot =
    process.env.MINISAGO_WORKSPACE_ROOT?.trim() || join(homedir(), "Projects");
  const githubWorktreeRoot = workspaceChild(
    workspaceRoot,
    process.env.MINISAGO_GITHUB_WORKTREE_ROOT?.trim() ||
      join(workspaceRoot, "worktrees"),
    "MINISAGO_GITHUB_WORKTREE_ROOT",
  );

  const bridgeUrl = validateBridgeUrl(
    process.env.MINISAGO_BRIDGE_URL?.trim() || "ws://core:3000/api/worker/ws",
  );

  return {
    bridgeUrl,
    bridgeSecret,
    codexHome:
      process.env.MINISAGO_CODEX_HOME?.trim() ||
      join(defaultApplicationSupport, "codex-home"),
    codexPath: await resolveCodexPath(),
    deploySocketPath: deploySocketPath(),
    githubConfigDir,
    githubRepositories,
    chatbotRepository,
    chatbotAccess,
    githubWorktreeRoot,
    maxConcurrentJobs: Math.max(
      1,
      Math.min(
        16,
        Number.parseInt(process.env.MINISAGO_MAX_CONCURRENT_JOBS || "2", 10) ||
          2,
      ),
    ),
    mcpUrl: validateMcpUrl(
      process.env.MINISAGO_MCP_URL?.trim() || defaultMcpUrl(bridgeUrl),
    ),
    sandboxUrl: validateMcpUrl(
      process.env.MINISAGO_SANDBOX_URL?.trim() || "http://sandbox:8080",
    ),
    traceDatabasePath:
      process.env.MINISAGO_TRACE_DATABASE_PATH?.trim() ||
      join(defaultApplicationSupport, "traces.sqlite"),
    workspaceRoot,
    workerId,
  };
}

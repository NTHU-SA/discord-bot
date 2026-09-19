import { z } from "zod";
import { join } from "node:path";
import { createDiscordRequest } from "../api/request";
import {
  deliverToServiceDestinations,
  type ServiceDestination,
} from "../service-subscriptions";
import { decodeEntities, readJsonFile, writeJsonFile } from "./job-utils";
const DEFAULT_CHECK_INTERVAL_MS = 300_000;
const STATE_CHECKPOINT_INTERVAL_MS = 3_600_000;
const USER_AGENT = "MiniSago/0.1";

export type XPost = {
  id: string;
  text: string;
  url: string;
  publishedAt?: string;
  imageUrl?: string;
};

type XPostMonitorConfig = {
  destinations: ServiceDestination[];
  botToken: string;
  handle: string;
  feedUrl: string;
  stateFile: string;
  checkIntervalMs: number;
  onlyAuthoredPosts: boolean;
};

type XPostState = {
  lastPostId?: string;
  lastPostUrl?: string;
  lastCheckedAt?: string;
};

type DiscordChannel = {
  guild_id?: string;
};

function readElement(xml: string, name: string) {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
    "i",
  ).exec(xml);

  if (!match) {
    return undefined;
  }

  const value = match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
  return decodeEntities(value.trim());
}

function htmlToText(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPostId(url: string) {
  return /\/status\/(\d+)/.exec(url)?.[1];
}

function extractEnclosureUrl(itemXml: string) {
  const tag = /<enclosure\b[^>]*>/i.exec(itemXml)?.[0];
  const url = tag ? /\burl=(?:"([^"]+)"|'([^']+)')/i.exec(tag) : undefined;
  return url ? decodeEntities(url[1] ?? url[2]) : undefined;
}

export function parseXPosts(feedXml: string) {
  const posts: XPost[] = [];

  for (const match of feedXml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const itemXml = match[1];
    const url = readElement(itemXml, "link");
    const id = url ? extractPostId(url) : undefined;

    if (!url || !id) {
      continue;
    }

    const description = readElement(itemXml, "description");
    const title = readElement(itemXml, "title") ?? "";

    posts.push({
      id,
      text: description ? htmlToText(description) : title,
      url,
      publishedAt: readElement(itemXml, "pubDate"),
      imageUrl: extractEnclosureUrl(itemXml),
    });
  }

  return posts;
}

export function isXPostAuthoredBy(post: XPost, handle: string) {
  try {
    const postHandle = new URL(post.url).pathname.split("/").filter(Boolean)[0];
    return postHandle?.toLowerCase() === handle.toLowerCase();
  } catch {
    return false;
  }
}

function comparePostIds(a: string, b: string) {
  return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
}

export function shouldCheckpointXPostState(
  lastCheckedAt: string | undefined,
  now: Date,
) {
  if (!lastCheckedAt) {
    return true;
  }

  const lastCheckedTime = Date.parse(lastCheckedAt);

  return (
    !Number.isFinite(lastCheckedTime) ||
    now.getTime() - lastCheckedTime >= STATE_CHECKPOINT_INTERVAL_MS
  );
}

export function buildXPostMessage(
  post: XPost,
  handle = new URL(post.url).pathname.split("/")[1],
) {
  return {
    content: `https://fxtwitter.com/${handle}/status/${post.id}`,
    allowed_mentions: { parse: [] as [] },
  };
}

function parseCheckIntervalMs(value: string | undefined) {
  if (!value) {
    return DEFAULT_CHECK_INTERVAL_MS;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 10_000) {
    throw new Error(
      `X_POST_CHECK_INTERVAL_MS must be at least 10000: ${value}`,
    );
  }

  return parsed;
}

const feedSchema = z
  .object({
    handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
    guildId: z.string().regex(/^\d{17,20}$/),
    channelId: z.string().regex(/^\d{17,20}$/),
    feedUrl: z
      .url()
      .refine((value) => new URL(value).protocol === "https:")
      .optional(),
    onlyAuthoredPosts: z.boolean().default(false),
  })
  .strict();

export function getXPostMonitorConfigs(
  env: NodeJS.ProcessEnv = process.env,
): XPostMonitorConfig[] {
  if (env.X_POST_MONITOR_DISABLED === "true" || !env.DISCORD_BOT_TOKEN?.trim())
    return [];
  const feeds = z
    .array(feedSchema)
    .max(20)
    .parse(JSON.parse(env.X_POST_FEEDS_JSON || "[]"));
  const groups = new Map<string, XPostMonitorConfig>();
  const stateRoot =
    env.X_POST_STATE_DIRECTORY?.trim() ||
    (env.NODE_ENV === "production" ? "/app/state/x-posts" : ".data/x-posts");
  for (const feed of feeds) {
    const key = feed.handle.toLowerCase();
    const feedUrl =
      feed.feedUrl ||
      "https://fxtwitter.com/" + feed.handle + "/feed.xml?count=20";
    let config = groups.get(key);
    if (
      config &&
      (config.feedUrl !== feedUrl ||
        config.onlyAuthoredPosts !== feed.onlyAuthoredPosts)
    )
      throw new Error("Conflicting X feed settings for @" + feed.handle);
    if (!config) {
      config = {
        botToken: env.DISCORD_BOT_TOKEN.trim(),
        handle: feed.handle,
        feedUrl,
        stateFile: join(stateRoot, key + ".json"),
        onlyAuthoredPosts: feed.onlyAuthoredPosts,
        checkIntervalMs: parseCheckIntervalMs(env.X_POST_CHECK_INTERVAL_MS),
        destinations: [],
      };
      groups.set(key, config);
    }
    if (
      !config.destinations.some(
        (destination) => destination.channelId === feed.channelId,
      )
    )
      config.destinations.push({
        guildId: feed.guildId,
        channelId: feed.channelId,
      });
  }
  return [...groups.values()];
}

async function fetchLatestXPosts(feedUrl: string) {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(
      `X feed returned ${response.status}: ${await response.text()}`,
    );
  }

  return parseXPosts(await response.text());
}

async function sendXPost(
  config: XPostMonitorConfig,
  destination: ServiceDestination,
  post: XPost,
) {
  const discordRequest = createDiscordRequest(config.botToken);
  const channel = await discordRequest<DiscordChannel>(
    `/channels/${destination.channelId}`,
  );

  if (channel?.guild_id !== destination.guildId) {
    throw new Error(
      `X post channel ${destination.channelId} belongs to guild ${channel?.guild_id ?? "unknown"}, not configured guild ${destination.guildId}.`,
    );
  }

  await discordRequest(`/channels/${destination.channelId}/messages`, {
    method: "POST",
    body: buildXPostMessage(post, config.handle),
  });
}

async function sendXPostAlertsIfNeeded(
  config: XPostMonitorConfig,
  now = new Date(),
) {
  const destinations = config.destinations;
  if (destinations.length === 0) return;

  const feedPosts = await fetchLatestXPosts(config.feedUrl);
  const latestPost = feedPosts
    .sort((a, b) => comparePostIds(a.id, b.id))
    .at(-1);

  if (!latestPost) {
    throw new Error("X feed did not contain any posts.");
  }

  const state = await readJsonFile<XPostState>(config.stateFile, () => ({}));

  if (!state.lastPostId) {
    await writeJsonFile(config.stateFile, {
      lastPostId: latestPost.id,
      lastPostUrl: latestPost.url,
      lastCheckedAt: now.toISOString(),
    });
    console.log(
      `Initialized @${config.handle} X post monitor at ${latestPost.id}; future posts will be sent.`,
    );
    return;
  }

  const newPosts = feedPosts
    .filter(
      (post) =>
        !config.onlyAuthoredPosts || isXPostAuthoredBy(post, config.handle),
    )
    .filter((post) => comparePostIds(post.id, state.lastPostId ?? "0") > 0)
    .sort((a, b) => comparePostIds(a.id, b.id));

  for (const post of newPosts) {
    const delivery = await deliverToServiceDestinations(
      destinations,
      (destination) => sendXPost(config, destination, post),
    );
    if (delivery.failedChannelIds.length) {
      console.warn(
        `@${config.handle} X post ${post.id} failed for channels ${delivery.failedChannelIds.join(", ")}.`,
      );
    }
    await writeJsonFile(config.stateFile, {
      lastPostId: post.id,
      lastPostUrl: post.url,
      lastCheckedAt: now.toISOString(),
    });
    console.log(
      `Sent @${config.handle} X post ${post.id} to ${delivery.delivered} Discord channel(s).`,
    );
  }

  if (
    newPosts.length === 0 &&
    shouldCheckpointXPostState(state.lastCheckedAt, now)
  ) {
    await writeJsonFile(config.stateFile, {
      ...state,
      lastCheckedAt: now.toISOString(),
    });
  }
}

export function startXPostMonitor() {
  const configs = getXPostMonitorConfigs();

  if (configs.length === 0) {
    return null;
  }

  return configs.map((config) => {
    let running = false;
    const tick = async () => {
      if (running) {
        return;
      }

      running = true;

      try {
        await sendXPostAlertsIfNeeded(config);
      } catch (error) {
        console.error(`Failed to check @${config.handle} X posts:`, error);
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), config.checkIntervalMs);
    console.log(
      `X post monitor enabled for @${config.handle} every ${config.checkIntervalMs}ms.`,
    );
    return timer;
  });
}

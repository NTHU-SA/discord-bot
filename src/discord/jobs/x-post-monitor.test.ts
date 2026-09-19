import { describe, expect, test } from "bun:test";

import {
  buildXPostMessage,
  getXPostMonitorConfigs,
  isXPostAuthoredBy,
  parseXPosts,
  shouldCheckpointXPostState,
} from "./x-post-monitor";

const sampleFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Shortened post…</title>
    <link>https://x.com/thsottiaux/status/2078320950488297917</link>
    <guid>https://x.com/thsottiaux/status/2078320950488297917</guid>
    <pubDate>Sat, 18 Jul 2026 03:28:22 GMT</pubDate>
    <enclosure url="https://pbs.twimg.com/media/example.jpg?name=orig&amp;format=jpg" type="image/jpeg" />
    <description><![CDATA[<p>Full post &amp; details.<br />Second line.</p>
      <blockquote><a href="https://x.com/example/status/1">Quoted post</a></blockquote>]]></description>
  </item>
</channel></rss>`;

describe("X post monitor", () => {
  test("parses post identity, full text, date, and image from FxTwitter RSS", () => {
    expect(parseXPosts(sampleFeed)).toEqual([
      {
        id: "2078320950488297917",
        text: "Full post & details.\nSecond line.",
        url: "https://x.com/thsottiaux/status/2078320950488297917",
        publishedAt: "Sat, 18 Jul 2026 03:28:22 GMT",
        imageUrl:
          "https://pbs.twimg.com/media/example.jpg?name=orig&format=jpg",
      },
    ]);
  });

  test("builds a Discord-friendly FxTwitter link without mentions", () => {
    const [post] = parseXPosts(sampleFeed);

    expect(buildXPostMessage(post)).toEqual({
      content: "https://fxtwitter.com/thsottiaux/status/2078320950488297917",
      allowed_mentions: { parse: [] },
    });
  });

  test("identifies posts authored by the monitored account", () => {
    expect(
      isXPostAuthoredBy(
        {
          id: "1",
          text: "Official post",
          url: "https://x.com/hololive_dreams/status/1",
        },
        "hololive_dreams",
      ),
    ).toBe(true);
    expect(
      isXPostAuthoredBy(
        {
          id: "2",
          text: "Retweeted member post",
          url: "https://x.com/oozorasubaru/status/2",
        },
        "hololive_dreams",
      ),
    ).toBe(false);
  });

  test("has no personal feed defaults and groups configured destinations", () => {
    expect(getXPostMonitorConfigs({ DISCORD_BOT_TOKEN: "test-token" })).toEqual(
      [],
    );
    const configs = getXPostMonitorConfigs({
      DISCORD_BOT_TOKEN: "test-token",
      X_POST_STATE_DIRECTORY: "/app/state/x-posts",
      X_POST_FEEDS_JSON: JSON.stringify([
        {
          handle: "nthusa",
          guildId: "123456789012345678",
          channelId: "223456789012345678",
        },
        {
          handle: "nthusa",
          guildId: "123456789012345678",
          channelId: "323456789012345678",
        },
      ]),
    });
    expect(configs).toHaveLength(1);
    expect(configs[0]!.destinations).toHaveLength(2);
    expect(configs[0]!.stateFile).toBe("/app/state/x-posts/nthusa.json");
    expect(configs[0]!.feedUrl).toBe(
      "https://fxtwitter.com/nthusa/feed.xml?count=20",
    );
  });

  test("rejects unsafe feed handles and destinations", () => {
    expect(() =>
      getXPostMonitorConfigs({
        DISCORD_BOT_TOKEN: "test-token",
        X_POST_FEEDS_JSON: JSON.stringify([
          {
            handle: "../escape",
            guildId: "123456789012345678",
            channelId: "223456789012345678",
          },
        ]),
      }),
    ).toThrow();
  });

  test("checkpoints idle state no more than once per hour", () => {
    const now = new Date("2026-07-18T06:00:00.000Z");

    expect(shouldCheckpointXPostState(undefined, now)).toBe(true);
    expect(shouldCheckpointXPostState("2026-07-18T05:30:00.000Z", now)).toBe(
      false,
    );
    expect(shouldCheckpointXPostState("2026-07-18T05:00:00.000Z", now)).toBe(
      true,
    );
  });
});

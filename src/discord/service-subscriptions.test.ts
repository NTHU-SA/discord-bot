import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { deliverToServiceDestinations } from "./service-subscriptions";

describe("service subscriptions", () => {
  test("keeps healthy destinations running when one delivery fails", async () => {
    const destinations = [
      { guildId: "123456789012345678", channelId: "223456789012345678" },
      { guildId: "123456789012345678", channelId: "323456789012345678" },
    ];
    const result = await deliverToServiceDestinations(
      destinations,
      async ({ channelId }) => {
        if (channelId === "223456789012345678") throw new Error("forbidden");
      },
    );

    expect(result).toEqual({
      delivered: 1,
      failedChannelIds: ["223456789012345678"],
    });
  });
});

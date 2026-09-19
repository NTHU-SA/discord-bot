import { expect, test } from "bun:test";
import { FeatureAvailabilityStore } from "./feature-availability";

test("deployment coverage requires a server and gates ambient reactions separately", () => {
  const env = {
    MINISAGO_CHATBOT_OWNER_USER_ID: "123456789012345678",
    MINISAGO_CHATBOT_GUILD_IDS: "223456789012345678",
    MINISAGO_CHATBOT_CHANNEL_IDS: "323456789012345678",
  };
  const coverage = new FeatureAvailabilityStore(env);
  expect(
    coverage.isEnabled("chatbot", { guildId: env.MINISAGO_CHATBOT_GUILD_IDS }),
  ).toBe(true);
  expect(coverage.isEnabled("chatbot", { guildId: "423456789012345678" })).toBe(
    false,
  );
  expect(
    coverage.isEnabled("chatbot", {
      channelId: env.MINISAGO_CHATBOT_CHANNEL_IDS,
    }),
  ).toBe(false);
  expect(
    coverage.isEnabled("chatbot", {
      guildId: "423456789012345678",
      channelId: env.MINISAGO_CHATBOT_CHANNEL_IDS,
    }),
  ).toBe(true);
  expect(
    coverage.isEnabled("ambient_reactions", {
      guildId: env.MINISAGO_CHATBOT_GUILD_IDS,
    }),
  ).toBe(false);
  expect(
    new FeatureAvailabilityStore({
      ...env,
      MINISAGO_AMBIENT_REACTIONS_ENABLED: "true",
    }).isEnabled("ambient_reactions", {
      guildId: env.MINISAGO_CHATBOT_GUILD_IDS,
    }),
  ).toBe(true);
});

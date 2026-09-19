export function getPublicDiscordSummary() {
  return {
    hasApplicationId: Boolean(process.env.DISCORD_APPLICATION_ID?.trim()),
    hasBotToken: Boolean(process.env.DISCORD_BOT_TOKEN?.trim()),
    hasGuildId: Boolean(process.env.DISCORD_GUILD_ID?.trim()),
  };
}

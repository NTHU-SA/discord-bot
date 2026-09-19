import { getChatbotAccessConfig } from "../chatbot/access";

/** Feature coverage is deployment configuration, read once at startup. */
export class FeatureAvailabilityStore {
  private readonly access;
  private readonly ambient;
  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.access = getChatbotAccessConfig(environment);
    this.ambient = environment.MINISAGO_AMBIENT_REACTIONS_ENABLED === "true";
  }
  isEnabled(
    feature: "chatbot" | "ambient_reactions",
    context: { guildId?: string; channelId?: string },
  ) {
    if (!context.guildId) return false;
    const covered =
      this.access.guildIds.has(context.guildId) ||
      (context.channelId !== undefined &&
        this.access.channelIds.has(context.channelId));
    return covered && (feature === "chatbot" || this.ambient);
  }
}
let shared: FeatureAvailabilityStore | undefined;
export function getFeatureAvailabilityStore() {
  return (shared ??= new FeatureAvailabilityStore());
}

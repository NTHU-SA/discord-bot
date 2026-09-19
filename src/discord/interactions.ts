export type DiscordApplicationCommandInteraction = {
  id: string;
  application_id: string;
  token: string;
  type: number;
  channel_id?: string;
  guild_id?: string;
  data?: {
    custom_id?: string;
    type?: number;
    name?: string;
    options?: Array<{
      type?: number;
      name?: string;
      value?: unknown;
    }>;
  };
  member?: {
    roles?: string[];
    nick?: string | null;
    user?: DiscordInteractionUser;
  };
  user?: DiscordInteractionUser;
};

type DiscordInteractionUser = {
  id?: string;
  username?: string;
  global_name?: string | null;
  bot?: boolean;
};

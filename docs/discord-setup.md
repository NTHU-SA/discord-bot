# Discord setup

Follow [NTHUSA hosting](nthusa-hosting.md#2-create-a-separate-discord-application) to create a new team-owned application. NTHUSA selects the name, avatar, description, and server. The application token must be separate from upstream MiniSago.

The bot uses server mentions, replies, and short follow-ups. It rejects DMs and has no slash commands. Enable Message Content Intent in the Portal. Guilds and Guild Messages are standard intents requested in code. Calendar confirmation buttons are received through the Gateway, so the Interactions Endpoint URL stays empty.

Run `bun --env-file=.env.production scripts/sync-install-settings.mjs` with the new application's credentials. It validates application/token identity, updates the install settings, clears this application's commands, and prints its invite URL. Configure Guild Install only. The script requests:

| Permission                                                      | Retained feature                           |
| --------------------------------------------------------------- | ------------------------------------------ |
| View Channel, Send Messages, Read Message History               | Conversation, context, reminders and feeds |
| Add Reactions                                                   | Requested and ambient reactions            |
| Embed Links, Attach Files                                       | Source links and generated artifacts       |
| Manage Messages, Manage Webhooks                                | Social link replacement/preview handling   |
| Manage/Create Guild Expressions                                 | Owner-authorized emoji/sticker operations  |
| Create Public Threads, Send Messages in Threads, Manage Threads | Coding and PR lifecycle threads            |
| Pin Messages                                                    | PR review thread summary                   |

Administrator, Connect, and Speak are not requested. Channel permission overrides still apply. Review the installed bot role and restrict access to the intended server channels. For a limited assistant rollout, configure individual allowed channels instead of enabling a whole guild. See Discord's [permission definitions](https://docs.discord.com/developers/topics/permissions).

`MINISAGO_CHATBOT_ROLE_IDS` names role IDs whose mentions should also address the bot; it is not a requester-role permission grant. Drive authorization uses its separately reviewed role/group mapping. The configured owner can request development work; other members cannot acquire that capability by mentioning a role.

Test Calendar buttons with the requester and another member, verify DMs stay unanswered, and confirm `/ask` is absent before launch. If an application reused for testing previously registered commands in other guilds, clear those application-owned guild commands too; the setup script targets global commands and `DISCORD_GUILD_ID`.

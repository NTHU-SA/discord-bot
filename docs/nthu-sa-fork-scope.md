# NTHU-SA fork scope

Feature decisions for `NTHU-SA/discord-bot`, collected in batches of five.
The implementation follows this scope. Live setup and deployment belong to NTHUSA's operators; see [the hosting guide](nthusa-hosting.md).

Of 40 feature groups, 28 are retained and 12 are removed. Discord entry points
are retained with two exclusions: direct-message requests and `/ask`.

## Feature decisions

| #   | Feature                         | Decision                  | Scope                                                                                                                                                   |
| --- | ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Text assistant                  | Keep                      | Q&A, writing, summaries, reasoning, and public web search.                                                                                              |
| 2   | Discord entry points            | Keep with changes         | Keep mentions, replies, and follow-ups. Remove DM requests and `/ask`.                                                                                  |
| 3   | Discord context                 | Keep                      | Conversation history, permission-filtered message search, and member lookup.                                                                            |
| 4   | NTHU campus assistant           | Keep                      | Campus information, buses, courses, announcements, dining, library, newsletters, and electricity usage.                                                 |
| 5   | NTHUSA Drive search             | Keep                      | Shared-drive listing, file search, and folder browsing.                                                                                                 |
| 6   | NTHUSA document reading         | Keep                      | Docs, Slides, PDFs, Word, spreadsheets, and text with source links.                                                                                     |
| 7   | Drive access control            | Keep                      | Discord roles and Google group permissions restrict document access.                                                                                    |
| 8   | Office-space Calendar bookings  | Keep                      | View, create, and edit bookings; guest invitations; requester confirmation through Discord buttons.                                                     |
| 9   | Threads search / 海巡脆         | Keep                      | On-demand searches for 清大, NTHU, 學生會, and additional keywords.                                                                                     |
| 10  | Reminders                       | Keep                      | One-time and recurring reminders; list, edit, cancel, and requester pings.                                                                              |
| 11  | Conditional reminders           | Keep                      | Skip an occurrence when a specified person already posted an image that day.                                                                            |
| 12  | Server memory                   | Keep                      | Remember, correct, and forget durable server knowledge.                                                                                                 |
| 13  | Quiet mode                      | Keep                      | Temporarily pause replies and automatic channel activity.                                                                                               |
| 14  | Attachment understanding        | Keep                      | Attached or replied-to images, PDFs, text, and supported audio/video inputs.                                                                            |
| 15  | Python processing               | Keep                      | Offline computation, document reading, image analysis, background removal, and file generation.                                                         |
| 16  | Image transformations           | Keep                      | Convert, resize, crop/fit, and rotate images.                                                                                                           |
| 17  | Audio/video transformations     | Keep                      | Inspect media, extract frames, and generate short MP4, MP3, or GIF files.                                                                               |
| 18  | Reply reactions                 | Keep                      | Unicode or custom emoji reactions to requests.                                                                                                          |
| 19  | Ambient reactions               | Keep                      | Occasional reactions without a mention.                                                                                                                 |
| 20  | Emoji/sticker management        | Keep                      | Create expressions, copy emojis between servers, list emojis, and rename them; currently owner-only.                                                    |
| 21  | Cross-channel messaging         | Cut                       | Remove the tool for sending an arbitrary requested message to another server/channel.                                                                   |
| 22  | Social embed repair             | Keep                      | Improve Instagram/X previews through replacement messages or link replies.                                                                              |
| 23  | Quick-reply nudge               | Cut                       | Remove the nudge targeting a hardcoded person.                                                                                                          |
| 24  | Voice conversations             | Cut                       | Remove live voice-channel transcription and spoken replies.                                                                                             |
| 25  | Voice diagnostics/lab           | Cut                       | Remove the dashboard, tuning, browser recordings, and recognition comparisons.                                                                          |
| 26  | Daily TOEFL vocabulary          | Cut                       | Remove scheduled vocabulary posts.                                                                                                                      |
| 27  | Bahamut/AniGamer monitor        | Cut                       | Remove forum monitoring and reposting.                                                                                                                  |
| 28  | X feed monitors                 | Keep                      | Automatically repost from configured X accounts.                                                                                                        |
| 29  | Kyushu trip planner             | Cut                       | Remove shared travel-itinerary tools.                                                                                                                   |
| 30  | Repository coding agent         | Keep                      | Debugging, code edits, tests, issues, and PR creation/explicitly requested merging; currently owner-only.                                               |
| 31  | Coding-task Discord threads     | Keep                      | Progress, status, steering, stop, and continuation in dedicated threads.                                                                                |
| 32  | Self-development/deployment     | Keep                      | Modify the bot's code, deploy it, and report deployment results.                                                                                        |
| 33  | GitHub review automation        | Keep                      | Review threads, reviewer pings, approval/merge reports, and thread archival.                                                                            |
| 34  | Skillbook synchronization       | Cut                       | Remove automatic synchronization of development skills.                                                                                                 |
| 35  | Mac file delivery               | Cut                       | Remove searching local Mac folders and sending requested files.                                                                                         |
| 36  | Sago Media access notifications | Cut                       | Remove owner DMs for Sago Media access requests.                                                                                                        |
| 37  | Runtime feature controls        | Cut                       | Remove chat tools for changing feature coverage by server/channel.                                                                                      |
| 38  | Feed subscriptions              | Cut                       | Remove chat tools for changing background-feed destination channels.                                                                                    |
| 39  | Diagnostics                     | Keep                      | Worker health, Codex usage/reset information, and previous-answer trace lookup.                                                                         |
| 40  | Conversational personality      | Keep with NTHUSA branding | Retain the conversational style, Taiwanese slang, and first-person rules. NTHUSA chooses the bot name/avatar; identity is configured for this instance. |

## Implementation implications

- Keep the Python/media runtime: it supports retained document reading and
  media processing. Removing live voice does not remove audio/video attachment
  processing.
- Keep a worker capable of chat and development. Removing Mac file delivery
  does not remove the repository coding agent or its Discord threads.
- Keep permission enforcement and guild/channel authorization. Removing runtime
  configuration tools does not remove access controls.
- X monitoring still needs account and destination configuration. Use deployment
  configuration for these settings after removing chat-based subscription changes.
- Remove arbitrary cross-channel messaging while retaining the specific message
  delivery required by reminders, feeds, coding threads, and review automation.
- Retarget personal repository references, Discord IDs, GitHub user mappings,
  credentials, state locations, and deployment destinations to the new instance.
  Retaining a feature does not select its existing personal destinations.

## Instance setup

- Repository: [NTHU-SA/discord-bot](https://github.com/NTHU-SA/discord-bot).
- Host: NTHUSA's existing infrastructure, which has not been inspected or changed for this fork.
- Name/avatar: choices for NTHUSA during setup; `NTHUSA_BOT_NAME` configures the name in core and worker.
- Application, operator ID, destinations, reviewers, accounts, and credentials: explicit NTHUSA settings with no personal defaults.
- Deployment: a complete Linux Compose reference and optional bounded host deployment service. Their operator must verify that recipe fits the actual infrastructure.

The [hosting guide](nthusa-hosting.md) includes application ownership, branding, launch checks, backup/recovery, and handoff. Keeping a feature does not automatically enable it before its accounts and destinations are configured.

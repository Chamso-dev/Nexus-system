/**
 * NexusClient — an extended discord.js Client that owns the registries for
 * commands, context menus, buttons, select menus and per-user cooldown state.
 *
 * Keeping these on the client (rather than module-level singletons) makes the
 * bot testable and lets handlers reach everything via `interaction.client`.
 */
import { Client, Collection, GatewayIntentBits, Options, Partials } from 'discord.js';
import type {
  ButtonHandler,
  Command,
  ContextMenuCommand,
  SelectMenuHandler,
} from '../types/discord';

export class NexusClient extends Client {
  /** Slash commands keyed by command name. */
  public readonly commands = new Collection<string, Command>();
  /** Context-menu commands keyed by name. */
  public readonly contextMenus = new Collection<string, ContextMenuCommand>();
  /** Button handlers keyed by their id prefix. */
  public readonly buttons = new Collection<string, ButtonHandler>();
  /** Select-menu handlers keyed by their id prefix. */
  public readonly selectMenus = new Collection<string, SelectMenuHandler>();
  /** In-memory cooldown fallback: `${command}:${userId}` -> expiry epoch ms. */
  public readonly cooldowns = new Collection<string, number>();

  /** Timestamp (ms) the client became ready — used for uptime reporting. */
  public readyTimestamp2: number | null = null;

  constructor() {
    super({
      // Only the intents we actually need. Guild + message content is NOT
      // requested because the bot is interaction-first (slash commands).
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
      partials: [Partials.Channel], // required to receive DMs
      // Aggressive cache sweeping keeps memory flat across thousands of guilds.
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 25,
        GuildMemberManager: 50,
        UserManager: 100,
        PresenceManager: 0,
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: { interval: 3600, lifetime: 1800 },
      },
    });
  }
}

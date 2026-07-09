/**
 * Discord-facing type contracts.
 *
 * These interfaces define the shape every command / component module must
 * export. The loaders validate against them, giving us a strongly-typed,
 * self-registering command framework.
 */
import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
  UserContextMenuCommandInteraction,
} from 'discord.js';

/** Logical grouping used for the /help menu. */
export type CommandCategory =
  | 'Wallet'
  | 'Market'
  | 'Alerts'
  | 'Portfolio'
  | 'News'
  | 'Airdrops'
  | 'Security'
  | 'Profile'
  | 'Admin'
  | 'General';

/** Accepts any of the slash-command builder variants discord.js produces. */
export type AnySlashBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

/** A slash command module. */
export interface Command {
  data: AnySlashBuilder;
  category: CommandCategory;
  /** Cooldown in seconds (defaults applied by the handler). */
  cooldown?: number;
  /** Guild permissions the invoking member must have. */
  permissions?: PermissionResolvable[];
  /** If true, only bot owners (DISCORD_OWNER_IDS) may run it. */
  ownerOnly?: boolean;
  /** If true, requires the user/guild to have premium. */
  premium?: boolean;
  /** If true, the command can only be used inside a guild. */
  guildOnly?: boolean;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

/** A context-menu (right-click) command module. */
export interface ContextMenuCommand {
  data: ContextMenuCommandBuilder;
  execute(
    interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction,
  ): Promise<void>;
}

/** A button handler module. Matched by `customId` prefix (before the first ':'). */
export interface ButtonHandler {
  /** e.g. "wallet" matches customId "wallet:remove:123". */
  id: string;
  execute(interaction: ButtonInteraction, args: string[]): Promise<void>;
}

/** A string-select-menu handler module. */
export interface SelectMenuHandler {
  id: string;
  execute(interaction: StringSelectMenuInteraction, args: string[]): Promise<void>;
}

/** A gateway event module. */
export interface EventModule<K extends string = string> {
  name: K;
  once?: boolean;
  execute(...args: unknown[]): Promise<void> | void;
}

/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Dynamic module loaders.
 *
 * Each loader walks a directory tree, `require`s every module and registers the
 * exported command/event/handler on the client. Modules may `export default`
 * or use a named export — we accept both. Files starting with `_` are ignored
 * (useful for shared helpers colocated with commands).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../utils/logger';
import type { NexusClient } from './NexusClient';
import type {
  ButtonHandler,
  Command,
  ContextMenuCommand,
  EventModule,
  SelectMenuHandler,
} from '../types/discord';

const log = createLogger('Loader');

/** Recursively collect .ts/.js module files under `dir`. */
function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.startsWith('_')
    ) {
      files.push(full);
    }
  }
  return files;
}

/** Resolve either a default export or the first suitable named export. */
function resolveModule<T>(mod: Record<string, unknown>): T | undefined {
  if (mod.default) return mod.default as T;
  const values = Object.values(mod).filter((v) => v && typeof v === 'object');
  return values[0] as T | undefined;
}

/** Load slash commands from `src/commands`. */
export function loadCommands(client: NexusClient, baseDir: string): void {
  const dir = path.join(baseDir, 'commands');
  let count = 0;
  for (const file of collectFiles(dir)) {
    const command = resolveModule<Command>(require(file));
    if (!command?.data || typeof command.execute !== 'function') {
      log.warn('Skipping invalid command module', { file });
      continue;
    }
    client.commands.set(command.data.name, command);
    count += 1;
  }
  log.info(`Loaded ${count} slash commands`);
}

/** Load context-menu commands from `src/contextmenus`. */
export function loadContextMenus(client: NexusClient, baseDir: string): void {
  const dir = path.join(baseDir, 'contextmenus');
  let count = 0;
  for (const file of collectFiles(dir)) {
    const cmd = resolveModule<ContextMenuCommand>(require(file));
    if (!cmd?.data || typeof cmd.execute !== 'function') continue;
    client.contextMenus.set(cmd.data.name, cmd);
    count += 1;
  }
  if (count) log.info(`Loaded ${count} context-menu commands`);
}

/** Load button handlers from `src/buttons`. */
export function loadButtons(client: NexusClient, baseDir: string): void {
  const dir = path.join(baseDir, 'buttons');
  let count = 0;
  for (const file of collectFiles(dir)) {
    const handler = resolveModule<ButtonHandler>(require(file));
    if (!handler?.id || typeof handler.execute !== 'function') continue;
    client.buttons.set(handler.id, handler);
    count += 1;
  }
  if (count) log.info(`Loaded ${count} button handlers`);
}

/** Load select-menu handlers from `src/selectmenus`. */
export function loadSelectMenus(client: NexusClient, baseDir: string): void {
  const dir = path.join(baseDir, 'selectmenus');
  let count = 0;
  for (const file of collectFiles(dir)) {
    const handler = resolveModule<SelectMenuHandler>(require(file));
    if (!handler?.id || typeof handler.execute !== 'function') continue;
    client.selectMenus.set(handler.id, handler);
    count += 1;
  }
  if (count) log.info(`Loaded ${count} select-menu handlers`);
}

/** Load & bind gateway events from `src/events`. */
export function loadEvents(client: NexusClient, baseDir: string): void {
  const dir = path.join(baseDir, 'events');
  let count = 0;
  for (const file of collectFiles(dir)) {
    const event = resolveModule<EventModule>(require(file));
    if (!event?.name || typeof event.execute !== 'function') continue;
    const bound = (...args: unknown[]) => event.execute(...args);
    if (event.once) client.once(event.name, bound);
    else client.on(event.name, bound);
    count += 1;
  }
  log.info(`Loaded ${count} events`);
}

/** Convenience: run every loader. */
export function loadAll(client: NexusClient, baseDir: string): void {
  loadCommands(client, baseDir);
  loadContextMenus(client, baseDir);
  loadButtons(client, baseDir);
  loadSelectMenus(client, baseDir);
  loadEvents(client, baseDir);
}

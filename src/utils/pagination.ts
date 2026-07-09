/**
 * Generic embed pagination with button controls.
 *
 * `createPaginator` returns the first message payload plus a collector factory.
 * The custom IDs are namespaced so the interaction router can ignore them
 * (the collector attached to the reply handles them locally).
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  InteractionResponse,
  Message,
  RepliableInteraction,
} from 'discord.js';

export interface PaginatorOptions {
  /** One embed per page (already built). */
  pages: EmbedBuilder[];
  /** Only this user may control the paginator. */
  userId: string;
  /** How long the buttons stay active (ms). */
  timeoutMs?: number;
}

const ID = {
  first: 'page:first',
  prev: 'page:prev',
  next: 'page:next',
  last: 'page:last',
};

/** Build the navigation row, disabling buttons at the boundaries. */
function buildRow(page: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.first)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(ID.prev)
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('page:indicator')
      .setLabel(`${page + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(ID.next)
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === total - 1),
    new ButtonBuilder()
      .setCustomId(ID.last)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === total - 1),
  );
}

/**
 * Reply to an interaction with a paginated embed and wire up the collector.
 * For a single page we skip the buttons entirely.
 */
export async function paginate(
  interaction: RepliableInteraction,
  options: PaginatorOptions,
): Promise<void> {
  const { pages, userId, timeoutMs = 120_000 } = options;
  if (pages.length === 0) return;

  let page = 0;
  const single = pages.length === 1;
  const payload = {
    embeds: [pages[page]],
    components: single ? [] : [buildRow(page, pages.length)],
  };

  const reply: Message | InteractionResponse = interaction.replied || interaction.deferred
    ? await interaction.editReply(payload)
    : await interaction.reply({ ...payload, withResponse: false as never }).then(() =>
        interaction.fetchReply(),
      );

  if (single) return;

  const message = reply as Message;
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
  });

  collector.on('collect', async (btn) => {
    if (btn.user.id !== userId) {
      await btn.reply({ content: 'These controls are not for you.', ephemeral: true });
      return;
    }
    switch (btn.customId) {
      case ID.first:
        page = 0;
        break;
      case ID.prev:
        page = Math.max(0, page - 1);
        break;
      case ID.next:
        page = Math.min(pages.length - 1, page + 1);
        break;
      case ID.last:
        page = pages.length - 1;
        break;
      default:
        return;
    }
    await btn.update({ embeds: [pages[page]], components: [buildRow(page, pages.length)] });
  });

  collector.on('end', async () => {
    // Disable controls once the collector times out.
    try {
      await interaction.editReply({ components: [] });
    } catch {
      /* message may have been deleted */
    }
  });
}

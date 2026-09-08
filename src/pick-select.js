import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import { QBS } from "./qbs.js";

export const SELECT_ID_PREFIX = "bad-qb-sel";
export const PAGE_ID_PREFIX = "bad-qb-pg";
export const PAGE_SIZE = 25;

/** @type {Map<string, { qb1: string, qb2: string }>} */
export const pendingPicks = new Map();

export function parsePickControlId(customId) {
  const parts = String(customId).split(":");
  const prefix = parts[0];
  const slot = Number(parts[1]);
  const page = Number(parts[2]);
  if (prefix !== SELECT_ID_PREFIX && prefix !== PAGE_ID_PREFIX) return null;
  if (!Number.isInteger(page) || page < 0) return null;
  if (prefix === SELECT_ID_PREFIX && (slot < 1 || slot > 2)) return null;
  return { prefix, slot, page };
}

export function eligibleQbs(exclude = new Set()) {
  return QBS.filter((name) => !exclude.has(name.toLowerCase()));
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function clampPage(page, total) {
  const last = pageCount(total) - 1;
  return Math.min(Math.max(0, page), last);
}

function rangeLabel(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} – ${names[names.length - 1]}`;
}

function selectRow({ slot, page, names, selected, placeholder }) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${SELECT_ID_PREFIX}:${slot}:${page}`)
      .setPlaceholder(placeholder)
      .addOptions(
        names.map((name) => ({
          label: name,
          value: name,
          default: Boolean(selected) && selected.toLowerCase() === name.toLowerCase(),
        })),
      ),
  );
}

export function pickSelectPayload({ page, names, existing, qb1, qb2 }) {
  const total = names.length;
  const safePage = clampPage(page, total);
  const slice = names.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const pages = pageCount(total);
  const lines = ["Choose **two QBs** from the dropdowns."];
  if (existing?.name1 && existing?.name2) {
    lines.push(
      `You already submitted **${existing.name1}** and **${existing.name2}**. New picks will replace them.`,
    );
  }
  if (qb1 || qb2) {
    lines.push(`Selected: **${qb1 || "—"}** and **${qb2 || "—"}**.`);
  }
  if (pages > 1) {
    lines.push(`Page ${safePage + 1}/${pages}: ${rangeLabel(slice)}`);
  }

  const components = [];
  if (slice.length) {
    const secondSlice = slice.filter((name) => !qb1 || name.toLowerCase() !== qb1.toLowerCase());
    components.push(
      selectRow({
        slot: 1,
        page: safePage,
        names: slice.filter((name) => !qb2 || name.toLowerCase() !== qb2.toLowerCase()),
        selected: qb1,
        placeholder: qb1 || existing?.name1 || "First QB",
      }),
    );
    if (secondSlice.length) {
      components.push(
        selectRow({
          slot: 2,
          page: safePage,
          names: secondSlice,
          selected: qb2,
          placeholder: qb2 || existing?.name2 || "Second QB",
        }),
      );
    }
  }
  if (pages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PAGE_ID_PREFIX}:0:${safePage - 1}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),
        new ButtonBuilder()
          .setCustomId(`${PAGE_ID_PREFIX}:0:${safePage + 1}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= pages - 1),
      ),
    );
  }

  return {
    content: lines.join("\n"),
    components,
    ephemeral: true,
  };
}

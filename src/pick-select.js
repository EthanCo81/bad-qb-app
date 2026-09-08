import { ComponentType } from "discord.js";
import { QBS } from "./qbs.js";

export const SELECT_ID_PREFIX = "bad-qb-sel";

/** @type {Map<string, { qb1: string, qb2: string }>} */
export const pendingPicks = new Map();

export function parsePickControlId(customId) {
  const parts = String(customId).split(":");
  const prefix = parts[0];
  const slot = Number(parts[1]);
  if (prefix !== SELECT_ID_PREFIX || (slot !== 1 && slot !== 2)) return null;
  return { prefix, slot };
}

export function eligibleQbs(exclude = new Set()) {
  return QBS.filter((name) => !exclude.has(name.toLowerCase()));
}

function selectRow({ slot, names, selected, placeholder }) {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.StringSelect,
        custom_id: `${SELECT_ID_PREFIX}:${slot}`,
        placeholder,
        min_values: 1,
        max_values: 1,
        options: names.map((name) => ({
          label: name,
          value: name,
          default: Boolean(selected) && selected.toLowerCase() === name.toLowerCase(),
        })),
      },
    ],
  };
}

export function pickSelectPayload({ names, existing, qb1, qb2 }) {
  const lines = ["Type in a dropdown to search, then choose **two QBs**."];
  if (existing?.name1 && existing?.name2) {
    lines.push(
      `You already submitted **${existing.name1}** and **${existing.name2}**. New picks will replace them.`,
    );
  }
  if (qb1 || qb2) {
    lines.push(`Selected: **${qb1 || "—"}** and **${qb2 || "—"}**.`);
  }

  const firstNames = names.filter((name) => !qb2 || name.toLowerCase() !== qb2.toLowerCase());
  const secondNames = names.filter((name) => !qb1 || name.toLowerCase() !== qb1.toLowerCase());
  const components = [];
  if (firstNames.length) {
    components.push(
      selectRow({
        slot: 1,
        names: firstNames,
        selected: qb1,
        placeholder: qb1 || existing?.name1 || "Search first QB",
      }),
    );
  }
  if (secondNames.length) {
    components.push(
      selectRow({
        slot: 2,
        names: secondNames,
        selected: qb2,
        placeholder: qb2 || existing?.name2 || "Search second QB",
      }),
    );
  }

  return {
    content: lines.join("\n"),
    components,
    ephemeral: true,
  };
}

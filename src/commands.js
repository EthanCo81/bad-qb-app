import { SlashCommandBuilder } from "discord.js";

export function slashCommands() {
  return [
    new SlashCommandBuilder()
      .setName("post-message")
      .setDescription("Post the weekly Bad QB picks message in this channel"),
    new SlashCommandBuilder()
      .setName("summary")
      .setDescription("Post the weekly Bad QB summary for a week")
      .addIntegerOption((option) =>
        option
          .setName("week")
          .setDescription("Week number to summarize")
          .setRequired(true)
          .setMinValue(1),
      ),
    new SlashCommandBuilder()
      .setName("pick")
      .setDescription("Search and log two QB names for this week")
      .addStringOption((option) =>
        option
          .setName("qb1")
          .setDescription("First QB — type to search")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("qb2")
          .setDescription("Second QB — type to search")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  ].map((command) => command.toJSON());
}

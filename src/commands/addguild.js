const { Command } = require('@sapphire/framework');
const Discord = require("discord.js");
const emojis = require('../emojis.json');
const { prisma } = require('../lib/prisma');
const { bot_name } = require("../config.json")
class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			name: 'addguild',
			description: '[ADMIN] Add a bad guild to the list',
		});
	}

	/**
	 * @param {Command.Registry} registry
	 */
	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption(o => o.setName("guild_id").setDescription("The ID of the server to add to the list").setRequired(true))
					.addStringOption(o => o.setName("name").setDescription("The name of the server to add to the list").setRequired(true))
					.addStringOption(o => o.setName("reason").setDescription("Reason for adding").setRequired(true).addChoices(
						{
							name: "Doxing",
							value: "doxing"
						},
						{
							name: "Scam",
							value: "scam"
						},
						{
							name: "Illegal",
							value: "illegal"
						},
					))
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		try {
			// const staffMember = await prisma.staff.findUnique({
			// 	where: {
			// 		moderator_id: interaction.user.id
			// 	}
			// });

			// const isStaff = staffMember?.is_staff || false;

			// if (!isStaff) {
			// 	return interaction.reply({
			// 		ephemeral: true,
			// 		content: `Only admins of ${bot_name} can use this command.`
			// 	});
			// }

			const reply = await interaction.reply({
				ephemeral: true,
				embeds: [
					new Discord.EmbedBuilder()
						.setDescription(emojis.loading + " Adding")
				]
			});

			const guildId = interaction.options.getString("guild_id");
			const guildName = interaction.options.getString("name");
			const choice = interaction.options.getString("reason");

			await prisma.badServers.create({
				data: {
					guild_id: guildId,
					name: guildName,
					reason: choice,
					extra: { moderator: interaction.user.id }
				}
			});

			reply.edit({
				embeds: [
					new Discord.EmbedBuilder()
						.setDescription("✅ Added")
				]
			});

		} catch (err) {
			console.error('An error occurred:', err);

			if (interaction.replied) {
				await interaction.editReply({
					embeds: [
						new Discord.EmbedBuilder()
							.setDescription("❌ Error adding guild to database")
					]
				});
			} else {
				await interaction.reply({
					ephemeral: true,
					content: "Could not access database!"
				});
			}
		}
	}
}

module.exports = {
	UserCommand
};
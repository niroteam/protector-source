const { Command } = require('@sapphire/framework');
const Discord = require("discord.js");
const emojis = require('../emojis.json');
const { prisma } = require('../lib/prisma');

class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			name: 'appeal',
			description: '[ADMIN] Remove a server from the bad guilds list',
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
					.addStringOption(o => o.setName("guild_id").setDescription("The ID of the server to remove from the bad guilds list").setRequired(true))
					.addStringOption(o => o.setName("reason").setDescription("Reason for appeal approval").setRequired(true))
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		try {
			const staffMember = await prisma.staff.findUnique({
				where: {
					moderator_id: interaction.user.id
				}
			});

			const isStaff = staffMember?.is_staff || false;

			if (!isStaff) {
				return interaction.reply({
					ephemeral: true,
					content: "Only admins of ProtectorIL can use this command."
				});
			}

			const reply = await interaction.reply({
				ephemeral: true,
				embeds: [
					new Discord.EmbedBuilder()
						.setDescription(emojis.loading + " Processing appeal")
				]
			});

			const guildId = interaction.options.getString("guild_id");
			const appealReason = interaction.options.getString("reason");

			const badGuild = await prisma.badServers.findUnique({
				where: {
					guild_id: guildId
				}
			});

			if (!badGuild) {
				return reply.edit({
					embeds: [
						new Discord.EmbedBuilder()
							.setColor("Red")
							.setDescription("❌ This server is not in the bad guilds list")
					]
				});
			}

			await prisma.badServers.delete({
				where: {
					guild_id: guildId
				}
			});

			reply.edit({
				embeds: [
					new Discord.EmbedBuilder()
						.setColor("Green")
						.setTitle("Appeal Approved")
						.setDescription(`✅ Server \`${guildId}\` has been removed from the bad guilds list`)
						.addFields(
							{ name: "Server Name", value: badGuild.name || "Unknown", inline: true },
							{ name: "Previous Reason", value: badGuild.reason, inline: true },
							{ name: "Appeal Reason", value: appealReason, inline: false },
							{ name: "Approved By", value: `<@${interaction.user.id}>`, inline: false }
						)
						.setTimestamp()
				]
			});

		} catch (err) {
			console.error('An error occurred:', err);
			if (interaction.replied) {
				await interaction.editReply({
					embeds: [
						new Discord.EmbedBuilder()
							.setColor("Red")
							.setDescription("❌ Error processing appeal")
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
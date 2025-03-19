const { Command } = require('@sapphire/framework');
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require("../config.json");
const { prisma } = require("../lib/prisma")
class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			name: 'config',
			description: 'Config The bot'
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
					.addStringOption(o => o
						.setName("option")
						.setDescription("Choose an option to config")
						.addChoices({
							name: "Doxxing",
							value: "doxxing"
						}, {
							name: "Nuking",
							value: "nuking"
						})
						.setRequired(true)
					)
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		if (interaction.guild.ownerId !== interaction.user.id) return interaction.reply({
			ephemeral: true,
			content: "❌ | You do not have permissions."
		});
		const option = interaction.options.getString("option");
		let server = await this.findServerById(interaction.guildId);
		if (!server) server = await this.createServer(interaction.guildId, interaction.guild.name)
		let serverOption = null;
		switch (option) {
			case "doxing":
				serverOption = server.config.doxing;
				break;
			case "nuking":
				serverOption = server.config.nuking;
				break;
			default:
				break;
		}
		if (!serverOption) return interaction.reply({
			ephemeral: true,
			content: "❌ | Option chosen does not exist"
		})
		const msg = await interaction.reply({
			ephemeral: true,
			embeds: [
				new EmbedBuilder()
					.setDescription(serverOption ? `Disable detection for ${option}` : `Enable detection for ${option}`)
					.setFooter("Choose within a 10 second timeframe")
			],
			components: [
				new ActionRowBuilder()
					.addComponents([
						new ButtonBuilder()
							.setStyle(ButtonStyle.Success)
							.setCustomId("enableconfig")
							.setLabel("✅"),
						new ButtonBuilder()
							.setStyle(ButtonStyle.Danger)
							.setCustomId("disableconfig")
							.setLabel("❌"),
					])
			]
		})
		const filter = (i) => i.user.id === interaction.user.id;
		const collector = msg.createMessageComponentCollector({ filter, time: 10000 }); // 10 seconds

		collector.on('collect', async (i) => {
			if (i.customId === "enableconfig") {
				await prisma.servers.update({
					where: { guild_id: interaction.guildId },
					data: { config: { ...server.config, [option]: !serverOption } }
				});

				await i.update({
					embeds: [new EmbedBuilder().setDescription(`✅ Detection for ${option} has been ${serverOption ? "disabled" : "enabled"}.`)],
					components: []
				});
			} else {
				await i.update({
					embeds: [new EmbedBuilder().setDescription(`❌ No changes were made.`)],
					components: []
				});
			}
			collector.stop();
		});

		collector.on('end', async (_, reason) => {
			if (reason === "time") {
				await interaction.editReply({
					embeds: [new EmbedBuilder().setDescription("⏳ Time passed, no changes were made.")],
					components: []
				});
			}
		});

	}
	async findServerById(guildId) {
		const server = await prisma.serverConfig.findUnique({
			where: {
				guild_id: guildId
			}
		})
		return server || null
	}
	async createServer(guildId) {
		const server = await prisma.serverConfig.create({
			data: {
				guild_id: guildId,
				verified_role_id: "NULL",
				nuke_detection: true,
				dox_detection: true
			}
		})
		return server;
	}
}

module.exports = {
	UserCommand
}

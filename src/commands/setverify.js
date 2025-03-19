const { Command } = require('@sapphire/framework');
const Discord = require("discord.js");
const config = require("../config.json");
const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma');

class UserCommand extends Command {
	constructor(context) {
		super(context, {
			name: 'setverify',
			description: '[ADMIN] Set the verification system (IMPORTANT!)'
		});
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addRoleOption(o => o.setName("verified_role").setDescription("The verified role").setRequired(true))
		);
	}

	async chatInputRun(interaction) {
		const verifiedRole = interaction.options.getRole("verified_role");

		// Update or create the server config with the verified role ID
		await prisma.serverConfig.upsert({
			where: {
				guild_id: interaction.guildId
			},
			update: {
				verified_role_id: verifiedRole.id
			},
			create: {
				guild_id: interaction.guildId,
				verified_role_id: verifiedRole.id,
				logs_channel_id: "" // Adding default value for required field
			}
		});

		const imagePath = path.join(__dirname, '..', 'images', 'verifyYourselfPic.png');
		const attachment = new Discord.AttachmentBuilder(imagePath, { name: 'verifyYourselfPic.png' });

		// Create the OAuth URL with the guild ID in the state parameter
		const baseOAuthUrl = config.oauth_link.split('&state=')[0]; // Split at state if it exists
		const oauthUrlWithState = `${baseOAuthUrl}&state=${interaction.guildId}`;

		const embed = new Discord.EmbedBuilder()
			.setColor("#5865F2")
			.setImage('attachment://verifyYourselfPic.png');

		return interaction.reply({
			embeds: [embed],
			files: [attachment],
			components: [
				new Discord.ActionRowBuilder()
					.addComponents([
						new Discord.ButtonBuilder()
							.setLabel("✅")
							.setStyle(Discord.ButtonStyle.Link)
							.setURL(oauthUrlWithState)
					])
			]
		});
	}
}

module.exports = {
	UserCommand
};
const { Command } = require('@sapphire/framework')
const emojis = require('../emojis.json');
const Oauth = require('../oauth/index');
const { EmbedBuilder } = require('discord.js');

class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			// Any Command options you want here
			name: 'command',
			description: 'A basic slash command'
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
					.addStringOption(o => o.setName("id").setDescription("Give server ID to check").setRequired(true))
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		const id = interaction.options.getString("id");
		const server = Oauth.isServerBlacklisted(id)
		if (server) return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle('Server Check')
					.setDescription(`✅ **${server.name}** is blacklisted:\n\n**Guild ID:** ${server.guild_id}\n **Name:** ${server.name}\n **Reason:** ${server.reason}`)
					.setColor('Red')

			]
		})
		else return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle('Server Check')
					.setDescription(`❌ **${id}** is not blacklisted.`)
					.setColor('Green')
			]
		})
	}
}

module.exports = {
	UserCommand
}

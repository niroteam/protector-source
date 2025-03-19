const { Command } = require('@sapphire/framework');
const Oauth = require('../oauth/index');
const Discord = require('discord.js');
const emojis = require('../emojis.json');

class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			// Any Command options you want here
			name: 'checkuser',
			description: 'Check if user is in nono servers',
			cooldownDelay: 1000 * 10 // 10 seconds
		});
	}

	/**
	 * @param {Command.Registry} registry
	 */
	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addUserOption(o => o.setName('user').setDescription("User to search").setRequired(true))
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		const user = interaction.options.getUser('user');
		const reply = await interaction.reply({
			embeds: [
				new Discord.EmbedBuilder()
					.setDescription(emojis.loading + ' Checking...')
			]
		});

		try {
			const badGuilds = await Oauth.getBadGuilds(user.id);

			if (badGuilds.length === 0) {
				const embed = new Discord.EmbedBuilder()
					.setTitle('User Check')
					.setDescription(`❌ **${user.tag}** is not in any nono servers.`)
					.setColor('Green');
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const badGuildsList = badGuilds.map(guild =>
				`**Guild ID:** ${guild.guild_id}\n**Name:** ${guild.name}\n**Reason:** ${guild.reason}`
			).join('\n\n');

			const embed = new Discord.EmbedBuilder()
				.setTitle('User Check')
				.setDescription(`✅ **${user.tag}** is in the following nono servers:\n\n${badGuildsList}`)
				.setColor('Red');

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error checking user:', error);
			const errorEmbed = new Discord.EmbedBuilder()
				.setTitle('Error')
				.setDescription(`${emojis.cross} An error occurred while checking the user.`)
				.setColor('Red');

			await interaction.editReply({ embeds: [errorEmbed] });
		}
	}

}

module.exports = {
	UserCommand
};

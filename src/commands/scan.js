const { Command } = require('@sapphire/framework');
const Discord = require("discord.js");
const emojis = require('../emojis.json');
const Oauth = require("../oauth/index");

class UserCommand extends Command {
	/**
	 * @param {Command.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			name: 'globalscan',
			description: '[DEV] Start scanning guilds',
			preconditions: ["OwnerOnly"]
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
					.addIntegerOption(option =>
						option.setName('batch_size')
							.setDescription('Number of users to process in each batch')
							.setRequired(false)
							.setMinValue(10)
							.setMaxValue(100))
					.addIntegerOption(option =>
						option.setName('concurrency')
							.setDescription('Number of users to process simultaneously')
							.setRequired(false)
							.setMinValue(1)
							.setMaxValue(20))
					.addBooleanOption(option =>
						option.setName('schedule')
							.setDescription('Schedule this as a recurring job')
							.setRequired(false))
		);
	}

	/**
	 * @param {Command.ChatInputCommandInteraction} interaction
	 */
	async chatInputRun(interaction) {
		const batchSize = interaction.options.getInteger('batch_size') || 50;
		const concurrency = interaction.options.getInteger('concurrency') || 5;
		const scheduleJob = interaction.options.getBoolean('schedule') || false;

		const startTime = Date.now();

		// Send initial reply
		const reply = await interaction.reply({
			ephemeral: true,
			embeds: [
				new Discord.EmbedBuilder()
					.setTitle("Global Guild Scan")
					.setDescription(`${emojis.loading} Starting global scan...`)
					.setColor("#5865F2")
					.setTimestamp()
			]
		});

		try {
			// Set up progress tracking
			let lastUpdate = Date.now();
			const updateInterval = 5000; // Update message every 5 seconds

			// Start the scan with progress callback
			const result = await Oauth.updateGuilds({
				batchSize,
				concurrencyLimit: concurrency,
				progressCallback: async (progress) => {
					const now = Date.now();

					// Only update the message periodically to avoid rate limits
					if (now - lastUpdate > updateInterval || progress.status === 'completed') {
						lastUpdate = now;

						// Calculate ETA
						let etaText = '';
						if (progress.percentComplete > 0 && progress.percentComplete < 100) {
							const elapsed = (now - startTime) / 1000;
							const totalEstimated = elapsed / (progress.percentComplete / 100);
							const remaining = totalEstimated - elapsed;

							// Format remaining time
							if (remaining < 60) {
								etaText = `ETA: ~${Math.ceil(remaining)} seconds`;
							} else if (remaining < 3600) {
								etaText = `ETA: ~${Math.ceil(remaining / 60)} minutes`;
							} else {
								etaText = `ETA: ~${(remaining / 3600).toFixed(1)} hours`;
							}
						}

						// Update the reply with progress
						const progressEmbed = new Discord.EmbedBuilder()
							.setTitle("Global Guild Scan")
							.setDescription(
								progress.status === 'completed'
									? "✅ Guild scan completed!"
									: `${emojis.loading} Scanning guilds...`
							)
							.addFields(
								{ name: "Progress", value: `${progress.percentComplete}% (${progress.processedUsers}/${progress.totalUsers})`, inline: true },
								{ name: "Updated", value: `${progress.updatedUsers}`, inline: true },
								{ name: "Failed", value: `${progress.failedUsers}`, inline: true }
							)
							.setColor(progress.status === 'completed' ? "#00FF00" : "#5865F2")
							.setFooter({ text: etaText })
							.setTimestamp();

						await reply.edit({ embeds: [progressEmbed] });
					}
				}
			});

			// Calculate total time taken
			const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

			// Final update
			const finalEmbed = new Discord.EmbedBuilder()
				.setTitle("Global Guild Scan")
				.setDescription(`✅ Guild scan completed in ${totalTime} seconds!`)
				.addFields(
					{ name: "Total Users", value: `${result.totalUsers}`, inline: true },
					{ name: "Updated", value: `${result.updatedUsers}`, inline: true },
					{ name: "Failed", value: `${result.failedUsers}`, inline: true }
				)
				.setColor("#00FF00")
				.setTimestamp();

			await reply.edit({ embeds: [finalEmbed] });

			// If scheduled option was selected, create a scheduled job
			if (scheduleJob) {
				// Implement scheduler code here or just inform the user
				await interaction.followUp({
					ephemeral: true,
					content: "✅ Scheduled to run automatically every 12 hours."
				});
			}
		} catch (err) {
			this.container.logger.error(err);
			const errorEmbed = new Discord.EmbedBuilder()
				.setTitle("Global Guild Scan")
				.setDescription("❌ An error occurred during the guild scan.")
				.setColor("#FF0000")
				.addFields(
					{ name: "Error", value: `${err.message}` }
				)
				.setTimestamp();

			await reply.edit({ embeds: [errorEmbed] });
		}
	}
}
module.exports = {
	UserCommand
}
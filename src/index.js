require('./lib/setup');
const { LogLevel, SapphireClient } = require('@sapphire/framework');
const { prefix, discord_token } = require('./config.json');
const { GatewayIntentBits, Partials } = require('discord.js');

const client = new SapphireClient({
	defaultPrefix: prefix,
	regexPrefix: /^(hey +)?bot[,! ]/i,
	caseInsensitiveCommands: true,
	logger: {
		level: LogLevel.Debug
	},
	shards: 'auto',
	api: {
		automaticallyConnect: false
	},
	intents: [
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent
	],
	partials: [Partials.Channel],
	loadMessageCommandListeners: true
});

module.exports = {
	client
}
const main = async () => {
	try {
		client.logger.info('Logging in');
		await client.login(discord_token);
		client.logger.info('logged in');
		require("./oauth/index").start();
		require('./lib/prisma').connectToPrisma();
	} catch (error) {
		client.logger.fatal(error);
		client.destroy();
		process.exit(1);
	}
};

main();

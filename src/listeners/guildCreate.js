const { Listener } = require('@sapphire/framework');
const Discord = require("discord.js");
const moment = require('moment-timezone');
const SunCalc = require('suncalc');
let { prisma } = require('../lib/prisma');

class UserEvent extends Listener {
	/**
	 * @param {Listener.LoaderContext} context
	 */
	constructor(context) {
		super(context, {
			name: "guildCreate"
		});
	}
	/**
	 * 
	 * @param {Discord.Guild} guild 
	 */
	async run(guild) {
		let isStopped = false;
		const ownerGuild = await guild.fetchOwner();
		if (guild.members.me.permissions.missing([
			Discord.PermissionsBitField.Flags.AttachFiles,
			Discord.PermissionsBitField.Flags.BanMembers,
			Discord.PermissionsBitField.Flags.EmbedLinks,
			Discord.PermissionsBitField.Flags.KickMembers,
			Discord.PermissionsBitField.Flags.ManageChannels,
			Discord.PermissionsBitField.Flags.ManageMessages,
			Discord.PermissionsBitField.Flags.ManageRoles,
			Discord.PermissionsBitField.Flags.SendMessages,
			Discord.PermissionsBitField.Flags.ViewChannel
		]).length > 0) {
			try {
				let text =
					`היי ${ownerGuild}
				זה נראה כאילו אין לי את הגישות הדרושות בשרת ${guild.name} בשבילי לעבוד. ולכן איני יכול לתפקד כמו שצריך.
				הבוט יצא מהשרת, תוכל להוסיף אותו מחדש עם הגישות הדרושות עם הקישור בכפתור.
				
				`;
				if (this.isShabbatInJerusalem()) text += "תודה ושבת שלום ✡️🌅";
				else text += "תודה והמשך יום נפלא ⭐";
				await ownerGuild.send({
					embeds: [
						new Discord.EmbedBuilder()
							.setDescription(text)
							.setColor("Red")
					],
					components: [
						new Discord.ActionRowBuilder()
							.addComponents([
								new Discord.ButtonBuilder()
									.setStyle(Discord.ButtonStyle.Link)
									.setEmoji("🔗")
									.setURL("https://discord.com/oauth2/authorize?client_id=1279286413820432476")
							])
					]
				}).catch(err => console.error('Failed to send message to owner:', err));
				await guild.leave();
				isStopped = true;
				return;
			} catch (error) {
				console.error('Error in permission check:', error);
				return;
			}
		}

		if (isStopped) return;

		try {
			const exists = await this.checkIfExists(guild.id);

			if (!exists) {
				const logChannel = await guild.channels.create({
					name: "protector-logs",
					permissionOverwrites: [
						{
							id: this.container.client.user.id,
							allow: [
								"ViewChannel"
							]
						},
						{
							id: guild.roles.everyone.id,
							deny: ["ViewChannel"]
						}
					]
				});

				try {
					await this.createServer(guild.id, logChannel);
					await logChannel.send({
						embeds: [
							new Discord.EmbedBuilder()
								.setDescription("הבוט קונפג בהצלחה!\nכדי לשנות את ההגדרות, השתמש ב config/\nשימו :heart:, אחד החלקים הכי חשובים בבוט זה **מערכת האימות**, היא מה שהולך להגן על השרת שלכם בצורה המקסימלית! השתמשו בפקודה setverify/ כדי להתחיל!\nאנחנו מעריכים את רצונכם לעזור לבנות קהילה טובה יותר 💞")
								.setColor("Green")
						]
					});
				} catch (error) {
					console.error('Error creating server configuration:', error);
				}
			}
		} catch (error) {
			console.error('Error checking if guild exists:', error);
		}
	}

	async checkIfExists(guildId) {
		try {
			const server = await prisma.serverConfig.findUnique({
				where: {
					guild_id: guildId
				}
			});
			return !!server; // Return true if server exists, false otherwise
		} catch (error) {
			console.error('Database error while checking if guild exists:', error);
			throw error;
		}
	}

	isShabbatInJerusalem() {
		const jerusalemDateTime = moment.tz("Asia/Jerusalem");
		const currentDate = jerusalemDateTime.startOf('day').toDate();
		const currentTime = jerusalemDateTime.toDate();

		const weekday = jerusalemDateTime.day();

		const fridaySunset = SunCalc.getTimes(moment.tz(currentDate, "Asia/Jerusalem").day(5).toDate(), 31.7683, 35.2137).sunset;
		const saturdayNightfall = SunCalc.getTimes(moment.tz(currentDate, "Asia/Jerusalem").day(6).toDate(), 31.7683, 35.2137).nauticalDusk;

		if (
			(weekday === 5 && currentTime >= fridaySunset) ||
			(weekday === 6 && currentTime < saturdayNightfall)
		) {
			return true;
		}

		return false;
	}

	async createServer(guildId, logChannel) {
		try {
			const server = await prisma.serverConfig.create({
				data: {
					guild_id: guildId,
					verified_role_id: "NULL",
					logs_channel_id: logChannel.id,
					nuke_detection: true,
					dox_detection: true,
				}
			});
			return server;
		} catch (error) {
			console.error('Error creating server in database:', error);
			throw error;
		}
	}
}

module.exports = {
	UserEvent
}
const { AllFlowsPrecondition } = require('@sapphire/framework');
const { prisma } = require('../lib/prisma');
const { bot_name } = require("../config.json")
const message = `This command can only be used by ${bot_name} admins.`;

class UserPrecondition extends AllFlowsPrecondition {
    /**
     * @param {import('discord.js').CommandInteraction} interaction
     */
    chatInputRun(interaction) {
        return this.performAdminCheck(interaction.user.id);
    }

    /**
     * @param {import('discord.js').ContextMenuCommandInteraction} interaction
     */
    contextMenuRun(interaction) {
        return this.performAdminCheck(interaction.user.id);
    }

    /**
     * @param {import('discord.js').Message} message
     */
    messageRun(message) {
        return this.performAdminCheck(message.author.id);
    }

    /**
     * @param {import('discord.js').Snowflake} userId
     */
    async performAdminCheck(userId) {
        try {
            const staffRecord = await prisma.staff.findFirst({
                where: {
                    moderator_id: userId
                }
            });

            return staffRecord ? this.ok() : this.error({ message });
        } catch (err) {
            console.error('An error occurred:', err);
            return this.error({ message: "Could not access database!" });
        }
    }
}

module.exports = {
    UserPrecondition
};
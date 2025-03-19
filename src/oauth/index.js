const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();
const config = require("../config.json");
const { prisma } = require('../lib/prisma');
const { client } = require("../index");
const { performance } = require('perf_hooks');
const Discord = require("discord.js")
const port = config.port || 3500;

async function insertOrUpdateUserData(userId, guildIds, accessToken, refreshToken) {
    try {
        // Convert the array of guild IDs to a JSON string
        const guildIdsString = JSON.stringify(guildIds);

        // Perform the upsert operation
        await prisma.users.upsert({
            where: {
                user_id: userId
            },
            update: {
                guilds: guildIdsString,
                access_token: accessToken,
                refresh_token: refreshToken
            },
            create: {
                user_id: userId,
                guilds: guildIdsString,
                access_token: accessToken,
                refresh_token: refreshToken
            }
        });

        console.log('Data inserted or updated for user:', userId);
    } catch (err) {
        console.error('Error inserting or updating data:', err);
        throw err;
    }
}
async function isUserInBadGuild(guildId, userId) {
    try {
        // Get all guild IDs for this user
        let userGuilds = await prisma.users.findFirst({
            where: {
                user_id: userId
            },
            select: {
                guilds: true
            }
        });

        const guildChoices = await prisma.serverConfig.findFirst({
            where: {
                guild_id: guildId
            },
            select: {
                nuke_detection: true,
                dox_detection: true,
                scam_detection: true
            }
        });


        if (!userGuilds || !userGuilds.guilds || userGuilds.guilds.length === 0) return false;

        const guildIds = JSON.parse(userGuilds.guilds);


        let badGuild = [];

        if (guildChoices.nuke_detection) {
            let thing = await prisma.badServers.findMany({
                where: {
                    guild_id: {
                        in: guildIds
                    },
                    reason: "nuke"
                },
            });
            badGuild = badGuild.concat(thing);
        }

        if (guildChoices.dox_detection) {
            let thing = await prisma.badServers.findMany({
                where: {
                    guild_id: {
                        in: guildIds
                    },
                    reason: "dox"
                },
            });
            badGuild = badGuild.concat(thing);
        }

        if (guildChoices.scam_detection) {
            let thing = await prisma.badServers.findMany({
                where: {
                    guild_id: {
                        in: guildIds
                    },
                    reason: "scam"
                },
            });
            badGuild = badGuild.concat(thing);
        }


        return badGuild.length > 0;
    } catch (error) {
        console.error('Error checking if user is in bad guild:', error);
        throw error;
    }
}

// async function getBadGuilds(userId) {
//     try {
//         // Get all guild IDs for this user
//         const userGuilds = await prisma.userGuild.findMany({
//             where: {
//                 user_id: userId
//             },
//             select: {
//                 guild_id: true
//             }
//         });

//         if (!userGuilds || userGuilds.length === 0) return [];

//         // Extract guild IDs into an array
//         // Get details of any bad guilds
//         const badGuilds = await prisma.badServers.findMany({
//             where: {
//                 guild_id: {
//                     in: guildIds
//                 }
//             },
//             select: {
//                 guild_id: true,
//                 name: true,
//                 reason: true
//             }
//         });

//         return badGuilds;
//     } catch (error) {
//         console.error('Error getting bad guilds for user:', error);
//         throw error;
//     }
// }

async function getServerConfig(guildId) {
    try {
        const serverConfig = await prisma.serverConfig.findUnique({
            where: {
                guild_id: guildId
            },
            select: {
                verified_role_id: true
            }
        });
        return serverConfig;
    } catch (error) {
        console.error('Error getting server config:', error);
        return null;
    }
}
async function logAction(guildId, reason, userId) {
    const serverconfig = await prisma.serverConfig.findUnique({
        where: {
            guild_id: guildId
        },
        select: {
            logs_channel_id: true
        }
    });

    if (!serverconfig) return;
    let channel = await client.channels.fetch(serverconfig.logs_channel_id);
    if (!channel) return;
    await channel.send({
        embeds: [
            new Discord.EmbedBuilder()
                .setColor("Red")
                .setDescription(reason)
        ],
        components: [
            new Discord.ActionRowBuilder()
                .setComponents([
                    new Discord.ButtonBuilder()
                        .setCustomId("letuserin_" + userId)
                        .setLabel("Let him in?")
                        .setStyle(Discord.ButtonStyle.Danger)
                ])
        ]
    })
}
async function isServerBlacklisted(guildId) {
    const server = await prisma.badServers.findFirst({
        where: {
            guild_id: guildId
        }
    })
    if (server) return server;
    return false
}
async function assignVerifiedRole(userId, guildId) {
    try {
        const serverConfig = await getServerConfig(guildId);
        if (!serverConfig || !serverConfig.verified_role_id) {
            console.error('No verified role configured for guild:', guildId);
            return false;
        }

        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            console.error('Bot not in guild:', guildId);
            return false;
        }

        try {
            // Check bot permissions first
            const botMember = await guild.members.fetch(client.user.id);
            if (!botMember) {
                console.error(`Bot is not a member of guild ${guildId}`);
                return false;
            }

            // Check if bot has MANAGE_ROLES permission
            if (!botMember.permissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
                console.error(`Bot lacks MANAGE_ROLES permission in guild ${guildId}`);
                return false;
            }

            // Check role hierarchy - bot can't assign roles higher than its own highest role
            const verifiedRole = await guild.roles.fetch(serverConfig.verified_role_id);
            if (!verifiedRole) {
                console.error(`Verified role ${serverConfig.verified_role_id} not found in guild ${guildId}`);
                return false;
            }

            const botHighestRole = botMember.roles.highest;
            console.log(botHighestRole)
            if (verifiedRole.position >= botHighestRole.position) {
                console.error(`Verified role is higher than bot's highest role in guild ${guildId}`);
                return false;
            }

            // Fetch member and assign role
            const member = await guild.members.fetch(userId);
            if (!member) {
                console.error(`User ${userId} not found in guild ${guildId}`);
                return false;
            }

            await member.roles.add(serverConfig.verified_role_id);
            return true;
        } catch (roleError) {
            console.error(`Error assigning role ${serverConfig.verified_role_id} to user ${userId} in ${guildId}:`, roleError);
            return false;
        }
    } catch (error) {
        console.error('Error in assignVerifiedRole:', error);
        return false;
    }
}
app.get('/callback', async (req, res) => {
    if (!req.query.code) {
        return res.status(400).send('Code not provided.');
    }

    const guildId = req.query.state || null;
    if (!guildId) {
        return res.status(400).send('Guild ID not provided.');
    }

    const { code } = req.query;
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.DISCORD_REDIRECT_URI
    });

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
        const response = await axios.post('https://discord.com/api/oauth2/token', params.toString(), { headers });

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${response.data.access_token}`,
                ...headers
            }
        });

        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${response.data.access_token}`,
                ...headers
            }
        });

        const { id } = userResponse.data;
        const userGuilds = guildsResponse.data.map(guild => guild.id);

        await insertOrUpdateUserData(id, userGuilds, response.data.access_token, response.data.refresh_token);

        // Check if user is in a bad guild
        const inBadGuild = await isUserInBadGuild(guildId, id);

        if (inBadGuild) {
            // User is in a bad guild, reject verification
            // const badGuilds = await getBadGuilds(id);
            res.send(`
                <html>
                <head>
                    <title>Verification Failed</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                        .error { color: red; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">Verification Failed</h1>
                        <p>You cannot be verified because you are in one or more prohibited servers.</p>
                        <p>Please leave these servers and try verifying again.</p>
                        <button onclick="window.close()">Close Window</button>
                    </div>
                    <script>
                        setTimeout(() => window.close(), 10000);
                    </script>
                </body>
                </html>
            `);
            const badGuilds = await getBadGuilds(id);


            const badGuildsList = badGuilds.map(guild =>
                `**Guild ID:** ${guild.guild_id}\n**Name:** ${guild.name}\n**Reason:** ${guild.reason}`
            ).join('\n\n');

            await logAction(guildId, `[ACTION-TAKEN] User ${(await client.users.fetch(id)).username} (${id}) tried joining the server.\n**User is in the following bad servers:**\n\n${badGuildsList}`)
        } else {
            const roleAssigned = await assignVerifiedRole(id, guildId);

            res.send(`
                <html>
                <head>
                    <title>Verification Successful</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                        .success { color: green; }
                        .container { max-width: 500px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="success">Verification Successful</h1>
                        <p>${roleAssigned ? 'Your verified role has been assigned.' : 'Verification successful, but there was an issue assigning your role.'}</p>
                        <p>You can now close this window and return to Discord.</p>
                        <button onclick="window.close()">Close Window</button>
                    </div>
                    <script>
                        setTimeout(() => window.close(), 5000);
                    </script>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Error during Discord OAuth2 callback:', error);
        res.status(500).send('An error occurred during the authentication process.');
    }
});

async function getAccessTokenForUser(userId) {
    try {
        const user = await prisma.users.findUnique({
            where: {
                user_id: userId
            },
            select: {
                access_token: true,
                refresh_token: true
            }
        });

        if (!user) return null;

        let { access_token, refresh_token } = user;

        try {
            await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            return access_token;
        } catch (tokenError) {
            if (tokenError.response && tokenError.response.status === 401) {
                try {
                    console.log(`Token expired for user ${userId}. Refreshing token...`);
                    const params = new URLSearchParams({
                        client_id: config.clientId,
                        client_secret: config.clientSecret,
                        grant_type: 'refresh_token',
                        refresh_token
                    });

                    const response = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    });

                    const newAccessToken = response.data.access_token;
                    const newRefreshToken = response.data.refresh_token;

                    await insertOrUpdateUserData(userId, [], newAccessToken, newRefreshToken);

                    return newAccessToken;
                } catch (refreshError) {
                    console.error('Error refreshing access token:', refreshError);
                    return null;
                }
            } else {
                console.error('Unexpected error with access token:', tokenError);
                return null;
            }
        }
    } catch (error) {
        console.error('Error retrieving tokens:', error);
        return null;
    }
}

async function updateGuilds(options = {}) {
    const {
        batchSize = 50,          // Process users in batches
        concurrencyLimit = 5,    // Number of users to process simultaneously
        timeoutBetweenBatches = 1000, // Time in ms to wait between batches
        progressCallback = null  // Function to call with progress updates
    } = options;

    try {
        // Count total users for progress tracking
        const totalUsers = await prisma.users.count();
        let processedUsers = 0;
        let updatedUsers = 0;
        let failedUsers = 0;

        // Send initial progress update
        if (progressCallback) {
            progressCallback({
                status: 'started',
                totalUsers,
                processedUsers,
                updatedUsers,
                failedUsers,
                percentComplete: 0
            });
        }

        // Process users in batches to avoid memory issues
        for (let skip = 0; skip < totalUsers; skip += batchSize) {
            // Get a batch of users
            const users = await prisma.users.findMany({
                select: {
                    user_id: true,
                    access_token: true,
                    refresh_token: true
                },
                skip,
                take: batchSize
            });

            // Process users in parallel with concurrency limit
            const startTime = performance.now();
            await processBatch(users, concurrencyLimit, {
                onProgress: (result) => {
                    processedUsers++;
                    if (result.success) updatedUsers++;
                    else failedUsers++;

                    if (progressCallback) {
                        progressCallback({
                            status: 'processing',
                            totalUsers,
                            processedUsers,
                            updatedUsers,
                            failedUsers,
                            percentComplete: Math.floor((processedUsers / totalUsers) * 100)
                        });
                    }
                }
            });

            // Calculate time taken for this batch
            const batchTime = performance.now() - startTime;

            // If processing was too fast, add a small delay to prevent API rate limiting
            if (batchTime < timeoutBetweenBatches) {
                await new Promise(resolve => setTimeout(resolve, timeoutBetweenBatches - batchTime));
            }
        }

        // Send final progress update
        if (progressCallback) {
            progressCallback({
                status: 'completed',
                totalUsers,
                processedUsers,
                updatedUsers,
                failedUsers,
                percentComplete: 100
            });
        }

        return {
            totalUsers,
            updatedUsers,
            failedUsers
        };
    } catch (error) {
        console.error('Error in global guild update:', error);
        throw error;
    }
}

// Helper function to process a batch of users with limited concurrency
async function processBatch(users, concurrencyLimit, options = {}) {
    const { onProgress } = options;
    const results = [];

    // Process users in chunks based on concurrency limit
    for (let i = 0; i < users.length; i += concurrencyLimit) {
        const chunk = users.slice(i, i + concurrencyLimit);
        const promises = chunk.map(user => processUser(user).then(result => {
            if (onProgress) onProgress(result);
            return result;
        }));

        // Wait for this chunk to complete before processing the next chunk
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
    }

    return results;
}

// Process a single user
async function processUser(user) {
    try {
        let token = await getAccessTokenForUser(user.user_id);
        if (!token) {
            console.error(`Failed to get a valid token for user ${user.user_id}`);
            return { userId: user.user_id, success: false, reason: 'invalid_token' };
        }

        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // Add timeout to prevent hanging requests
        });

        const updatedGuilds = guildsResponse.data.map(guild => guild.id);
        await insertOrUpdateUserData(user.user_id, updatedGuilds, token, user.refresh_token);

        return { userId: user.user_id, success: true };
    } catch (error) {
        console.error(`Error processing user ${user.user_id}:`, error);
        return { userId: user.user_id, success: false, reason: error.message };
    }
}



async function getBadGuilds(userId) {
    try {
        const user = await prisma.users.findUnique({
            where: {
                user_id: userId
            },
            select: {
                guilds: true
            }
        });
        if (!user) return [];

        const guildIds = user.guilds ? JSON.parse(user.guilds) : [];
        if (guildIds.length === 0) return [];

        const badGuilds = await prisma.badServers.findMany({
            where: {
                guild_id: {
                    in: guildIds
                }
            },
            select: {
                guild_id: true,
                name: true,
                reason: true
            }
        });

        return badGuilds;
    } catch (error) {
        console.error('Error getting bad guilds for user:', error);
        throw error;
    }
}

module.exports = {
    start: () => {
        app.listen(port, () => {
            console.log("OAuth server starting at port:", port);
        });
    },
    updateGuilds,
    getBadGuilds,
    isServerBlacklisted
};
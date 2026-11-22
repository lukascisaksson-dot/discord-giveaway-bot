const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const config = require('./config.json');

const DB_FILE = path.join(__dirname, 'giveaways.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

let giveaways = {};
if (fs.existsSync(DB_FILE)) {
  try {
    giveaways = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    giveaways = {};
  }
}

function saveGiveaways() {
  fs.writeFileSync(DB_FILE, JSON.stringify(giveaways, null, 2));
}

function isStaff(member) {
  const hasAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);
  const hasHostRole = config.hostRoleId && member.roles.cache.has(config.hostRoleId);
  return hasAdmin || hasHostRole;
}

const commands = [
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1))
        .addRoleOption(opt => opt.setName('required_role').setDescription('Optional role required to enter'))
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Pick a new winner for an ended giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true))
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

function pickWinners(entriesObj, count) {
  const weightedPool = [];
  for (const [userId, tickets] of Object.entries(entriesObj)) {
    for (let i = 0; i < tickets; i++) {
      weightedPool.push(userId);
    }
  }

  const winners = [];
  while (winners.length < count && weightedPool.length > 0) {
    const randIndex = Math.floor(Math.random() * weightedPool.length);
    const chosen = weightedPool[randIndex];
    winners.push(chosen);
    for (let i = weightedPool.length - 1; i >= 0; i--) {
      if (weightedPool[i] === chosen) weightedPool.splice(i, 1);
    }
  }
  return winners;
}

async function endGiveaway(messageId) {
  const data = giveaways[messageId];
  if (!data || data.ended) return;
  data.ended = true;
  saveGiveaways();

  try {
    const channel = await client.channels.fetch(data.channelId);
    const message = await channel.messages.fetch(messageId);
    const totalUsers = Object.keys(data.entries).length;
    const winners = pickWinners(data.entries, data.winnerCount);

    const winnerMentions = winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entries';

    const endedEmbed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY ENDED: ${data.prize}`)
      .setDescription(`**Winner(s):** ${winnerMentions}\n**Total Entrants:** ${totalUsers}\n**Hosted by:** <@${data.hostId}>`)
      .setColor('#2B2D31')
      .setTimestamp();

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gw_ended')
        .setLabel(`Giveaway Ended (${totalUsers} entrants)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await message.edit({ embeds: [endedEmbed], components: [disabledRow] });

    if (winners.length > 0) {
      await channel.send(`🎊 Congratulations ${winnerMentions}! You won **${data.prize}**!`);
    } else {
      await channel.send(`😢 No one entered the giveaway for **${data.prize}**.`);
    }
  } catch (err) {
    console.error('Failed to end giveaway:', err);
  }
}
function scheduleGiveaway(messageId) {
  const data = giveaways[messageId];
  if (!data || data.ended) return;
  const remaining = data.endTime - Date.now();
  if (remaining <= 0) {
    endGiveaway(messageId);
  } else {
    setTimeout(() => endGiveaway(messageId), remaining);
  }
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Error registering commands:', err);
  }

  for (const messageId of Object.keys(giveaways)) {
    if (!giveaways[messageId].ended) {
      scheduleGiveaway(messageId);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Only admins/staff can manage giveaways.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const minutes = interaction.options.getInteger('minutes');
      const winnerCount = interaction.options.getInteger('winners');
      const requiredRole = interaction.options.getRole('required_role');

      const endTime = Date.now() + minutes * 60 * 1000;
      const endTimestamp = Math.floor(endTime / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${prize}`)
        .setDescription(
          `Click **Enter Giveaway** below to join!\n\n` +
          `**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n` +
          `**Winners:** ${winnerCount}\n` +
          `**Hosted by:** ${interaction.user}` +
          (requiredRole ? `\n**Required Role:** ${requiredRole}` : '')
        )
        .setColor(config.embedColor)
        .setFooter({ text: 'Entrants: 0' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('gw_enter')
          .setLabel('🎉 Enter Giveaway (0)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gw_end_early')
          .setLabel('⏹️ End Now (Admin)')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ content: '✅ Giveaway created!', ephemeral: true });
      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      giveaways[msg.id] = {
        prize,
        winnerCount,
        hostId: interaction.user.id,
        channelId: interaction.channel.id,
        requiredRoleId: requiredRole ? requiredRole.id : null,
        endTime,
        entries: {},
        ended: false
      };
      saveGiveaways();
      scheduleGiveaway(msg.id);
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const data = giveaways[messageId];

      if (!data || !data.ended) {
        return interaction.reply({ content: '❌ Could not find an ended giveaway with that Message ID.', ephemeral: true });
      }

      const winners = pickWinners(data.entries, 1);
      if (winners.length === 0) {
        return interaction.reply({ content: '❌ There were no entries to reroll.', ephemeral: true });
      }

      await interaction.reply(`🎉 New winner for **${data.prize}**: <@${winners[0]}>!`);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'gw_end_early') {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: '❌ Only admins can end a giveaway early.', ephemeral: true });
      }

      const data = giveaways[interaction.message.id];
      if (!data || data.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
      }

      await interaction.reply({ content: '⏹️ Ending giveaway early and picking a winner...', ephemeral: true });
      await endGiveaway(interaction.message.id);
      return;
    }

    if (interaction.customId === 'gw_enter') {
      const data = giveaways[interaction.message.id];
      if (!data || data.ended) {
        return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
      }

      if (data.requiredRoleId && !interaction.member.roles.cache.has(data.requiredRoleId)) {
        return interaction.reply({ content: `❌ You need the <@&${data.requiredRoleId}> role to enter this giveaway.`, ephemeral: true });
      }

      if (data.entries[interaction.user.id]) {
        return interaction.reply({ content: '⚠️ You are already entered in this giveaway!', ephemeral: true });
      }

      let multiplier = 1;
      if (config.bonusRoles) {
        for (const [roleId, bonus] of Object.entries(config.bonusRoles)) {
          if (interaction.member.roles.cache.has(roleId) && bonus > multiplier) {
            multiplier = bonus;
          }
        }
      }
      data.entries[interaction.user.id] = multiplier;
      saveGiveaways();

      const bonusText = multiplier > 1 ? ` (**${multiplier}x VIP entries!**)` : '';
      await interaction.reply({ content: `✅ You entered the giveaway!${bonusText}`, ephemeral: true });

      const totalUsers = Object.keys(data.entries).length;
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
        text: `Entrants: ${totalUsers}`
      });

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('gw_enter')
          .setLabel(`🎉 Enter Giveaway (${totalUsers})`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('gw_end_early')
          .setLabel('⏹️ End Now (Admin)')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.message.edit({ embeds: [updatedEmbed], components: [updatedRow] });
    }
  }
});

client.login(config.token);

const { PermissionFlagsBits,SlashCommandBuilder } = require('discord.js');
const ChannelController = require('../controllers/ChannelController');
const DailyStreakController = require('../controllers/DailyStreakController');
const GuidelineInfoController = require('../controllers/GuidelineInfoController');
const PartyController = require('../controllers/PartyController');
const UserController = require('../controllers/UserController');
const Time = require('../helpers/time');
const DailyStreakMessage = require('../views/DailyStreakMessage');
const supabase = require('../helpers/supabaseClient');
const { CHANNEL_PARTY_ROOM } = require('../helpers/config');
const PartyMessage = require('../views/PartyMessage');
const ReferralCodeController = require('../controllers/ReferralCodeController');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('admin')
		.setDescription('Admin Access')
		.addSubcommand(subcommand =>
			subcommand
				.setName('party__add_user')
				.setDescription('add user to party')
				.addUserOption(option => option.setName('user').setDescription('user').setRequired(true))
				.addStringOption(option => option.setName('party').setDescription("Party Number").setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('thread__remove_user')
				.setDescription('remove user from thread')
				.addUserOption(option => option.setName('user').setDescription('user').setRequired(true))
				.addStringOption(option => option.setName('link').setDescription("Message Link").setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('party__remove_user')
				.setDescription('remove user from party')
				.addUserOption(option => option.setName('user').setDescription('user').setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('referral')
				.setDescription('generate new referral')
				.addUserOption(option => option.setName('user').setDescription('user'))
				.addStringOption(option => option.setName('total').setDescription('total referral')))
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
	async execute(interaction) {
		const command = interaction.options.getSubcommand()
		await interaction.deferReply({ephemeral:true});
		
		if(command === 'party__add_user'){
			const user = interaction.options.getUser('user')
			const partyNumber = interaction.options.getString('party')
			const {body:{goalId}} = await UserController.getDetail(user.id,'goalId')
			await PartyController.addMemberPartyRoom(interaction.client,goalId,partyNumber,user.id)
			const dataPartyRooms = await supabase.from("PartyRooms")
				.select("*,MemberPartyRooms(UserId,project,isLeader,isTrialMember)")
				.eq('id',partyNumber)
				.single()
		
			const channelParty = ChannelController.getChannel(interaction.client,CHANNEL_PARTY_ROOM)
			const threadPartyRoom = await ChannelController.getThread(channelParty,dataPartyRooms.body.msgId)
			threadPartyRoom.send(PartyMessage.userJoinedParty(user.id))
			
			PartyController.updateMessagePartyRoom(interaction.client,dataPartyRooms.body.msgId,partyNumber)
		
			ChannelController.sendToNotification(
				interaction.client,
				PartyMessage.replySuccessJoinParty(user.id,dataPartyRooms.body.msgId),
				user.id
			)
		
			PartyController.followGoalAccountabilityPartner(interaction.client,partyNumber,user.id,goalId)
	
			interaction.editReply('success add user to party')
		}else if(command === 'party__remove_user'){
			const user = interaction.options.getUser('user')
			const memberPartyRooms = await supabase.from("MemberPartyRooms")
				.select("partyId,PartyRooms(msgId),Users(goalId)")
				.limit(1)
				.eq("UserId",user.id)
				.order('endPartyDate',{ascending:false})
				.single()
			if(memberPartyRooms.body){
				const {partyId,PartyRooms:{msgId},Users:{goalId}} = memberPartyRooms.body
				await PartyController.removeMemberPartyRoom(interaction.client,goalId,partyId,user.id)
				const channelParty = ChannelController.getChannel(interaction.client,CHANNEL_PARTY_ROOM)
				const threadPartyRoom = await ChannelController.getThread(channelParty,msgId)
				ChannelController.removeUserFromThread(interaction.client,CHANNEL_PARTY_ROOM,msgId)
				threadPartyRoom.send(PartyMessage.userLeaveParty(user.id))
				ChannelController.removeUserFromThread(interaction.client,CHANNEL_PARTY_ROOM,msgId)
				PartyController.updateMessagePartyRoom(interaction.client,msgId,partyId)
			
				PartyController.unfollowGoalAccountabilityPartner(interaction.client,partyId,user.id,goalId)
		
				interaction.editReply('success remove user from party')
			}else{
				interaction.editReply('failed remove user from party')
			}
		
		}else if(command === 'thread__remove_user'){
			const user = interaction.options.getUser('user')
			const messageLink = interaction.options.getString('link')
			const channelId= messageLink.split('/')[5]
			const threadId= messageLink.split('/')[6]

			if(channelId && threadId){
				ChannelController.removeUserFromThread(interaction.client,channelId,threadId,user.id)
				interaction.editReply('success remove user from thread')
			}else{
				interaction.editReply('failed remove user from thread')
			}
		}else if(command === 'referral'){
			const user = interaction.options.getUser('user')
			const totalReferral = interaction.options.getString('total')
			const targetUserId = user ? user?.id : interaction.user.id
			const values = await ReferralCodeController.addNewReferral(
				targetUserId,
				totalReferral || 1
			)
			GuidelineInfoController.updateMessageGuideline(
				interaction.client,
				targetUserId
			)

			const referralCode = values.map(data=>data.referralCode)
			interaction.editReply(referralCode.join('\n'))
		}
		
	},
};
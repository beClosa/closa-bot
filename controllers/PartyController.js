const {Modal,TextInputComponent,showModal} = require('discord-modals'); // Define the discord-modals package!
const { CHANNEL_GOALS, CHANNEL_PARTY_MODE, CHANNEL_GENERAL, CHANNEL_CLOSA_CAFE, GUILD_ID, CATEGORY_CHAT } = require('../helpers/config');
const LocalData = require('../helpers/LocalData.js');
const supabase = require('../helpers/supabaseClient');
const Time = require('../helpers/time');
const PartyMessage = require('../views/PartyMessage');
const ChannelController = require('./ChannelController');
const schedule = require('node-schedule');
const TodoReminderMessage = require('../views/TodoReminderMessage');
const MemberController = require('./MemberController');
const MessageFormatting = require('../helpers/MessageFormatting');
const { ChannelType, PermissionFlagsBits } = require('discord-api-types/v9');
class PartyController{
    static showModalWriteGoal(interaction){
        if(interaction.customId.includes('writeGoal')){
			const modal = new Modal()
			.setCustomId(interaction.customId)
			.setTitle("Set your goal 🎯")
			.addComponents(
				new TextInputComponent().setCustomId('project').setLabel("Project Name").setPlaceholder("Short project's name e.g: Design Exploration").setStyle("SHORT").setRequired(true),
				new TextInputComponent().setCustomId('goal').setLabel("My goal is").setPlaceholder("Write specific & measurable goal e.g: read 2 books").setStyle("SHORT").setRequired(true),
				new TextInputComponent().setCustomId('about').setLabel("About Project").setPlaceholder("Tell a bit about this project").setStyle("LONG").setRequired(true),
				new TextInputComponent().setCustomId('shareProgressAt').setLabel("I'll share my progress at").setPlaceholder("e.g 21.00").setStyle("SHORT").setRequired(true),
			)
			showModal(modal, {
				client: interaction.client, // Client to show the Modal through the Discord API.
				interaction: interaction, // Show the modal with interaction data.
			});
			return true
		}
        return false
    }

    static showModalEditGoal(interaction){
        if(interaction.customId.includes('editGoal')){
			const project = interaction.message.embeds[0].title
			const [{value:goal},{value:about},{value:descriptionShareProgress}] = interaction.message.embeds[0].fields
			const shareProgressAt = PartyController.getTimeShareProgress(descriptionShareProgress)
			const modal = new Modal()
			.setCustomId(interaction.customId)
			.setTitle("Set your goal 🎯")
			.addComponents(
				new TextInputComponent().setCustomId('project').setLabel("Project Name").setDefaultValue(project).setPlaceholder("Short project's name e.g: Design Exploration").setStyle("SHORT").setRequired(true),
				new TextInputComponent().setCustomId('goal').setLabel("My goal is").setDefaultValue(goal).setPlaceholder("Write specific & measurable goal e.g: read 2 books").setStyle("SHORT").setRequired(true),
				new TextInputComponent().setCustomId('about').setLabel("About Project").setDefaultValue(about).setPlaceholder("Tell a bit about this project").setStyle("LONG").setRequired(true),
				new TextInputComponent().setCustomId('shareProgressAt').setLabel("I'll share my progress at").setDefaultValue(shareProgressAt).setPlaceholder("e.g 21.00").setStyle("SHORT").setRequired(true),
			)
			showModal(modal, {
				client: interaction.client, // Client to show the Modal through the Discord API.
				interaction: interaction, // Show the modal with interaction data.
			});
			return true
		}
        return false
    }

    static async interactionPickRole(interaction,role,type='party'){
        await interaction.editReply(PartyMessage.pickYourGoalCategory(role,interaction.user.id,type))
        interaction.message.delete()
    }

	static getNextCohort(){
		return LocalData.getData().cohort + 1
	}

	static async getUsersJoinedParty(){
		const data = await supabase.from("JoinParties")
			.select()
			.eq('cohort',this.getNextCohort())
			.order('createdAt',{ascending:false})
		return data.body
	}
	static async updateMessageWaitingRoom(client){
		const msg = await PartyController.getMessageWaitingRoom(client)
		const usersJoinedParty = await PartyController.getUsersJoinedParty()
		const totalUserHaveNotSetGoal = await PartyController.getTotalUserHaveNotSetGoal()
		msg.edit(PartyMessage.contentWaitingRoom(totalUserHaveNotSetGoal,PartyController.formatUsersJoinedParty(usersJoinedParty)))
	}

	static async getTotalUserHaveNotSetGoal(){
        const {count} = await supabase
			.from('JoinParties')
			.select('id', { count: 'exact' })
			.eq('cohort',this.getNextCohort())
			.eq('alreadySetGoal',false)

        return count
	}

	static async getMessageWaitingRoom(client){
		const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
		const msg = await ChannelController.getMessage(channelParty,LocalData.getData().msgIdContentWaitingRoom)
		return msg
	}

	static isPartyMode(value){
		const accountabilityMode = value.split('-')[0]
		return accountabilityMode === 'party'
	}

	static formatUsersJoinedParty(users){
		let result = ''
		for (let i = 0; i < users.length; i++) {
			const user = users[i];
			result += `${MessageFormatting.tagUser(user.UserId)} ${user.alreadySetGoal ? "✅" : "⏳"}`
			if(i !== users.length - 1) result += '\n'
		}
		return result
	}

	static getTimeShareProgress(shareProgressAt){
		return shareProgressAt.split(" ")[0]
	}

	static async interactionPostGoal(interaction,value){
		const deadlineGoal = PartyController.getDeadlineGoal()
		const project = interaction.message.embeds[0].title
		const [{value:goal},{value:about},{value:descriptionShareProgress}] = interaction.message.embeds[0].fields
		const shareProgressAt = PartyController.getTimeShareProgress(descriptionShareProgress)
		const [accountabilityMode,role,goalCategory] = value.split('-')
		
		PartyController.setProgressReminder(interaction,shareProgressAt)
		if(this.isPartyMode(value)){
			const kickoffDate = Time.getFormattedDate(Time.getDate(LocalData.getData().kickoffDate))
			const kickoffEventId = LocalData.getData().kickoffEventId
			const notificationThread = await ChannelController.getNotificationThread(interaction.client,interaction.user.id)
			await interaction.editReply(PartyMessage.remindUserAttendKicoff(interaction.user.id,kickoffDate,kickoffEventId))
			notificationThread.send(MessageFormatting.linkToEvent(kickoffEventId))
			interaction.message.delete()
			await supabase.from("JoinParties")
			.update({
				role,
				goalCategory,
				project,
				goal,
				about,
				shareProgressAt,
				alreadySetGoal:true
			})
			.eq('UserId',interaction.user.id)
			.eq('cohort',PartyController.getNextCohort())
			PartyController.updateMessageWaitingRoom(interaction.client)
		}else{
			await interaction.editReply(PartyMessage.askUserWriteHighlight(interaction.user.id))
			interaction.message.delete()
			const channelGoals = ChannelController.getChannel(interaction.client,CHANNEL_GOALS)
			channelGoals.send(PartyMessage.postGoal({
				project,
				goal,
				about,
				shareProgressAt,
				role,
				user:interaction.user,
				deadlineGoal:deadlineGoal,
				value
			}))
			.then(msg=>{
				supabase.from("Goals")
				.update({deadlineGoal:Time.getDateOnly(Time.getNextDate(-1))})
				.eq("UserId",interaction.user.id)
				.gte('deadlineGoal',Time.getTodayDateOnly())
				.single()
				.then(async updatedData =>{
					supabase.from('Goals')
					.insert([{
						role,
						goalCategory,
						project,
						goal,
						about,
						shareProgressAt,
						id:msg.id,
						deadlineGoal:deadlineGoal.deadlineDate,
						isPartyMode:accountabilityMode === 'party' ? true : false,
						alreadySetHighlight:false,
						UserId:interaction.user.id,
					}])
					.then()
					if (updatedData.body) {
						PartyController.updateGoal(interaction.client,updatedData.body,0)
					}
				})
				ChannelController.createThread(msg,project,interaction.user.username)
				supabase.from('Users')
					.update({
						goalId:msg.id,
						reminderProgress:shareProgressAt
					})
					.eq('id',interaction.user.id)
					.then()
			})

		}
	}

	static async alreadyHaveGoal(userId){
		const data = await supabase.from("Goals").select('id').eq("UserId",userId).gt('deadlineGoal',Time.getTodayDateOnly())
		return data.body.length !== 0
	}

	static async getAllActiveGoal(){
		const data = await supabase.from("Goals")
		.select()
		.gte('deadlineGoal',Time.getTodayDateOnly())
		
		return data
	}

	static async updateGoal(client,data,dayLeft){
		const channelGoals = ChannelController.getChannel(client,CHANNEL_GOALS)
		const user = await MemberController.getMember(client,data.UserId)
		const existingGoal = await ChannelController.getMessage(channelGoals,data.id)
		const {role,project,goal,about,shareProgressAt,deadlineGoal,isPartyMode} = data
		existingGoal.edit(PartyMessage.postGoal({project,goal,about,shareProgressAt,role,deadlineGoal:{deadlineDate:deadlineGoal,dayLeft},user:user,value:isPartyMode ? 'party':'solo'}))
	}

	static async updateAllActiveGoal(client){
		let ruleUpdateGoal = new schedule.RecurrenceRule();
        
        ruleUpdateGoal.hour = 17
        ruleUpdateGoal.minute = 1
        schedule.scheduleJob(ruleUpdateGoal,function(){
			PartyController.getAllActiveGoal()
				.then(data=>{
					if (data.body) {
						data.body.forEach(goal=>{
							const dayLeft = Time.getDayLeft(Time.getDate(goal.deadlineGoal))
							PartyController.updateGoal(client,goal,dayLeft)
						})
					}
				})
		})
	}

	static hideChannelPartyMode(client){
		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getDate(kickoffDate)
		ruleFirstDayCooldown.setHours(Time.minus7Hours(21))
		ruleFirstDayCooldown.setMinutes(0)
		schedule.scheduleJob(ruleFirstDayCooldown,async function(){
			ChannelController.setVisibilityChannel(client,CHANNEL_PARTY_MODE,false)
		})
	}
	static showChannelPartyMode(client){
		ChannelController.setVisibilityChannel(client,CHANNEL_PARTY_MODE,true)
	}

	static async createPrivateVoiceChannel(client,channelName,allowedUsers=[]){
		const guild = client.guilds.cache.get(GUILD_ID)

		const permissionOverwrites = [
			{
				id:guild.roles.everyone.id,
				deny:[
					PermissionFlagsBits.ViewChannel
				]
			}
		]

		for (let i = 0; i < allowedUsers.length; i++) {
			const userId = allowedUsers[i];
			const {user} = await MemberController.getMember(client,userId)
			permissionOverwrites.push({
				id:user.id,
				allow:[
					PermissionFlagsBits.ViewChannel
				]
			})
		}
		
		const voiceChannel = await guild.channels.create(channelName,{
			permissionOverwrites,
			parent:ChannelController.getChannel(client,CATEGORY_CHAT),
			type:ChannelType.GuildVoice,
		})
		return voiceChannel.id
	}

	static async generateWaitingRoomPartyMode(client){
		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getNextDate(-7,kickoffDate)
		ruleFirstDayCooldown.setHours(Time.minus7Hours(8))
		ruleFirstDayCooldown.setMinutes(30)
		schedule.scheduleJob(ruleFirstDayCooldown,async function(){
			PartyController.showChannelPartyMode(client)
			const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
			const usersJoinedParty = await PartyController.getUsersJoinedParty()
			const totalUserHaveNotSetGoal = await PartyController.getTotalUserHaveNotSetGoal()
			const msg = await channelParty.send(PartyMessage.contentWaitingRoom(totalUserHaveNotSetGoal,PartyController.formatUsersJoinedParty(usersJoinedParty)))
			channelParty.send(PartyMessage.embedMessageWaitingRoom(PartyController.getTimeLeftUntilKickoff()))
			
			const data = LocalData.getData()
			data.msgIdContentWaitingRoom = msg.id
			LocalData.writeData(data)
		})
	}

	static getTimeLeftUntilKickoff(){
		const kickoffDate = Time.getDate(LocalData.getData().kickoffDate)
		kickoffDate.setHours(Time.minus7Hours(20))
		kickoffDate.setMinutes(0)
		const diffTime = Time.getDiffTime(Time.getDate(),kickoffDate)
		return Time.convertTime(diffTime)
	}

	static createKickoffEvent(client){
		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getNextDate(-7,kickoffDate)
        ruleFirstDayCooldown.setHours(22)
        ruleFirstDayCooldown.setMinutes(0)

		schedule.scheduleJob(ruleFirstDayCooldown,function(){
            ChannelController.scheduleEvent(client,{
                name:"Live Kick-off 🚀",
                description:PartyMessage.descriptionKickoffEvent(),
                scheduledStartTime:PartyController.getStartTimeKickoffEvent(),
                scheduledEndTime:PartyController.getEndTimeKickoffEvent(),
                entityType:"VOICE",
                channel:ChannelController.getChannel(client,CHANNEL_CLOSA_CAFE)
            })
            .then(kickoffEventId=>{
                const data = LocalData.getData()
                data.kickoffEventId = kickoffEventId.id
                LocalData.writeData(data)
            })
        })
	}

	static getStartTimeKickoffEvent(){
		const kickoffDate = Time.getDate(LocalData.getData().kickoffDate)
		kickoffDate.setHours(Time.minus7Hours(20))
		kickoffDate.setMinutes(0)
		return kickoffDate
	}

	static getEndTimeKickoffEvent(){
		const kickoffDate = Time.getDate(LocalData.getData().kickoffDate)
		kickoffDate.setHours(Time.minus7Hours(21))
		kickoffDate.setMinutes(0)
		return kickoffDate
	}

	static remind30MinutesBeforeKickoff(client){
		const {kickoffDate} = LocalData.getData()
		const remindBeforeKickoff = Time.getDate(kickoffDate)
        remindBeforeKickoff.setHours(Time.minus7Hours(19))
        remindBeforeKickoff.setMinutes(30)
		const channel = ChannelController.getChannel(client,CHANNEL_GENERAL)

        schedule.scheduleJob(remindBeforeKickoff,function() {
			const kickoffEventId = LocalData.getData().kickoffEventId
			channel.send(PartyMessage.remind30MinutesBeforeKickoff(kickoffEventId))
        })
	
	}

	static async sendNotifToSetHighlight(client,userId) {
		supabase.from("Goals")
			.select('id,alreadySetHighlight,Users(notificationId,reminderHighlight)')
			.eq("UserId",userId)
			.gt('deadlineGoal',Time.getTodayDateOnly())
			.eq('alreadySetHighlight',false)
			.single()
			.then(async data => {
				 if(data.body){
						supabase.from("Goals")
							.update({alreadySetHighlight:true})
							.eq('id',data.body.id)
							.then()
						const {reminderHighlight,notificationId}= data.body.Users
						const notificationThread = await ChannelController.getNotificationThread(client,userId,notificationId)
						if(reminderHighlight){
							notificationThread.send(PartyMessage.settingReminderHighlightExistingUser(userId,reminderHighlight))
						}else{
							notificationThread.send(PartyMessage.settingReminderHighlight(userId))
						}
												
				}
			})
	}

	static async interactionSetDefaultReminder(interaction,value){
		if (!value) {
			supabase.from("Users")
				.update({reminderHighlight:'07.30'})
				.eq('id',interaction.user.id)
				.then()
		}
		await interaction.editReply(PartyMessage.replyDefaultReminder(value))
		interaction.message.delete()
	}

	static setProgressReminder(interaction,shareProgressAt){
		supabase.from("Users")
		.select('reminderProgress')
		.eq('id',interaction.user.id)
		.single()
		.then(data => {
			if (data.body.reminderProgress !== shareProgressAt) {
				supabase.from("Users")
				.update({reminderProgress:shareProgressAt})
				.eq('id',interaction.user.id)
				.single()
				.then(async ({data:user})=>{
					const [hours,minutes] = user.reminderProgress.split(/[.:]/)
					let ruleReminderProgress = new schedule.RecurrenceRule();
					ruleReminderProgress.hour = Time.minus7Hours(hours)
					ruleReminderProgress.minute = minutes
					const scheduleReminderProgress = schedule.scheduleJob(ruleReminderProgress,function(){
						supabase.from('Users')
						.select()
						.eq('id',user.id)
						.single()
						.then(async ({data})=>{
							if (data) {
								if (user.reminderProgress !== data.reminderProgress) {
									scheduleReminderProgress.cancel()
								}else if (data.lastDone !== Time.getDate().toISOString().substring(0,10)) {
									const userId = data.id;
									const notificationThread = await ChannelController.getNotificationThread(interaction.client,data.id,data.notificationId)
									notificationThread.send(TodoReminderMessage.progressReminder(userId))

								}
							}
						})
					
					})
				})
			}
		})

	}

	static isLastWeekCohort(){
		const {kickoffDate} = LocalData.getData()
		const todayDate = Time.getTodayDateOnly()
		const lastWeekCohort = Time.getDateOnly(Time.getNextDate(-14,kickoffDate))
		return todayDate <= lastWeekCohort
	}

	static getDeadlineGoal(){
		const {celebrationDate,kickoffDate} = LocalData.getData()
		const todayDate = Time.getTodayDateOnly()
		const result = {
			dayLeft:null,
			description:'',
			deadlineDate:null
		}
		
		if (this.isLastWeekCohort() || Time.isCooldownPeriod() ) {
			result.dayLeft = Time.getDiffDay(Time.getDate(todayDate),Time.getDate(celebrationDate))
			result.deadlineDate = celebrationDate
			result.description = 'celebration'
		}else {
			const deadlineDate = Time.getNextDate(-1,kickoffDate)
			result.dayLeft = Time.getDiffDay(Time.getDate(todayDate),deadlineDate)
			result.deadlineDate = Time.getDateOnly(deadlineDate)
			result.description = 'kick-off'
		}
		return result
	}
}

module.exports = PartyController
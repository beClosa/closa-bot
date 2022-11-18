const {Modal,TextInputComponent,showModal} = require('discord-modals'); // Define the discord-modals package!
const { CHANNEL_GOALS, CHANNEL_PARTY_MODE, CHANNEL_GENERAL, CHANNEL_CLOSA_CAFE, GUILD_ID, CATEGORY_CHAT, CHANNEL_PARTY_ROOM, ROLE_TRIAL_MEMBER } = require('../helpers/config');
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
const RecurringMeetupMessage = require('../views/RecurringMeetupMessage');
const RecurringMeetupController = require('./RecurringMeetupController');
const GoalMessage = require('../views/GoalMessage');
const PartyController = require('./PartyController');

class GoalController {

    static async interactionPickRole(interaction,role,type='party'){
        await interaction.editReply(GoalMessage.pickYourGoalCategory(role,interaction.user.id,type))
        interaction.message.delete()
    }

    static async interactionPickGoalCategory(interaction,valueMenu){
        const deadlineGoal = GoalController.getDeadlineGoal()
        await interaction.editReply(GoalMessage.askUserWriteGoal(deadlineGoal.dayLeft,deadlineGoal.description,interaction.user.id,valueMenu))
        interaction.message.delete()
    }

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
			showModal(modal, { client: interaction.client, interaction: interaction});
			return true
		}
        return false
    }

    static async interactionPostGoal(interaction,value){
		const project = interaction.message.embeds[0].title
		const [{value:goal},{value:about},{value:descriptionShareProgress}] = interaction.message.embeds[0].fields
		const shareProgressAt = PartyController.getTimeShareProgress(descriptionShareProgress)
		const [accountabilityMode,role,goalCategory] = value.split('-')

		PartyController.setProgressReminder(interaction,shareProgressAt)
		
		if(PartyController.isPartyMode(value)){
			const kickoffDate = Time.getFormattedDate(Time.getDate(LocalData.getData().kickoffDate))
			const kickoffEventId = LocalData.getData().kickoffEventId
			const notificationThread = await ChannelController.getNotificationThread(interaction.client,interaction.user.id)
			notificationThread.send(MessageFormatting.linkToEvent(kickoffEventId))

			await interaction.editReply(PartyMessage.remindUserAttendKicoff(interaction.user.id,kickoffDate,kickoffEventId))
			interaction.message.delete()

			await supabase.from("JoinParties")
				.update({role,goalCategory,project,goal,about,shareProgressAt,alreadySetGoal:true})
				.eq('UserId',interaction.user.id)
				.eq('cohort',PartyController.getNextCohort())
			
			PartyController.updateMessageWaitingRoom(interaction.client)
		}else if(accountabilityMode.includes('joinParty')){
			GoalController.submitGoal(interaction.client,interaction.user,{project,goal,about,goalCategory,shareProgressAt,role,accountabilityMode})

			const partyId = accountabilityMode.split('joinParty')[1]
			const dataParty = await supabase.from("PartyRooms")
				.select("*,MemberPartyRooms(UserId,goal,isLeader,isTrialMember)")
				.eq('id',partyId)
				.single()
			const members = dataParty.body?.MemberPartyRooms
			const {
				totalExistingMembers,
				totalTrialMember
			} = PartyController.countTotalMemberParty(members)
			const isTrialMember = await MemberController.hasRole(interaction.client,interaction.user.id,ROLE_TRIAL_MEMBER)

			if ((isTrialMember && totalTrialMember === 1) || (!isTrialMember && totalExistingMembers === 3)) {
				await interaction.editReply(PartyMessage.replyCannotJoinPartyFullAfterSetGoal(interaction.user.id))
			}else{
				const {celebrationDate} = LocalData.getData()
				supabase.from("MemberPartyRooms")
					.insert({goal,isTrialMember,partyId,endPartyDate:celebrationDate,UserId:interaction.user.id})
					.then(()=>{
						PartyController.updateMessagePartyRoom(interaction.client,dataParty.body.msgId,partyId)
					})
				await interaction.editReply(PartyMessage.replyImmediatelyJoinParty(interaction.user.id,dataParty.body?.msgId))
			}
			const channelParty = ChannelController.getChannel(interaction.client,CHANNEL_PARTY_ROOM)
			const partyThread = await ChannelController.getThread(channelParty,dataParty.body.msgId,partyId)
			partyThread.send(PartyMessage.userJoinedParty(interaction.user.id))
			interaction.message.delete()
		}else{
			await interaction.editReply(PartyMessage.askUserWriteHighlight(interaction.user.id))
			interaction.message.delete()
			
			GoalController.submitGoal(interaction.client,interaction.user,{project,goal,about,goalCategory,shareProgressAt,role,accountabilityMode})
		}
	}

	static async submitGoal(client,user,{project,goal,about,goalCategory,shareProgressAt,role,accountabilityMode}){
		const deadlineGoal = GoalController.getDeadlineGoal()

		const channelGoals = ChannelController.getChannel(client,CHANNEL_GOALS)
		const msg = await channelGoals.send(GoalMessage.postGoal({
			project,
			goal,
			about,
			shareProgressAt,
			role,
			user:user,
			deadlineGoal:deadlineGoal,
			value:accountabilityMode
		}))

		const updatedData = await supabase.from("Goals")
		.update({deadlineGoal:Time.getDateOnly(Time.getNextDate(-1))})
		.eq("UserId",user.id)
		.gte('deadlineGoal',Time.getTodayDateOnly())
		.single()

		supabase.from('Goals')
		.insert({
			role,
			goalCategory,
			project,
			goal,
			about,
			shareProgressAt,
			id:msg.id,
			deadlineGoal:deadlineGoal.deadlineDate,
			isPartyMode:accountabilityMode === 'solo' ? false : true,
			alreadySetHighlight:false,
			UserId:user.id,
		})
		.then()

		if (updatedData.body) {
			GoalController.updateGoal(client,updatedData.body,0)
		}

		ChannelController.createThread(msg,project,user.username)
		supabase.from('Users')
			.update({
				goalId:msg.id,
				reminderProgress:shareProgressAt
			})
			.eq('id',user.id)
			.then()
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
			showModal(modal, { client: interaction.client, interaction: interaction});
			return true
		}
        return false
    }

	static async generateAllUserGoalFromWaitingRoom(client){
		const {kickoffDate} = LocalData.getData()
		const ruleKickoff = Time.getDate(kickoffDate)
		ruleKickoff.setHours(Time.minus7Hours(20))
		ruleKickoff.setMinutes(30)
		schedule.scheduleJob(ruleKickoff,async function(){
			const data = await supabase.from("JoinParties")
			.select()
			.eq('cohort',PartyController.getNextCohort())
			.not('goal','is',null)
			data.body.forEach(async ({UserId,goal,project,about,goalCategory,shareProgressAt,role})=>{
				const {user} = await MemberController.getMember(client,UserId)
				GoalController.submitGoal(client,user,{project,goal,about,goalCategory,shareProgressAt,role,accountabilityMode:'party'})
			})
		})
	}

	static async updateGoal(client,data,dayLeft){
		const channelGoals = ChannelController.getChannel(client,CHANNEL_GOALS)
		const user = await MemberController.getMember(client,data.UserId)
		const existingGoal = await ChannelController.getMessage(channelGoals,data.id)
		const {role,project,goal,about,shareProgressAt,deadlineGoal,isPartyMode} = data
		existingGoal.edit(GoalMessage.postGoal({project,goal,about,shareProgressAt,role,deadlineGoal:{deadlineDate:deadlineGoal,dayLeft},user:user,value:isPartyMode ? 'party':'solo'}))
	}

	static async updateAllActiveGoal(client){
		let ruleUpdateGoal = new schedule.RecurrenceRule();
        ruleUpdateGoal.hour = 17
        ruleUpdateGoal.minute = 1
        schedule.scheduleJob(ruleUpdateGoal,function(){
			GoalController.getAllActiveGoal()
				.then(data=>{
					if (data.body) {
						data.body.forEach(goal=>{
							const dayLeft = Time.getDayLeft(Time.getDate(goal.deadlineGoal))
							GoalController.updateGoal(client,goal,dayLeft)
						})
					}
				})
		})
	}

	static remindToWriteGoal(client){
		const {kickoffDate} = LocalData.getData()
		const remindBeforeKickoff = Time.getDate(kickoffDate)
        remindBeforeKickoff.setHours(Time.minus7Hours(20))
        remindBeforeKickoff.setMinutes(5)

        schedule.scheduleJob(remindBeforeKickoff,function() {
			supabase.from("JoinParties")
				.select("UserId")
				.eq('cohort',PartyController.getNextCohort())
				.eq('alreadySetGoal',false)
				.then(data=>{
					if(data.body){
						data.body.forEach(async member=>{
							const notificationThread = await ChannelController.getNotificationThread(client,member.UserId)
							notificationThread.send(GoalMessage.remindToWriteGoal(member.UserId))
							notificationThread.send(GoalMessage.pickYourRole(member.UserId,'party'))
						})
					}
				})
        })
	
	}

    static async createThreadGoal(msg){
        let threadName = `${msg.content.split('\n')[0]}`
        if (threadName.includes("**")) {
            threadName = threadName.split("**")[1]
        }else if (threadName.includes("*")) {
            threadName = threadName.split("*")[1]
        }
        const threadGoal = await ChannelController.createThread(
            msg,
            threadName,
            msg.author.username
        )

        return threadGoal
    }

	static async getAllActiveGoal(){
		const data = await supabase.from("Goals").select().gte('deadlineGoal',Time.getTodayDateOnly())
		return data
	}

	static async alreadyHaveGoal(userId){
		const data = await supabase.from("Goals").select('id').eq("UserId",userId).gt('deadlineGoal',Time.getTodayDateOnly())
		return data.body.length !== 0
	}

    static async updateGoalId(goalId,userId){
        return await supabase.from('Users')
            .update({
                goalId
            })
            .eq('id',userId)
    }

    static getDeadlineGoal(){
		const {celebrationDate,kickoffDate} = LocalData.getData()
		const todayDate = Time.getTodayDateOnly()
		const result = {
			dayLeft:null,
			description:'',
			deadlineDate:null
		}
		
		if (PartyController.isLastWeekCohort() || Time.isCooldownPeriod() ) {
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

module.exports = GoalController
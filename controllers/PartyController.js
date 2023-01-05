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
class PartyController{

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

	static async generateWaitingRoomPartyMode(client){
		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getNextDate(-6,kickoffDate)
		ruleFirstDayCooldown.setHours(Time.minus7Hours(8))
		ruleFirstDayCooldown.setMinutes(30)
		schedule.scheduleJob(ruleFirstDayCooldown,async function(){
			const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
			const [usersJoinedParty,totalUserHaveNotSetGoal] = await Promise.all([PartyController.getUsersJoinedParty(),await PartyController.getTotalUserHaveNotSetGoal()])
			
			const data = LocalData.getData()
			if(data.msgIdContentWaitingRoom){
				ChannelController.getMessage(channelParty,data.msgIdContentWaitingRoom)
					.then(msg=>msg.delete())
			}
			
			const msgContentWaitingRoom = await channelParty.send(PartyMessage.contentWaitingRoom(totalUserHaveNotSetGoal,PartyController.formatUsersJoinedParty(usersJoinedParty)))
			const msgCountdownWaitingRoom = await channelParty.send(PartyMessage.embedMessageWaitingRoom(PartyController.getFormattedTimeLeftUntilKickoff()))

			PartyController.countdownWaitingRoom(msgCountdownWaitingRoom)
			data.msgIdContentWaitingRoom = msgContentWaitingRoom.id
			data.msgIdCountdownWaitingRoom = msgCountdownWaitingRoom.id
			LocalData.writeData(data)
		})
	}

	static isRangePartyMode(){
		const kickoffDate = Time.getDate(LocalData.getData().kickoffDate)
		kickoffDate.setHours(20)
		kickoffDate.setMinutes(0)
		const diffTime = Time.getDiffTime(Time.getDate(),kickoffDate)

		return diffTime >= 0 && diffTime <= (60 * 24 * 7)
	}

	static getFormattedTimeLeftUntilKickoff(){
		const kickoffDate = Time.getNextDate(-1,LocalData.getData().kickoffDate)
		kickoffDate.setHours(20)
		kickoffDate.setMinutes(0)
		const diffTime = Time.getDiffTime(Time.getDate(),kickoffDate)
		return Time.convertTime(diffTime,'short')
	}

	static async updateMessageWaitingRoom(client){
		const data = LocalData.getData()
		const channelPartyMode = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
		
		if(data.msgIdCountdownWaitingRoom && PartyController.isRangePartyMode()){
			const [usersJoinedParty,totalUserHaveNotSetGoal] = await Promise.all([PartyController.getUsersJoinedParty(),await PartyController.getTotalUserHaveNotSetGoal()])
			const msgContentWaitingRoom = await ChannelController.getMessage(channelPartyMode,data.msgIdContentWaitingRoom)
			msgContentWaitingRoom.edit(PartyMessage.contentWaitingRoom(totalUserHaveNotSetGoal,PartyController.formatUsersJoinedParty(usersJoinedParty)))

			const msgCountdownWaitingRoom = await ChannelController.getMessage(channelPartyMode,data.msgIdCountdownWaitingRoom)
			PartyController.countdownWaitingRoom(msgCountdownWaitingRoom)
		}
	}

	static countdownWaitingRoom(msg){
		msg.edit(PartyMessage.embedMessageWaitingRoom(PartyController.getFormattedTimeLeftUntilKickoff()))
		const isStartUpdateHourly = PartyController.getFormattedTimeLeftUntilKickoff().includes('d')
		const countdownWaitingRoomHourly = setInterval(() => {
			if(!PartyController.getFormattedTimeLeftUntilKickoff().includes('d')){
				clearInterval(countdownWaitingRoomHourly)
				const countdownWaitingRoomMinutely = setInterval(() => {
					if(PartyController.getFormattedTimeLeftUntilKickoff().includes('-')){
						clearInterval(countdownWaitingRoomMinutely)
						msg.edit(PartyMessage.embedMessageWaitingRoom('0 m'))
					}else{
						msg.edit(PartyMessage.embedMessageWaitingRoom(PartyController.getFormattedTimeLeftUntilKickoff()))
					}
				}, 1000 * 60);
			}else{
				msg.edit(PartyMessage.embedMessageWaitingRoom(PartyController.getFormattedTimeLeftUntilKickoff()))
			}
		}, 1000 * 60 * (isStartUpdateHourly ? 60 : 1));
	}

	static sendReminderSetHighlightAfterJoinParty(client,members){
		setTimeout(() => {
			members.forEach(async member=>{
				const notificationThread = await ChannelController.getNotificationThread(client,member.UserId)
				notificationThread.send(PartyMessage.reminderSetHighlightAfterJoinParty(member.UserId))
			})
		}, 1000 * 60 * 15);
	}

	static async createPartyRoom(channelParty,members,partyId){
		const totalMemberParty = members.length
		const isFullParty = totalMemberParty === 4
		const msgPartyRoom = await channelParty.send(PartyMessage.partyRoom(
			partyId,
			PartyController.formatMembersPartyRoom(members),
			totalMemberParty,
			members[0].UserId,
			isFullParty
		))

		return msgPartyRoom
	}

	static saveMessagePartyRoomId(msgId,partyId){
		supabase.from("PartyRooms").update({msgId}).eq('id',partyId).then()
	}

	static async getListMemberNotResponseScheduleMeetup(dataMembersParty,partyId){
		const queryOr = dataMembersParty.body.map(member=>`UserId.eq.${member.UserId}`)
		const dataWeeklyMeetup = await supabase.from("WeeklyMeetups")
			.select("UserId")
			.or(queryOr.join(','))
			.eq('PartyRoomId',partyId)

		const memberList = {}
		dataMembersParty.body.forEach(member=>memberList[member.UserId]=false)
		dataWeeklyMeetup.body.forEach(member=>memberList[member.UserId]=true)
		const tagMembers = []
		for (const userId in memberList) {
			if(!memberList[userId]) tagMembers.push(MessageFormatting.tagUser(userId))
		}
		return tagMembers
	}

	static async setReminderScheduleMeetup(client){
		const data = await supabase.from("Reminders")
			.select()
			.eq('type',"reminderScheduleMeetup")
			.gte('time',new Date().toISOString())
		if(data.body.length === 0 ) return

		for (let i = 0; i < data.body.length; i++) {
			const {time,message:partyId} = data.body[i];
			PartyController.remindUserToResponseScheduleMeetup(client,time,partyId)
		}
	}

	static async remindUserToResponseScheduleMeetup(client,time,partyId){
		const channelPartyRoom = ChannelController.getChannel(client,CHANNEL_PARTY_ROOM)
		schedule.scheduleJob(time,async function() {
			const dataWeeklyMeetup = await RecurringMeetupController.getWeeklyMeetupParty(partyId)
			const dataParty = await supabase.from("PartyRooms")
						.select('msgId,meetupMessageId')
						.eq('id',partyId)
						.single()
			const thread = await ChannelController.getThread(channelPartyRoom,dataParty.body?.msgId)
			
			if (!dataWeeklyMeetup.body) {
				const dataMembersParty = await supabase.from("MemberPartyRooms")
					.select("UserId")
					.eq('partyId',partyId)

				if(dataMembersParty.body.length > 0){
					const time = new Date()
					time.setDate(time.getDate()+1)
					await supabase.from("Reminders")
						.insert({
							time,
							message:partyId,
							type:'autoRescheduleMeetup'
						})
					PartyController.autoRescheduleMeetup(client,time,partyId)

					const tagMembers = await PartyController.getListMemberNotResponseScheduleMeetup(dataMembersParty,partyId)

					const msgMeetup = await ChannelController.getMessage(thread,dataParty.body?.meetupMessageId)
					msgMeetup.reply(RecurringMeetupMessage.remindSomeoneToAcceptMeetup(tagMembers.join(' ')))
				}

			}
		})	
	}


	static async setReminderAutoRescheduleMeetup(client){
		const data = await supabase.from("Reminders")
			.select()
			.eq('type',"autoRescheduleMeetup")
			.gte('time',new Date().toISOString())
		
		if(data.body.length === 0 ) return
		for (let i = 0; i < data.body.length; i++) {
			const {time,message:partyId} = data.body[i];
			PartyController.autoRescheduleMeetup(client,time,partyId)
		}
	}

	static async autoRescheduleMeetup(client,time,partyId){
		schedule.scheduleJob(time,async function() {
			const dataParty = await supabase.from("PartyRooms")
						.select('msgId,meetupMessageId')
						.eq('id',partyId)
						.single()
			const dataWeeklyMeetup = await RecurringMeetupController.getWeeklyMeetupParty(partyId)
			const meetupDate = new Date(time)
			meetupDate.setDate(meetupDate.getDate()+6)

			if (!dataWeeklyMeetup.body) {
				RecurringMeetupController.rescheduleMeetup(client,dataParty.body?.msgId,meetupDate,partyId)
			}
		})
	}

	static async generatePartyRoom(client,cohort){
		const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_ROOM)
		const formattedDate = Time.getFormattedDate(Time.getNextDate(7),true)
		const meetupDate = Time.getDateOnly(Time.getNextDate(7))
		const data = await supabase.from("PartyRooms")
			.select("*,MemberPartyRooms(Users(goalId),UserId,project,isLeader,isTrialMember)")
			.eq('cohort',cohort)
		
		for (let i = 0; i < data.body.length; i++) {
			const party = data.body[i]
			const members = PartyController.sortMemberByLeader(party.MemberPartyRooms)
			
			const msgPartyRoom = await PartyController.createPartyRoom(channelParty,members,party.id)
			PartyController.saveMessagePartyRoomId(msgPartyRoom.id,party.id)

			const thread = await ChannelController.createThread(msgPartyRoom,`Party ${party.id}`)
			thread.send(PartyMessage.shareLinkPartyRoom(msgPartyRoom.id))
			for (let i = 0; i < members.length; i++) {
				const member = members[i];
				const goalId = member.Users.goalId
				for (let j = 0; j < members.length; j++) {
					const userId = members[j].UserId;
					if(member.UserId === userId) continue
					ChannelController.addUserToThread(client,CHANNEL_GOALS,goalId,userId)
				}
				await thread.send(PartyMessage.userJoinedParty(member.UserId))	
			}
			
			setTimeout(async () => {
				await thread.send(PartyMessage.welcomingPartyRoom(party.id))
				thread.send('————————')
			}, 1000 * 60 * 5);

			setTimeout(async () => {
				const time = new Date()
				time.setDate(time.getDate() + 1)
				await supabase.from("Reminders")
					.insert({
						time,
						message:party.id,
						type:'reminderScheduleMeetup'
					})
				PartyController.remindUserToResponseScheduleMeetup(client,time,party.id)

				const msgPartyRoom = await thread.send(RecurringMeetupMessage.askToScheduleRecurringMeetup(formattedDate,meetupDate,party.id))
				
				supabase.from("PartyRooms")
					.update({meetupMessageId:msgPartyRoom.id})
					.eq('id',party.id)
					.then()
			}, 1000 * 60 * 10);

			PartyController.sendReminderSetHighlightAfterJoinParty(client,members)

		}
	}

	static async followGoalAccountabilityPartner(client,partyId,userId,msgGoalId){
		const {body:members} = await supabase.from("MemberPartyRooms")
			.select("UserId,Users(goalId)")
			.eq('partyId',partyId)
			.neq('UserId',userId)
		for (let i = 0; i < members.length; i++) {
			const member = members[i];
			const goalId = member.Users.goalId
			ChannelController.addUserToThread(client,CHANNEL_GOALS,goalId,userId)
			ChannelController.addUserToThread(client,CHANNEL_GOALS,msgGoalId,member.UserId)
		}

	}

	static async unfollowGoalAccountabilityPartner(client,partyId,userId,msgGoalId){
		if(!msgGoalId){
			const dataUser = await supabase.from("Users")
				.select('goalId')
				.eq('id',userId)
				.single()
			msgGoalId = dataUser.body.goalId
		}
		const {body:members} = await supabase.from("MemberPartyRooms")
			.select("UserId,Users(goalId)")
			.eq('partyId',partyId)
			.neq('UserId',userId)
		for (let i = 0; i < members.length; i++) {
			const member = members[i];
			const goalId = member.Users.goalId
			ChannelController.removeUserFromThread(client,CHANNEL_GOALS,goalId,userId)
			ChannelController.removeUserFromThread(client,CHANNEL_GOALS,msgGoalId,member.UserId)
		}

	}

	static async removeWaitingRoom(client){
		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getDate(kickoffDate)
		ruleFirstDayCooldown.setHours(Time.minus7Hours(21))
		ruleFirstDayCooldown.setMinutes(0)
		schedule.scheduleJob(ruleFirstDayCooldown,async function(){
			const {msgIdContentWaitingRoom,msgIdCountdownWaitingRoom} = LocalData.getData()
			const channelPartyMode = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
			const msgContent = await ChannelController.getMessage(channelPartyMode,msgIdContentWaitingRoom)
			msgContent.edit(`**Find accountability partner by joining available party room** → ${MessageFormatting.tagChannel(CHANNEL_PARTY_ROOM)}`)
			ChannelController.getMessage(channelPartyMode,msgIdCountdownWaitingRoom)
				.then(msg=>{
					msg.delete()
				})
		})
	}

	static async announcePartyModeAvailable(client){
		const channelGeneral = ChannelController.getChannel(client,CHANNEL_GENERAL)

		const {kickoffDate} = LocalData.getData()
		const ruleFirstDayCooldown = Time.getNextDate(-6,kickoffDate)
		ruleFirstDayCooldown.setHours(Time.minus7Hours(20))
		ruleFirstDayCooldown.setMinutes(25)
		schedule.scheduleJob(ruleFirstDayCooldown,async function(){
			channelGeneral.send(PartyMessage.announceOpenPartyMode(Time.getFormattedDate(Time.getDate(kickoffDate),true)))
		})
		const ruleLastDayCooldown = Time.getNextDate(-2,kickoffDate)
		ruleLastDayCooldown.setHours(Time.minus7Hours(20))
		ruleLastDayCooldown.setMinutes(25)
		schedule.scheduleJob(ruleLastDayCooldown,async function(){
			channelGeneral.send(PartyMessage.reminderOpenPartyMode())
		})
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

	static async addMemberPartyRoom(client,goalId,partyId,UserId){
		const channelGoals = ChannelController.getChannel(client,CHANNEL_GOALS)
		const thread = await ChannelController.getThread(channelGoals,goalId)
		let project = thread.name.split('by')[0]
		const endPartyDate = LocalData.getData().deadlineGoal
		return await supabase.from("MemberPartyRooms").insert({project,partyId,endPartyDate,UserId})
	}

	static async updateMessagePartyRoom(client,msgId,partyNumber){
		const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_ROOM)
		const msgParty = await ChannelController.getMessage(channelParty,msgId)
		supabase.from("PartyRooms")
		.select("*,MemberPartyRooms(UserId,project,isLeader,isTrialMember)")
		.eq('id',partyNumber)
		.single()
		.then(async data=>{
			const members = PartyController.sortMemberByLeader(data?.body?.MemberPartyRooms)
			const totalMember = members.length
			const isFullParty = totalMember === 4
			msgParty.edit(PartyMessage.partyRoom(
				partyNumber,
				PartyController.formatMembersPartyRoom(members),
				totalMember,
				members?.[0]?.UserId,
				isFullParty
			))
		})

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

	//TODO make it efficient
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

	static formatMembersPartyRoom(members=[]){
		let result = ''
		for (let i = 0; i < 4; i++) {
			const member = members[i];
			if (member) {
				result += `**${MessageFormatting.tagUser(member.UserId)} ${member.isLeader ? "👑":""} — ${member.project}**\n`
			}else{
				result += `*EMPTY SLOT*\n`
			}

		}
		return result
	}

	static async disbandParty(client){
		const channelPartyRoom = ChannelController.getChannel(client,CHANNEL_PARTY_ROOM)

		const {celebrationDate} = LocalData.getData()
		const disbandPartyDate = Time.getDate(celebrationDate)
		disbandPartyDate.setHours(22)
		disbandPartyDate.setMinutes(0)

		const twoDaysBeforeDisbandParty = Time.getDate(disbandPartyDate.valueOf())
		twoDaysBeforeDisbandParty.setDate(twoDaysBeforeDisbandParty.getDate()-2)

		const oneDayBeforeDisbandParty = Time.getDate(disbandPartyDate.valueOf())
		oneDayBeforeDisbandParty.setDate(oneDayBeforeDisbandParty.getDate()-1)

		const disbandPartyIn30Minutes = Time.getDate(disbandPartyDate.valueOf())
		disbandPartyIn30Minutes.setMinutes(disbandPartyIn30Minutes.getMinutes()-30)

		const disbandPartyIn5Minutes = Time.getDate(disbandPartyDate.valueOf())
		disbandPartyIn5Minutes.setMinutes(disbandPartyIn5Minutes.getMinutes()-5)
		
		const dataParty = await supabase.from("PartyRooms")
		.select()
		.gte('disbandDate',Time.getTodayDateOnly())

		const partyRooms = []
		for (let i = 0; i < dataParty.body.length; i++) {
			const party = dataParty.body[i];
			const partyRoom = {}
			partyRoom.msg = await ChannelController.getMessage(channelPartyRoom,party.msgId)
			partyRoom.thread = await ChannelController.getThread(channelPartyRoom,party.msgId)
			partyRooms.push(partyRoom)
		}

		if (dataParty.body.length > 0) {
			schedule.scheduleJob(twoDaysBeforeDisbandParty,async ()=>{
				for (let i = 0; i < partyRooms.length; i++) {
					const party = partyRooms[i];
					party.thread.send(PartyMessage.remindPartyWillEnded2Days())
				}
			})
			schedule.scheduleJob(oneDayBeforeDisbandParty,async ()=>{
				for (let i = 0; i < partyRooms.length; i++) {
					const party = partyRooms[i];
					party.thread.send(PartyMessage.remindPartyWillEndedToday())
				}
			})
			schedule.scheduleJob(disbandPartyIn30Minutes,async ()=>{
				for (let i = 0; i < partyRooms.length; i++) {
					const party = partyRooms[i];
					party.thread.send(PartyMessage.remindPartyWillEnded30Minutes())
				}
			})
			schedule.scheduleJob(disbandPartyIn5Minutes,async ()=>{
				for (let i = 0; i < partyRooms.length; i++) {
					const party = partyRooms[i];
					party.thread.send(PartyMessage.remindPartyWillEnded5Minutes())
				}
			})
			schedule.scheduleJob(disbandPartyDate,async ()=>{
				for (let i = 0; i < partyRooms.length; i++) {
					const party = partyRooms[i];
					party.thread.send(PartyMessage.remindPartyWillEndedNow())
					setTimeout(() => {
						party.thread.delete()
						party.msg.delete()
					}, 1000 * 15);
				}
			})
		}
	}

	static async getMessageWaitingRoom(client){
		const channelParty = ChannelController.getChannel(client,CHANNEL_PARTY_MODE)
		const msg = await ChannelController.getMessage(channelParty,LocalData.getData().msgIdContentWaitingRoom)
		return msg
	}

	static formatUsersJoinedParty(users){
		let result = ''
		for (let i = 0; i < users.length; i++) {
			const user = users[i];
			result += `${user.alreadySetGoal ? "✅" : "⏳"} ${MessageFormatting.tagUser(user.UserId)}`
			if(i !== users.length - 1) result += '\n'
		}
		return result
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

	static getTimeShareProgress(shareProgressAt){
		return shareProgressAt.split(" ")[0]
	}

	static async getUsersJoinedParty(){
		const data = await supabase.from("JoinParties")
			.select()
			.eq('cohort',this.getNextCohort())
			.order('createdAt',{ascending:false})
		return data.body
	}

	static sortMemberByLeader(members){
		members.sort(member=> {
			return member.isLeader ? -1 : 1 
		})
		return members
	}

	static async checkSlotParty(client,userId,partyNumber){
		const dataParty = await supabase.from("PartyRooms")
		.select("*,MemberPartyRooms(UserId,project,isLeader,isTrialMember)")
		.eq('id',partyNumber)
		.single()
		const members = dataParty.body?.MemberPartyRooms
		const totalMember = members.length
		const result = {
			isFull:false,
			forMember:null
		}
		if (totalMember === 4) {
			result.isFull = true
			result.forMember = "existing"
		}

		return result
	}

	static async dataJoinedParty(userId){
		const dataJoinedParty = await supabase.from("MemberPartyRooms")
			.select('PartyRooms(msgId),Users(notificationId)')
			.eq("UserId",userId)
			.gte("endPartyDate",Time.getTodayDateOnly())
			.single()
		return dataJoinedParty.body
	}

	static async deleteUserFromParty(userId,partyNumber){
		return await supabase.from("MemberPartyRooms")
			.delete()		
			.eq("UserId",userId)
			.eq('partyId',partyNumber)
	}

	static async getRecentActiveUserInParty(members,userId){
		const filteredMembers = members.filter(member=>member.UserId != userId)
		const queryOr = filteredMembers.map(member=>`UserId.eq.${member.UserId}`)
		const dataRecentUser = await supabase.from('Points')
			.select()
			.or(queryOr.join(','))
			.neq('UserId',userId)
			.limit(1)
			.order('updatedAt',{ascending:false})
			.single()
		return dataRecentUser
	}

	static async getTotalUserHaveNotSetGoal(){
        const {count} = await supabase
			.from('JoinParties')
			.select('id', { count: 'exact' })
			.eq('cohort',this.getNextCohort())
			.eq('alreadySetGoal',false)

        return count
	}

	static getNextCohort(){
		return LocalData.getData().cohort + 1
	}

	static isPartyMode(value){
		const accountabilityMode = value.split('-')[0]
		return accountabilityMode === 'party'
	}

	static async isMemberParty(userId,partyNumber){
		const data = await supabase.from("MemberPartyRooms")
			.select()
			.eq('UserId',userId)
			.eq('partyId',partyNumber)
			.single()
		return !!data.body
	}

	static async saveDataJoinPartyToMemberPartyRoom(){
		const data = await supabase.from("JoinParties")
		.select("id,UserId,project")
		.eq('cohort',PartyController.getNextCohort())

		if(data.body){
			const endPartyDate = LocalData.getData().deadlineGoal
			const memberPartyRooms = data.body.map(({id,UserId,project})=>{
				return {
					UserId,
					project,
					endPartyDate,
					JoinPartyId:id,
				}
			})
			await supabase.from("MemberPartyRooms")
				.insert(memberPartyRooms)
		}
	}

	static async partyReminder(client){
        let ruleReminderSkipTwoDays = new schedule.RecurrenceRule();
		ruleReminderSkipTwoDays.hour = Time.minus7Hours(21)
		ruleReminderSkipTwoDays.minute = 0

		schedule.scheduleJob(ruleReminderSkipTwoDays,function(){
			if (!Time.isCooldownPeriod()) {
				supabase.from("Users")
					.select('id,name')
					.eq('lastDone',Time.getDateOnly(Time.getNextDate(-3)))
					.then(dataUsers =>{
						if (dataUsers.body) {
							dataUsers.body.forEach(async user=>{
								const data = await supabase.from("MemberPartyRooms")
									.select("PartyRooms(MemberPartyRooms(UserId),msgId)")
									.eq("UserId",user.id)
									.gte('endPartyDate',Time.getTodayDateOnly())
									.single()
								if(data.body){
									const dataActiveUser = await PartyController.getRecentActiveUserInParty(data.body.PartyRooms.MemberPartyRooms,user.id)
									const channelPartyRoom = ChannelController.getChannel(client,CHANNEL_PARTY_ROOM)
									const threadParty = await ChannelController.getThread(channelPartyRoom,data.body.PartyRooms.msgId)
									threadParty.send(PartyMessage.partyReminder(user.id,dataActiveUser.body.UserId))
								}
							})
						}
					})
			}
		})
	}

	static async handleOutsideMemberChatInPartyRoom(msg){
		const [label,partyNumber] = msg.channel.name.split(' ')
		if(label === "Party"){
			const isMemberParty = await PartyController.isMemberParty(msg.author.id,partyNumber)
			if (!isMemberParty) {
				msg.delete()
				msg.channel.members.remove(msg.author.id)
				const notificationThread = await ChannelController.getNotificationThread(msg.client,msg.author.id)
				notificationThread.send(PartyMessage.replyOutsiderMemberCannotChat())
			}
		}
	}

	static async handleMentionOutsideMemberInPartyRoom(msg){
		const [label,partyNumber] = msg.channel.name.split(' ')
		if(label === "Party" && msg.mentions.users.size > 0){
			let isDeleteMessage = false
			for (const [userId,user] of msg.mentions.users) {
				if(user.bot) continue
				const isMemberParty = await PartyController.isMemberParty(userId,partyNumber)
				if (!isMemberParty) {
					isDeleteMessage = true
					msg.channel.members.remove(userId)
					break
				}
			}
			if(isDeleteMessage){
				msg.delete()
				msg.channel.send(PartyMessage.replyCannotMentionNotPartyMember())
			}
		}
	}
}

module.exports = PartyController
const DailyStreakController = require("../controllers/DailyStreakController");
const RequestAxios = require("../helpers/axios");
const { CHANNEL_REMINDER , CHANNEL_HIGHLIGHT, CHANNEL_TODO,CHANNEL_STREAK,GUILD_ID,CHANNEL_GOALS, CHANNEL_TOPICS, CHANNEL_REFLECTION, CHANNEL_CELEBRATE, CHANNEL_PAYMENT, MY_ID, CHANNEL_INTRO, CHANNEL_SESSION_GOAL, CHANNEL_CLOSA_CAFE} = require("../helpers/config");
const supabase = require("../helpers/supabaseClient");
const Time = require("../helpers/time");
const DailyStreakMessage = require("../views/DailyStreakMessage");
const schedule = require('node-schedule');
const FormatString = require("../helpers/formatString");
const Email = require("../helpers/Email");
const GenerateImage = require("../helpers/GenerateImage");
const { MessageAttachment } = require("discord.js");
const InfoUser = require("../helpers/InfoUser");
const ChannelController = require("../controllers/ChannelController");
const FocusSessionMessage = require("../views/FocusSessionMessage");
const HighlightReminderMessage = require("../views/HighlightReminderMessage");
const PointController = require("../controllers/PointController");

module.exports = {
	name: 'messageCreate',
	async execute(msg) {
		if(msg.author.bot) return

		PointController.addPoint(msg.author.id,'chat')

		if (msg.type !== "DEFAULT") return
		supabase.from("Users")
			.update({
				last_active:Time.getTodayDateOnly()
			})
			.eq('id',msg.author.id)
			.then()

		const ChannelReminder = msg.guild.channels.cache.get(CHANNEL_REMINDER)
		const ChannelStreak = msg.guild.channels.cache.get(CHANNEL_STREAK)
		switch (msg.channelId) {
			case CHANNEL_GOALS:
				if (msg.content.includes("Success Criteria")) {
					const threadName = `${msg.content.split('\n')[0]}`
					
					const thread = ChannelController.createThread(
						msg,
						threadName,
						msg.author.username
					)
					supabase.from('Users')
						.update({
							goal_id:thread.id
						})
						.eq('id',msg.author.id)
						.then()
				}
				break;
			case CHANNEL_SESSION_GOAL:
				const thread = await ChannelController.createThread(msg,`focus log - ${msg.content}`)

				thread.send(FocusSessionMessage.startFocusSession(msg.author))

				supabase.from('FocusSessions')
				.select()
				.eq('UserId',msg.author.id)
				.is('session',null)
				.single() 
				.then(({data})=>{
					if (data) {
						supabase.from('FocusSessions')
							.delete()
							.eq('id',data.id)
							.then()
					}
					supabase.from('FocusSessions')
						.insert({
							UserId:msg.author.id,
							thread_id:thread.id,
							task_name: msg.content
						})
						.then()
				})
				
				break;
			case CHANNEL_HIGHLIGHT:
				const patternEmoji = /^🔆/
				if (patternEmoji.test(msg.content.trimStart())) {
                    
					if (Time.haveTime(msg.content)) {
						const time = Time.getTimeFromText(msg.content)
                        const [hours,minutes] = time.split(/[.:]/)
						const date = new Date()
						date.setHours(Time.minus7Hours(hours))
						date.setMinutes(minutes-10)
						supabase.from('Reminders')
							.insert({
								message:msg.content,
								time:date,
								UserId:msg.author.id,
							})
							.then()
						RequestAxios.post('highlights', {
							description: msg.content,
							UserId: msg.author.id
						})
						.then(()=>{
							
							supabase.from('Users')
								.update({last_highlight:Time.getTodayDateOnly()})
								.eq('id',msg.author.id)
								.then()
							const reminderHighlight = schedule.scheduleJob(date,function () {
								ChannelReminder.send(HighlightReminderMessage.remindHighlightUser(msg.author,msg.content))
							})
						})
					}else{
						msg.delete()
						ChannelReminder.send(HighlightReminderMessage.wrongFormat(msg.author))
					}
				}
				
					
				break;
			case CHANNEL_TODO:
				if(msg.content.length < 50){
					msg.delete()
					ChannelReminder.send(`Hi ${msg.author} please **write a longer story**  in <#${CHANNEL_TODO}> to provide more context to your partners.

so, you can learn or sharing from each others.`)
					return
				}
				let titleProgress = `${msg.content.trimStart().split('\n')[0]}`
				if(FormatString.notCharacter(titleProgress[0])) titleProgress = titleProgress.slice(1).trimStart()

				ChannelController.createThread(msg,titleProgress)
				
				const { data, error } = await supabase
											.from('Users')
											.select()
											.eq('id',msg.author.id)
											.single()
				
				const attachments = []
				let files = []

				msg.attachments.each(data=>{
					files.push({
						attachment:data.attachment
					})
					attachments.push(data.attachment)
				})

				let goalName = ''
				if (data.goal_id) {
					const channel = msg.client.guilds.cache.get(GUILD_ID).channels.cache.get(CHANNEL_GOALS)
					const thread = await channel.threads.fetch(data.goal_id);
					goalName = thread.name.split('by')[0]
					thread.send({
						content:msg.content,
						files
					})
					
				}
				
				RequestAxios.get(`todos/${msg.author.id}`)
				.then((data) => {
					if (data.length > 0) {
						RequestAxios.post('todos', {
							attachments,
							description:msg.content,
							UserId:msg.author.id
						})
						throw new Error("Tidak perlu kirim daily streak ke channel")
					} else {
						RequestAxios.post('todos', {
							attachments,
							description:msg.content,
							UserId:msg.author.id
						})
							
						return supabase.from("Users")
							.select()
							.eq('id',msg.author.id)
							.single()
					}
				})
				.then(async data=>{
					let current_streak = data.body.current_streak + 1
					
					if (Time.isValidStreak(data.body.last_done,current_streak)) {
						if (Time.onlyMissOneDay(data.body.last_done)) {
							const missedDate = Time.getNextDate(-1)
							missedDate.setHours(8)
							await supabase.from("Todos")
									.insert({
										createdAt:missedDate,
										updatedAt:missedDate,
										UserId:msg.author.id,
										type:'safety'
									})
						}
						if (current_streak > data.body.longest_streak) {
							return supabase.from("Users")
							.update({
								current_streak,
								'longest_streak':current_streak,
								'end_longest_streak':Time.getTodayDateOnly()
							})
							.eq('id',msg.author.id)
							.single()
						}else{
							return supabase.from("Users")
							.update({current_streak})
							.eq('id',msg.author.id)
							.single()
						}
					}else{
						return supabase.from("Users")
							.update({'current_streak':1})
							.eq('id',msg.author.id)
							.single()
					}
				})
				.then(data => {
					supabase.from('Users')
						.update({last_done:Time.getTodayDateOnly()})
						.eq('id',msg.author.id)
						.then()
					let dailyStreak = data.body.current_streak
					let longestStreak = data.body.longest_streak
					
					DailyStreakController.achieveDailyStreak(msg.client,ChannelStreak,dailyStreak,longestStreak,msg.author)
					if (goalName) {
						RequestAxios.get('todos/tracker/'+msg.author.id)
							.then(async progressRecently=>{
								progressRecently.map(todo=>{
									todo.date = new Date(todo.createdAt).getDate()
								})
								
								const avatarUrl = InfoUser.getAvatar(msg.author)
								const buffer = await GenerateImage.tracker(msg.author.username,goalName,avatarUrl,progressRecently,longestStreak)
								

								const attachment = new MessageAttachment(buffer,`progress_tracker_${msg.author.username}.png`)
								ChannelStreak.send({
									embeds:[DailyStreakMessage.dailyStreak(dailyStreak,msg.author,longestStreak)],content:`${msg.author}`,
									files:[
										attachment
									]
								})
							})
					}else{
						ChannelStreak.send({
							embeds:[DailyStreakMessage.dailyStreak(dailyStreak,msg.author,longestStreak)],content:`${msg.author}`
						})
					}
					
				})
				
				.catch(err => {
					console.log(err)
				})
						
				break;
			case CHANNEL_REFLECTION:
				ChannelController.createThread(msg,`Reflection by ${msg.author.username}`)
				break;
			case CHANNEL_TOPICS:
				ChannelController.createThread(msg,`${msg.content.split('\n')[0]}`)	
				break;
			case CHANNEL_CELEBRATE:
				if (msg.attachments.size > 0 || msg.content.includes('http')) {
					ChannelController.createThread(msg,`${msg.content.split('\n')[0]}`)
				}	
				break;
			case CHANNEL_INTRO:
				ChannelController.createThread(msg,`Welcome ${msg.author.username}`)
				break;
			case CHANNEL_PAYMENT:
				if (msg.content[0] === 'v') {
					const msgReferrence = await msg.client.guilds.cache.get(GUILD_ID).channels.cache.get("953575264208695327").messages.fetch(msg.reference.messageId)
					const paymentType = msgReferrence.embeds[0].title
					const UserId = msg.mentions.users.first().id
					const user = msg.mentions.users.first()

					if (msgReferrence.embeds.length>0 ) {
						
						
						const idPayment = msgReferrence.embeds[0].footer.text
			
						const {data} = await supabase.from('Payments')
						.select()
						.eq('id',idPayment)
						.single()
						
						const [total,type] = data.membership.split(' ')

						supabase.from("Payments")
						.update({UserId})
						.eq('id',idPayment)
						.then(data=>{
							if (data?.body) {
								 msg.react('✅')	
							}
						})

						if (paymentType === "Renewal") {
							const email = msgReferrence.embeds[0].fields[0].value
							supabase.from('Users')
								.select('end_membership')
								.eq('id',UserId)
								.single()
								.then(data =>{
									supabase.from('Users')
										.update({'end_membership':Time.getEndMembership(type,total,data.body.end_membership)})
										.eq('id',UserId)
										.single()
										.then(data=>{
                                        	const date = Time.getFormattedDate(Time.getDate(data.body.end_membership))
											// Send Email Renewal
											Email.sendSuccessMembershipRenewal(data.body.name,data.body.email,date)
											user.send(`Hi <@${UserId}>, your membership status already extended until ${date}.
Thank you for your support to closa community!`)
											msg.reply(`${data.body.name} membership status already extended until ${date}`)
										})
								})
						}else if(paymentType === 'Payment'){
							const email = msgReferrence.embeds[0].fields[4].value
							const name = msgReferrence.embeds[0].fields[3].value

							
							supabase.from('Users')
								.update({"end_membership":Time.getEndMembership(type,total,data.createdAt),email,name})
								.eq('id',UserId)
								.single()
								.then(data=>{
									const date = Time.getFormattedDate(Time.getDate(data.body.end_membership))
									const startDate = Time.getFormattedDate(Time.getDate())
									user.send(`Hi <@${UserId}>, your membership status until ${date}.
Thank you for your support to closa community!`)
									Email.createContact('ataufiq655@gmail.com','ahtaufiiq')
										.catch(err=>{
										})
										.finally(()=>{
											Email.sendWelcomeToClosa(data.body.name,data.body.email,startDate)
										})
									msg.reply(`${data.body.name} membership status until ${date}`)
								})
						}
						
					}
						
				}
				break;
			default:
				if (Time.haveTime(msg.content)) {
					console.log('set reminder');
				}
				break;
				
		}
	},
};
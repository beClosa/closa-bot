const {Modal,TextInputComponent,showModal} = require('discord-modals'); // Define the discord-modals package!
const Time = require('../helpers/time');
const WeeklyReflectionMessage = require('../views/WeeklyReflectionMessage');
const schedule = require('node-schedule');
const supabase = require('../helpers/supabaseClient');
const ChannelController = require('./ChannelController');
const { CHANNEL_ANNOUNCEMENT } = require('../helpers/config');
const MessageFormatting = require('../helpers/MessageFormatting');
const LocalData = require('../helpers/LocalData');
class WeeklyReflectionController {
	static async sendReflectionEveryWeek(client){
		schedule.scheduleJob('30 19 * * 7', async function(){
			if(!Time.isCooldownPeriod()){
				const data = LocalData.getData()
				const channelAnnouncement = ChannelController.getChannel(client,CHANNEL_ANNOUNCEMENT)
				const msg = await channelAnnouncement.send(WeeklyReflectionMessage.announcement(WeeklyReflectionController.getTimeLeft()))
				data.msgIdWeeklyReflection = msg.id
				LocalData.writeData(data)
				WeeklyReflectionController.countdownWritingReflection(msg)
			}
		});
	}

	static async updateAnnouncementReflection(client){
		const date = Time.getDate()
		if(!Time.isCooldownPeriod && date.getDay() === 0 && date.getHours() >= 19){
			const {msgIdWeeklyReflection} = LocalData.getData()
			const channelAnnouncement = ChannelController.getChannel(client,CHANNEL_ANNOUNCEMENT)
			const msg = await ChannelController.getMessage(channelAnnouncement,msgIdWeeklyReflection)
			WeeklyReflectionController.countdownWritingReflection(msg)
		}
	}

    static showModalWriteReflection(interaction){
        if(interaction.customId.includes('writeReflection')){
			const modal = new Modal()
			.setCustomId(interaction.customId)
			.setTitle("Reflect on this week 📝")
			.addComponents(
				new TextInputComponent().setCustomId('highlight').setLabel("What went well?").setStyle("SHORT"),
				new TextInputComponent().setCustomId('lowlight').setLabel("What didn't go well?").setStyle("SHORT"),
				new TextInputComponent().setCustomId('actionPlan').setLabel("What the next action plan for improvements?").setStyle("SHORT"),
				new TextInputComponent().setCustomId('note').setLabel("Additional notes / Key learnings").setPlaceholder("Additional story, notes, or learnings").setStyle('LONG'),
			)
			showModal(modal, { client: interaction.client, interaction: interaction});
			return true
		}
        return false
    }
    static showModalEditReflection(interaction){
        if(interaction.customId.includes('editReflection')){
			const {highlight,lowlight,actionPlan,note} = WeeklyReflectionController.getDataReflectionFromMessage(interaction.message)
			const modal = new Modal()
			.setCustomId(interaction.customId)
			.setTitle("Reflect on this week 📝")
			.addComponents(
				new TextInputComponent().setCustomId('highlight').setLabel("What went well?").setStyle("SHORT").setDefaultValue(highlight || ''),
				new TextInputComponent().setCustomId('lowlight').setLabel("What didn't go well?").setStyle("SHORT").setDefaultValue(lowlight || ""),
				new TextInputComponent().setCustomId('actionPlan').setLabel("What the next action plan for improvements?").setStyle("SHORT").setDefaultValue(actionPlan || ""),
				new TextInputComponent().setCustomId('note').setLabel("Additional notes / Key learnings").setPlaceholder("Additional story, notes, or learnings").setStyle('LONG').setDefaultValue(note || ""),
			)
			showModal(modal, { client: interaction.client, interaction: interaction});
			return true
		}
        return false
    }

	static async addReflection({highlight,lowlight,actionPlan,note,UserId}){
		return await supabase.from("WeeklyReflections")
			.insert({highlight,lowlight,actionPlan,note,UserId,date:Time.getTodayDateOnly()})
	}

	static async getAllParticipant(){
		const data = await supabase.from("WeeklyReflections")
			.select()
			.eq('date',Time.getTodayDateOnly())

		return data.body
	}

	static getDataReflectionFromMessage(message){
		const data = {}
		message.embeds[0].fields.forEach(field => {
			const {name,value} = field
			if(name === "Went well?") data.highlight = value
			if(name === "Didn't go weel?") data.lowlight = value
			if(name === "Next action plan for improvements") data.actionPlan = value
			if(name === "Additional Notes / Key learnings") data.note = value
		});
		return data
	}

	static countdownWritingReflection(msg){
		const countdownReflection = setInterval(async () => {
			const dataParticipant = await WeeklyReflectionController.getAllParticipant()
			const participants = dataParticipant.map(participant=>MessageFormatting.tagUser(participant.UserId))
			if(WeeklyReflectionController.getTimeLeft().includes('-')){
				clearInterval(countdownReflection)
				msg.edit(WeeklyReflectionMessage.announcement('ended',participants))
			}else{
				msg.edit(WeeklyReflectionMessage.announcement(WeeklyReflectionController.getTimeLeft(),participants))
			}
		}, 1000 * 60);
	}

	static getTimeLeft(){
		const endDate = Time.getDate()
		endDate.setHours(22)
		endDate.setMinutes(30)
		const diffTime = Time.getDiffTime(Time.getDate(),endDate)
		return `${Time.convertTime(diffTime,'short')} left`
	}
}

module.exports = WeeklyReflectionController
const { EmbedBuilder, ButtonStyle } = require("discord.js")
const { CHANNEL_CLOSA_CAFE, GUILD_ID, CHANNEL_UPCOMING_SESSION, CHANNEL_SESSION_GOAL, CHANNEL_TODO } = require("../helpers/config")
const MessageComponent = require("../helpers/MessageComponent")
const MessageFormatting = require("../helpers/MessageFormatting")
const InfoUser = require("../helpers/InfoUser")
const UserController = require("../controllers/UserController")
const GenerateLink = require("../helpers/GenerateLink")
const Time = require("../helpers/time")

class CoworkingMessage {

    static initWelcomeMessage(){
        return {
            content:`**Host & schedule a coworking session 👨‍💻👩‍💻
or book available session here** → ${MessageFormatting.tagChannel(CHANNEL_UPCOMING_SESSION)}`,
            files:['./assets/images/banner_coworking_session.png'],
            components:[MessageComponent.createComponent(
                MessageComponent.addEmojiButton('scheduleCoworking','Schedule','🗓️'),
                // MessageComponent.addLinkButton('Learn more','')
            )]
        }
    }
    
    static coworkingEvent(eventId,eventName,author,totalSlot,totalAttendance,rule,totalMinute,coworkingDate,files,isLive=false,voiceRoomId){
        let footer = ''
        const session = Time.convertTime(totalMinute,'short')
        const startDate = new Date(coworkingDate.valueOf())
        startDate.setHours(Time.minus7Hours(startDate.getHours(),false)) 
        const endDate = new Date(startDate.valueOf())
        endDate.setMinutes(endDate.getMinutes()+totalMinute)
        const availableSlot = totalSlot - 1 //author
        const spotLeft = availableSlot - totalAttendance
        if(totalAttendance === 0){
            footer = ` · ${availableSlot} spots left `
        }else if(availableSlot === totalAttendance){
            if(totalAttendance === 1) footer = ` and other `
            else footer = ` and ${totalAttendance} others `
        }else{
            if(totalAttendance === 1) footer = ` and other · ${spotLeft} spot${spotLeft > 1 ? 's':''} left`
            else footer = ` and ${totalAttendance} others · ${spotLeft} spot${spotLeft > 1 ? 's':''} left`
        }
        const link = GenerateLink.addToCalendar(
			eventName,
			`1. Find your coworking room (click the location above).
2. Write a specific tasks on #session-goals 
3. Join you coworking room`,
			MessageFormatting.linkToMessage(CHANNEL_UPCOMING_SESSION,eventId),
			startDate,
			endDate
		  )
        const components = []
        if(!isLive){
            components.push(MessageComponent.createComponent(
                MessageComponent.addButton(`bookCoworking_${author.id}_${eventId}`,'Book'),
                MessageComponent.addLinkEmojiButton('Add to calendar',link,'🗓'),
                MessageComponent.addButton(`editCoworking_${author.id}_${eventId}`,'Edit',ButtonStyle.Secondary),
                MessageComponent.addButton(`cancelBookCoworking_${author.id}_${eventId}`,'Cancel',ButtonStyle.Secondary),
                // MessageComponent.addLinkButton('Learn more','')
            ))
        }
        const content = isLive ? `${MessageFormatting.tagUser(author.id)} just started ${eventName} — LIVE 🔴` :`${MessageFormatting.tagUser(author.id)} just scheduled a session`
        const titleEmbed = isLive ? `**Join** → ${MessageFormatting.tagChannel(voiceRoomId)}` : `${eventName} @ ${CoworkingMessage.formatCoworkingDate(coworkingDate)}`
        return {
            content,
            files,
            embeds:[
                new EmbedBuilder()
                .setColor("#FEFEFE")
                .setTitle(titleEmbed)
                .setDescription(`${session} session\n${rule}`)
                .setFooter({text:`${UserController.getNameFromUserDiscord(author)} ${footer}`, iconURL:InfoUser.getAvatar(author)})
            ],
            components
        }
    }

    static formatCoworkingDate(date){
        let [weekday,month,day] = date.toLocaleDateString("en-US", { weekday: 'short', day:'2-digit',month:'short',}).split(/[, ]+/)
        if(Time.getDateOnly(date) === Time.getTodayDateOnly()) weekday = 'Today'
        return `${weekday} · ${Time.getHoursFromDate(date)}.${Time.getMinutesFromDate(date)} WIB · ${day} ${month.toUpperCase()}`
    }

    static titleCoworkingNight(){
        return `Co-working Night 🧑‍💻👩‍💻☕️🌙 `
    }
    static titleCoworkingMorning(){
        return `Co-working Morning 🧑‍💻👩‍💻☕️🔆 `
    }
    static descriptionCoworkingNight(){
        return `🔔 **subscribe to** <#960785506566823946> to get co-working session notification.

**Agenda:**
• 5 minutes set session goal together
• 50 minutes co-working session
• 10 Minutes Break
• 50 minutes co-working session
• 5 minutes celebrate & show progress

**Rules:**
• Video on or Share Screen
• Sometimes we talk during the session, If you don't want to get interrupted turn on deafen mode.
`
    }
    static descriptionCoworkingMorning(){
        return `🔔 **subscribe to** <#960785506566823946> to get co-working session notification.

**Agenda:**
• 5 minutes set session goal together
• 50 minutes co-working session
• 10 Minutes Break
• 50 minutes co-working session
• 5 minutes celebrate & show progress

**Rules:**
• Video on or Share Screen
• Sometimes we talk during the session, If you don't want to get interuppted turn on deafen mode.
`
    }

    static notifCoworkingStarted(type,userId,eventId){
        
        return `co-working hour just started at ☕️ Closa café.
Let’s join the session. <@${userId}>

${MessageFormatting.linkToEvent(eventId)}`
    }

    static remind10MinutesBeforeStart(userId,eventId){
        
        return `10 min before co-working session <@${userId}>
Let's get ready & join <#${CHANNEL_CLOSA_CAFE}> 

${MessageFormatting.linkToEvent(eventId)}`
    }

    static remindFiveMinutesBeforeCoworking(userId,channelId,hostname){
        return `Hi ${MessageFormatting.tagUser(userId)}, in 5 minutes your session${hostname?` with ${hostname}`:''} is about to start.
Let's join → ${MessageFormatting.tagChannel(channelId)}

please be on time to get your seat!
the room will open for public when the session start & anyone can join.`
    }

    static howToStartSession(HostId,min=10){
        return {
            content:`:arrow_upper_right: **Start your session or Invite your friends** ${MessageFormatting.tagUser(HostId)}
${min > 0 ? `\n**⏳ ${min} min** remaining to start the session
or this room will auto-delete.\n`:''}
**How to start the session?👨‍💻👩‍💻 **
1. Write the task here → ${MessageFormatting.tagChannel(CHANNEL_SESSION_GOAL)}
2. Select your project inside the tasks thread.
3. __Turn on camera__\`\` OR \`\`__sharescreen__ to start session & track time.
4. Mute your mic (during focus session).

\`\`Troubleshoot\`\` 
*turn-off & turn-on your video __or__ sharescreen if the time tracker didn't start*`,
            components:[
                MessageComponent.createComponent(
                    MessageComponent.addEmojiButton('showGuidelineCoworking','Guideline','💡',ButtonStyle.Secondary)
                )
            ]
        }
    }

    static guidelineCoworking(){
        return `**HOW TO BE PRODUCTIVE**

**Prepare for your session.** 🔕
Remove any other sources of interruption: 
close your door, turn off notifications, etc.

**Kick off your session.** 🚀
\`\`1.\`\` Be friendly and greet your partner
\`\`2.\`\` Describe your specific task for 30s to your partner.
\`\`4.\`\` Post your plan in #session-goals (1 specific task/ session).
\`\`5.\`\` Start working by turn-on video.
(if the time tracker didn't start then turn-off then turn-on your video/sharescreen back)

**Get to work.** 👩‍💻🧑‍💻
\`\`1.\`\` Work quietly. You can listen to music but mute your audio first.
\`\`2.\`\` If you need a break: press break button & let others know in the voice chat.

**Wrap up.** 🙌
\`\`1.\`\` 5 mins before the session ends. Stop & share what you've done with your partner!
\`\`2.\`\` Celebrate & Share to ${MessageFormatting.tagChannel(CHANNEL_TODO)} of what you've done!

\`\`notes:\`\` 
\`\`\` 
• Talk only allowed in the beginning & end of the session.
• If you must step away, post on voice chat while keeping the camera open & back ASAP.
\`\`\``
    }

    static countdownCoworkingSession(HostId,rules,totalMin,currentMin,attendances){
        let contentGuests = ''
        const totalGuest = attendances.length
        if(totalGuest > 0){
            contentGuests = `\`guest${totalGuest>1?'s':''} :\` ${attendances.join(' ')}`
        }
        return `Session started

**${Time.convertTime(currentMin,'short')}** left
${CoworkingMessage.progressTimer(totalMin,currentMin)}

\`Agenda & Rules\`
${rules}

\`hosted by\` ${MessageFormatting.tagUser(HostId)}
${contentGuests}`
    }

    static progressTimer(totalMin,currentMin){
        const progress = currentMin / totalMin * 100
        const puluhan = Math.floor(progress/10)
        const satuan = progress % 10
        let isGreySquare = false
        let progressTimer = ''
        for (let i = 1; i <= 10; i++) {
            if(puluhan >= i) progressTimer += '🟩 '
            else if(isGreySquare) progressTimer += '⬜ '
            else{
                if(satuan >= 5) progressTimer += '🟨 '
                else progressTimer += '⬜ '
                isGreySquare = true
            }
        }
        return progressTimer
    }

    static remindSessionEnded(type){
        switch (type) {
            case 10:
                return `\`\`10 min\`\` before the session ended @everyone`
            case 5:
                return `\`\`5 min\`\` before the session ended, let's celebrate together! :tada: @everyone`
            case 2:
                return `\`\`2 min\`\` before the session ended & room auto-delete.
Feel free to take group photo before the session ended 📸
tag @joinclosa & your friends to celebrate together ✨`
            default:
                return `\`\`15s\`\` It's time say good bye to @everyone!👋`
        }
    }
}
module.exports = CoworkingMessage
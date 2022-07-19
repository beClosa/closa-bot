const { MessageEmbed } = require("discord.js")
const { CHANNEL_CLOSA_CAFE, CHANNEL_TODO } = require("../helpers/config")
const InfoUser = require("../helpers/InfoUser")
const Time = require("../helpers/time")

class FocusSessionMessage{

    //-----------------------    Daily Streak    -----------------------// 
    
    static report(user,data){
        
        const {daily,weekly,monthly,all,average,dailyStreak,longestStreak} = data
        const avatarUrl = InfoUser.getAvatar(user)
        return new MessageEmbed()
            .setColor('#FEFEFE')
            .addField(`Timeframe ${FocusSessionMessage.addSpace(5)} Hours`,`
Daily:${FocusSessionMessage.addSpace(8,"\u2002")}**${daily}** h
Weekly:${FocusSessionMessage.addSpace(6,"\u2002")}${weekly} h
Monthly:${FocusSessionMessage.addSpace(5,"\u2002")}\u202F\u0020${monthly} h
All-time:${FocusSessionMessage.addSpace(5,"\u2002")}\u202F\u0020${all} h`,true)
            .addField("\u200B",`Average/day (${Time.getThisMonth()}): \u2005**${average}** h\n\nCurrent study streak: \u2005${dailyStreak} days\nLongest study streak: \u2005${longestStreak} days`)
            .setFooter({text:`${user.username}`, iconURL:avatarUrl})

    }

    static addSpace(n,unicode="\u2005"){
        let str = ""
        for (let i = 0; i < n; i++) {
            str += unicode 
        }
        return str
    }
    static report2(user){
        const {daily,weekly,monthly,all,average,dailyStreak,longestStreak} = {
            daily: '0.67',
            weekly: '9.67',
            monthly: '1.27',
            all: '1.27',
            average: '0.09',
            dailyStreak: '1',
            longestStreak: '3',
          }
        const avatarUrl = InfoUser.getAvatar(user)
        return new MessageEmbed()
            .setColor('#FEFEFE')
            .addField(`Timeframe ${FocusSessionMessage.addSpace(5)} Hours`,`
Daily:${FocusSessionMessage.addSpace(8,"\u2002")}**${daily}** h
Weekly:${FocusSessionMessage.addSpace(6,"\u2002")}${weekly} h
Monthly:${FocusSessionMessage.addSpace(5,"\u2002")}\u202F${monthly} h
All-time:${FocusSessionMessage.addSpace(5,"\u2002")}\u202F\u0020${all} h`,true)
            .addField("\u200B",`Average/day (${Time.getThisMonth()}): \u2005**${average}** h\n\nCurrent study streak: \u2005${dailyStreak} days\nLongest study streak: \u2005${longestStreak} days`)
            .setFooter({text:`${user.username}`, iconURL:avatarUrl})

    }
    static embedMessage(text){
        return new MessageEmbed()
        .setColor('#fefefe')
        .setDescription(text)
    }

    static startFocusSession(author){
        
        return `**Hi ${author} please join <#${CHANNEL_CLOSA_CAFE}> to start your focus session.**
if you already inside closa cafe please __disconnect & rejoin.__

\`\`rules:\`\` __turn on video or sharescreen to show accountability.__`
    }

    static messageTimer(minute,name,isLive=true){
        
        const taskName = name.split('focus log - ')[1]
         if (isLive) {
            return `**Focus session started**
        
:timer: focus time: **${Time.convertTime(minute,'short')}** — **LIVE :red_circle:**
:arrow_right: ${taskName}

—
tips: 
• *disconnect from closa café to stop your focus time*
• *try to hit your goal during the focus time.*
• *if you are done, post on <#${CHANNEL_TODO}>.*`
         }else{
            return `**Focus session ended**
        
:timer: focus time: **${Time.convertTime(minute,'short')}** 
:arrow_right: ${taskName}`
        
         }
    }
}

module.exports=FocusSessionMessage
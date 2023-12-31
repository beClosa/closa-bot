const { EmbedBuilder, channelMention } = require("discord.js")
const { CHANNEL_GUIDELINE, CHANNEL_COMMAND } = require("../helpers/config")
const MessageComponent = require("../helpers/MessageComponent")
const MessageFormatting = require("../helpers/MessageFormatting")

class GuidelineInfoMessage {
    static guideline(userId,membership,isHaveProfile,isHaveReferral,showButtonTestimonial,totalReferral){
        const buttons = []
        if(!isHaveProfile) buttons.push(MessageComponent.addEmojiButton(`writeIntro_${userId}`,'Make an intro','👋'))
        if(isHaveReferral) buttons.push(MessageComponent.addEmojiButton(`claimReferral_${userId}`,'Invite Friends','🎁',"PRIMARY"))
        if(showButtonTestimonial) buttons.push(MessageComponent.addEmojiButton(`submitTestimonialGuideline_${userId}`,'Testimonial','💌'))
        buttons.push(
            MessageComponent.addLinkEmojiButton("Community playbook",'https://closa.notion.site/Closa-f3937e68c57e46c4b028b69e8f1412b2','📒'),
        )
        return {
            content:`Hi ${MessageFormatting.tagUser(userId)}, here's the community guideline to help you get the most out of closa:`,
            embeds:[
                new EmbedBuilder()
                    .setColor('fafafb')
                    .setThumbnail('https://pbs.twimg.com/profile_images/1497990921874403329/qLmIBav9_400x400.jpg')
                    .setTitle("🗒 Closa Guidelines ")
                    .setDescription(`**How to use closa**
Get started here → ${channelMention(CHANNEL_GUIDELINE)}

**Official links**
Website → https://closa.me
Twitter → https://twitter.com/joinclosa

**Membership Status**
Active until → ∞

**Invite Friends **
${totalReferral} friends invited :gift:`)
// ${membership ? `Active until → ${membership}` : 'Not started yet'}
            ],
            components:[MessageComponent.createComponent(
                ...buttons
            )]
        }
    }
    
}

module.exports = GuidelineInfoMessage
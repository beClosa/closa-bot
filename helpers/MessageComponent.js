const { ButtonBuilder } = require("@discordjs/builders");
const {  ButtonStyle, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require("discord.js");
const FormatString = require("./formatString");
const InfoUser = require("./InfoUser");
class MessageComponent {
    static createComponent(...buttons){
        return new ActionRowBuilder()
            .addComponents(
                ...buttons
            )
    }

    static addButton(id,text,style="SUCCESS"){
        return new ButtonBuilder()
            .setCustomId(id)
            .setLabel(text)
            .setStyle(this.pickButtonStyle(style))
    }
    static addDisabledButton(id,text,style="SUCCESS"){
        return new ButtonBuilder()
            .setCustomId(id)
            .setLabel(text)
            .setStyle(this.pickButtonStyle(style))
            .setDisabled(true);
    }
    static addLinkButton(text,link){
        return new ButtonBuilder()
            .setLabel(text)
            .setURL(link)
            .setStyle(ButtonStyle.Link)
    }

    static addMenu(id,placeholder,options){
        return new StringSelectMenuBuilder()
            .setCustomId(id)
            .setPlaceholder(placeholder)
            .addOptions(options)
    }

    static addEmojiButton(id,text,emoji,style="SUCCESS"){
        return new ButtonBuilder()
            .setCustomId(id)
            .setLabel(text)
            .setStyle(this.pickButtonStyle(style))
            .setEmoji(emoji)
    }

    static embedMessage({title,description,user},color="#00B264"){
        const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(FormatString.truncateString(title,252)||"")
        .setDescription(FormatString.truncateString(description,4092)||"")

        if(user){
            embed.setFooter({iconURL:InfoUser.getAvatar(user),text:user.username})
        }

        return embed
    }

    static pickButtonStyle(style) {
        if(typeof style !== 'string') return style
        switch (style) {
            case "Primary":
                return ButtonStyle.Primary
            case "SECONDARY":
                return ButtonStyle.Secondary
            case "DANGER":
                return ButtonStyle.Danger
            default:
                return ButtonStyle.Success
        }
    }
}

module.exports = MessageComponent
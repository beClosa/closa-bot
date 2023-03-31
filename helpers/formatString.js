class FormatString {
    static truncateString(text="",maxLength=90){
        if(text===null) text = ''
        if (text.length > maxLength) {
            return text.substring(0,maxLength) +'...'
        }else{
            return text
        }
    }

    static notCharacter(text){
        return text > "~"
    }

    static isNumber(stringNumber){
        return !Number.isNaN(Number(stringNumber))
    }

    static capitalizeWords(str) {
        return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
}

module.exports = FormatString
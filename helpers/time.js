const {TIMEZONE} = require('../helpers/config')
class Time {
    static convertTime(time){
        let hour = Math.floor(time/60)
        let minute = time%60
        if (time<60) {
          return formatMinute(minute)
        }else{
          if (minute>1) {
              return `${formatHour(hour)} ${formatMinute(minute)}`
          }else{
              return formatHour(hour)
          }
        }
        
        function formatMinute(minute) {
            if (minute==1) {
                return `${minute} minute`   
            }else{
                return `${minute} minutes`   
            }
          }
        
        function formatHour(hour) {
            if (hour==1) {
                return `${hour} hour`   
            }else{
                return `${hour} hours`   
            }
          }
    }
    static getDate(customDate){
        const date= customDate ? new Date(customDate) : new Date()
        date.setHours(date.getHours()+Number(TIMEZONE))
        return date
    }

    static getThisMonth(){
        let months = ["January","February","March","April","May","June","July","August","September",'October',"November","December"]
        let today = this.getDate()
        return months[today.getMonth()]
    }
    static minus7Hours(hour){
    	hour = hour - Number(TIMEZONE)		
        return hour < 0 ? 24 + hour : hour
    }

    static isYesterday(date) {
        const todayDate = Time.getDate()
    
        todayDate.setDate(todayDate.getDate()-1)
        const stringDate = todayDate.toISOString().substring(0,10)
        
        return stringDate === date
    }
    
    static isVacationMode(date) {
        const todayDate = Time.getDate()
    
        if (todayDate.getDay() === 1) {
            console.log('masuk sini');
            todayDate.setDate(todayDate.getDate()-1)
            let stringDate = todayDate.toISOString().substring(0,10)
            if (stringDate === date) {
                return true
            }
            todayDate.setDate(todayDate.getDate()-1)
            stringDate = todayDate.toISOString().substring(0,10)
            if (stringDate === date) {
                return true
            }
            todayDate.setDate(todayDate.getDate()-1)
            stringDate = todayDate.toISOString().substring(0,10)
            if (stringDate === date) {
                return true
            }
        }else if(todayDate.getDay() === 0){
            todayDate.setDate(todayDate.getDate()-1)
            stringDate = todayDate.toISOString().substring(0,10)
            if (stringDate === date) {
                return true
            }
            todayDate.setDate(todayDate.getDate()-1)
            stringDate = todayDate.toISOString().substring(0,10)
            if (stringDate === date) {
                return true
            }
        }
        return false
    }

    static isValidStreak(date) {
        return this.isYesterday(date) || this.isVacationMode(date)
    }
}

module.exports = Time
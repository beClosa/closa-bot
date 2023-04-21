class GenerateLink {
    static addToCalendar(title,description,location,startDate,endDate) {
        const startTime = startDate.toISOString().replace(/-|:|\.\d\d\d/g,"")
        const endTime = endDate ? endDate.toISOString().replace(/-|:|\.\d\d\d/g,"") : startTime
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}&dates=${startTime}%2F${endTime}`
        //https://www.labnol.org/calendar/
    }
}

module.exports = GenerateLink
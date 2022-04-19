require('dotenv').config()


module.exports = {
    TOKEN: process.env.TOKEN,
    CLIENT_ID: process.env.CLIENT_ID,
    MY_ID: process.env.MY_ID,
    GUILD_ID: process.env.GUILD_ID,
    CHANNEL_GOALS: process.env.CHANNEL_GOALS,
    CHANNEL_STREAK: process.env.CHANNEL_STREAK,
    CHANNEL_REMINDER: process.env.CHANNEL_REMINDER,
    CHANNEL_HIGHLIGHT: process.env.CHANNEL_HIGHLIGHT,
    CHANNEL_TODO: process.env.CHANNEL_TODO,
    CHANNEL_TOPICS: process.env.CHANNEL_TOPICS,
    CHANNEL_REFLECTION: process.env.CHANNEL_REFLECTION,
    CHANNEL_SESSION_LOG: process.env.CHANNEL_SESSION_LOG,
    CHANNEL_PAYMENT: process.env.CHANNEL_PAYMENT,
    CHANNEL_CELEBRATE: process.env.CHANNEL_CELEBRATE,
    ROLE_7STREAK: process.env.ROLE_7STREAK,
    ROLE_30STREAK: process.env.ROLE_30STREAK,
    ROLE_100STREAK: process.env.ROLE_100STREAK,
    ROLE_365STREAK: process.env.ROLE_365STREAK,
    TIMEZONE: process.env.TIMEZONE,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SECRET_TOKEN: process.env.SECRET_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    EMAIL_PASS: process.env.EMAIL_PASS,
    BASE_URL: process.env.BASE_URL
}
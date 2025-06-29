# 🚀 Railway Deployment Guide

## Prerequisites
- GitHub account
- Railway account (free)
- Your bot token and channel IDs ready

## Step-by-Step Deployment

### 1. Create GitHub Repository
1. Go to [GitHub.com](https://github.com)
2. Click "New Repository"
3. Name it: `telegram-study-bot`
4. Make it **Public** (required for Railway free tier)
5. Don't initialize with README (we have files already)

### 2. Upload Your Code to GitHub
```bash
# In your project folder, run these commands:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/telegram-study-bot.git
git push -u origin main
```

### 3. Deploy on Railway
1. Go to [Railway.app](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Select your `telegram-study-bot` repository
5. Railway will automatically detect it's a Node.js project

### 4. Configure Environment Variables
In Railway dashboard:
1. Go to your project
2. Click "Variables" tab
3. Add these variables:

```
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_telegram_id
STORAGE_CHANNEL_ID=your_channel_id
UPI_ID=your_upi_id@paytm
BOT_NAME=Study Material Bot
WELCOME_MESSAGE=Welcome to our Study Material Store!
```

### 5. Deploy and Test
1. Railway will automatically deploy
2. Check logs for any errors
3. Test your bot by sending `/start`

## Important Notes
- Railway provides $5 free credit monthly
- Your bot will have 24/7 uptime
- Database is automatically created
- Files are stored in Telegram channels

## Troubleshooting
- Check Railway logs if bot doesn't respond
- Ensure all environment variables are set
- Verify bot token is correct
- Make sure storage channel has bot as admin
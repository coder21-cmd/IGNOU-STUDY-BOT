#!/bin/bash

# Railway Platform Check
check_railway_platform() {
    if [[ -z "$RAILWAY_ENVIRONMENT" && -z "$RAILWAY_PROJECT_ID" && -z "$RAILWAY_SERVICE_ID" ]]; then
        echo "🚫 UNAUTHORIZED EXECUTION BLOCKED"
        echo "❌ This bot can only run on Railway platform"
        echo "🔒 Access denied for security reasons"
        echo ""
        echo "ℹ️  If you need to run this bot:"
        echo "   1. Deploy it on Railway platform"
        echo "   2. Use the official Railway deployment"
        echo ""
        echo "🛡️  This restriction protects against unauthorized usage"
        exit 1
    fi
    
    echo "✅ Railway platform detected in start script"
    echo "🚀 Railway Environment: ${RAILWAY_ENVIRONMENT:-production}"
    echo "📦 Railway Project: ${RAILWAY_PROJECT_ID:-unknown}"
}

# Function to kill existing bot processes (Railway-aware)
kill_existing_bots() {
    echo "🔍 Checking for existing Railway bot processes..."
    
    # Only kill processes if we're on Railway
    if [[ -n "$RAILWAY_ENVIRONMENT" ]]; then
        # Kill any existing node processes running the bot
        pkill -f "node.*bot.js" 2>/dev/null || true
        pkill -f "nodemon.*bot.js" 2>/dev/null || true
        
        # Remove any existing PID file
        if [ -f ".bot.pid" ]; then
            echo "🗑️ Removing existing Railway PID file..."
            rm -f .bot.pid
        fi
        
        # Wait a moment for processes to terminate
        sleep 2
        echo "✅ Railway cleanup completed"
    else
        echo "⚠️ Not on Railway - skipping process cleanup"
    fi
}

# FIRST: Check if running on Railway platform
check_railway_platform

# Kill any existing instances (Railway only)
kill_existing_bots

# Create data directory if it doesn't exist
mkdir -p data

# Run database setup if database doesn't exist
if [ ! -f "./data/bot_database.db" ]; then
    echo "Setting up Railway database..."
    npm run setup
fi

# Start the Railway bot
echo "🚀 Starting Railway bot instance..."
npm start
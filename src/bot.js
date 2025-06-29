import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import BotService from './services/BotService.js';

// Load environment variables
dotenv.config();

// Railway Platform Detection
function isRunningOnRailway() {
  // Railway sets these specific environment variables
  const railwayEnvVars = [
    'RAILWAY_ENVIRONMENT',
    'RAILWAY_PROJECT_ID',
    'RAILWAY_SERVICE_ID',
    'RAILWAY_DEPLOYMENT_ID'
  ];
  
  // Check if at least one Railway-specific env var exists
  const hasRailwayEnv = railwayEnvVars.some(envVar => process.env[envVar]);
  
  // Additional check for Railway domain
  const hasRailwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || 
                          process.env.RAILWAY_PRIVATE_DOMAIN ||
                          (process.env.PORT && process.env.RAILWAY_ENVIRONMENT);
  
  return hasRailwayEnv || hasRailwayDomain;
}

// Block execution if not running on Railway
function enforceRailwayOnly() {
  if (!isRunningOnRailway()) {
    console.log('🚫 UNAUTHORIZED EXECUTION BLOCKED');
    console.log('❌ This bot can only run on Railway platform');
    console.log('🔒 Access denied for security reasons');
    console.log('');
    console.log('ℹ️  If you need to run this bot:');
    console.log('   1. Deploy it on Railway platform');
    console.log('   2. Use the official Railway deployment');
    console.log('');
    console.log('🛡️  This restriction protects against unauthorized usage');
    
    // Exit immediately without any cleanup
    process.exit(1);
  }
  
  console.log('✅ Railway platform detected - proceeding with bot startup');
  console.log(`🚀 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
  console.log(`📦 Railway Project: ${process.env.RAILWAY_PROJECT_ID || 'unknown'}`);
}

// Validate required environment variables
const requiredEnvVars = [
  'BOT_TOKEN',
  'ADMIN_CHAT_ID',
  'STORAGE_CHANNEL_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Set default values for optional environment variables
process.env.DB_PATH = process.env.DB_PATH || './data/bot_database.db';
process.env.BOT_NAME = process.env.BOT_NAME || 'Study Material Bot';
process.env.WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || 'Welcome to our Study Material Store!';
process.env.UPI_ID = process.env.UPI_ID || 'your_upi_id@paytm';
process.env.MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '2147483648';
process.env.ALLOWED_FILE_TYPES = process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,ppt,pptx,zip,rar,mp4,avi,mov,jpg,png';

// PID file management (only for Railway)
const PID_FILE = path.join(process.cwd(), '.bot.pid');
let isShuttingDown = false;
let botService = null;

function createPidFile() {
  try {
    const pidData = {
      pid: process.pid,
      platform: 'railway',
      environment: process.env.RAILWAY_ENVIRONMENT || 'production',
      projectId: process.env.RAILWAY_PROJECT_ID || 'unknown',
      serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
      startTime: new Date().toISOString()
    };
    
    fs.writeFileSync(PID_FILE, JSON.stringify(pidData, null, 2));
    console.log(`📝 Created Railway PID file: ${PID_FILE} (PID: ${process.pid})`);
  } catch (error) {
    console.error('❌ Failed to create PID file:', error);
  }
}

function removePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
      console.log('🗑️ Removed Railway PID file');
    }
  } catch (error) {
    console.error('❌ Failed to remove PID file:', error);
  }
}

function checkExistingInstance() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const pidFileContent = fs.readFileSync(PID_FILE, 'utf8');
      let pidData;
      
      try {
        pidData = JSON.parse(pidFileContent);
      } catch {
        // Old format PID file, remove it
        console.log('🧹 Removing old format PID file...');
        removePidFile();
        return;
      }
      
      console.log(`⚠️ Found existing Railway PID file:`);
      console.log(`   PID: ${pidData.pid}`);
      console.log(`   Platform: ${pidData.platform}`);
      console.log(`   Environment: ${pidData.environment}`);
      console.log(`   Started: ${pidData.startTime}`);
      
      // Check if process is still running
      try {
        process.kill(pidData.pid, 0); // Signal 0 checks if process exists
        
        // If it's a Railway process, allow it to continue (Railway handles restarts)
        if (pidData.platform === 'railway') {
          console.log('🔄 Existing Railway instance detected - Railway will handle process management');
          console.log('🛑 Exiting to prevent conflicts');
          process.exit(0);
        } else {
          console.log('❌ Non-Railway instance detected and blocked!');
          process.exit(1);
        }
      } catch (error) {
        // Process doesn't exist, remove stale PID file
        console.log('🧹 Removing stale Railway PID file...');
        removePidFile();
      }
    } catch (error) {
      console.log('🧹 Removing invalid Railway PID file...');
      removePidFile();
    }
  }
}

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    console.log('🔄 Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 Railway instance received ${signal}. Shutting down gracefully...`);
  
  try {
    // Stop the bot polling first
    if (botService && botService.bot) {
      console.log('🔄 Stopping bot polling...');
      await botService.bot.stopPolling();
      console.log('✅ Bot polling stopped');
      
      // Add delay to give Telegram API time to register the termination
      console.log('⏳ Waiting for Telegram API to register termination...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Close database connection
    if (botService && botService.db) {
      console.log('💾 Closing database connection...');
      await botService.db.close();
      console.log('✅ Database connection closed');
    }
    
    // Remove PID file
    removePidFile();
    
    console.log('✅ Railway instance graceful shutdown completed');
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Error during Railway shutdown:', error);
    removePidFile();
    process.exit(1);
  }
}

async function startBot() {
  try {
    // FIRST: Enforce Railway-only execution
    enforceRailwayOnly();
    
    // Check for existing instances (Railway-aware)
    checkExistingInstance();
    
    // Create Railway PID file
    createPidFile();
    
    console.log('🤖 Starting Telegram Study Material Bot on Railway...');
    console.log(`📱 Bot Name: ${process.env.BOT_NAME}`);
    console.log(`👤 Admin Chat ID: ${process.env.ADMIN_CHAT_ID}`);
    console.log(`📁 Storage Channel ID: ${process.env.STORAGE_CHANNEL_ID}`);
    console.log(`💾 Database Path: ${process.env.DB_PATH}`);
    console.log(`🚀 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
    
    botService = new BotService();
    await botService.initialize();
    
    console.log('✅ Railway bot instance started successfully!');
    console.log('🔄 Polling for messages...');
    
    // Handle bot polling errors with Railway-specific logging
    botService.bot.on('polling_error', async (error) => {
      console.error('❌ Railway bot polling error:', error.message);
      
      // If it's a 409 conflict error, shutdown immediately
      if (error.message.includes('409 Conflict') || error.message.includes('terminated by other getUpdates')) {
        console.log('🔄 Detected 409 conflict on Railway - another instance conflict');
        console.log('🛑 Shutting down Railway instance to prevent conflicts');
        await gracefulShutdown('POLLING_CONFLICT', 1);
      }
      
      // Handle other critical polling errors
      if (error.message.includes('401 Unauthorized')) {
        console.log('🔑 Invalid bot token on Railway - shutting down');
        await gracefulShutdown('INVALID_TOKEN', 1);
      }
    });
    
    // Handle bot errors
    botService.bot.on('error', async (error) => {
      console.error('❌ Railway bot error:', error.message);
      
      // Handle critical errors that require shutdown
      if (error.message.includes('409 Conflict') || 
          error.message.includes('terminated by other getUpdates') ||
          error.message.includes('401 Unauthorized')) {
        await gracefulShutdown('BOT_ERROR', 1);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start Railway bot:', error);
    
    // Special handling for 409 conflicts during initialization
    if (error.message && error.message.includes('409 Conflict')) {
      console.log('🔄 Conflict detected during Railway bot initialization');
      console.log('💡 Another bot instance may still be active. Railway will handle restart.');
    }
    
    removePidFile();
    process.exit(1);
  }
}

// Setup signal handlers for Railway
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Railway bot unhandled rejection:', promise, 'reason:', reason);
  
  // If the rejection is related to Telegram conflicts, shutdown gracefully
  if (reason && reason.message && reason.message.includes('409 Conflict')) {
    await gracefulShutdown('UNHANDLED_REJECTION', 1);
  } else {
    removePidFile();
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Railway bot uncaught exception:', error);
  
  // If the exception is related to Telegram conflicts, shutdown gracefully
  if (error.message && error.message.includes('409 Conflict')) {
    await gracefulShutdown('UNCAUGHT_EXCEPTION', 1);
  } else {
    removePidFile();
    process.exit(1);
  }
});

// Cleanup on exit
process.on('exit', () => {
  removePidFile();
});

// Start the Railway bot
startBot();
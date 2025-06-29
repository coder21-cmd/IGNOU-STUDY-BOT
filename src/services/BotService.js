import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import IGNOUService from './IGNOUService.js';
import { BotStates, AdminStates, IGNOUStates, MaterialStates } from '../utils/constants.js';
import { formatPrice, formatDate, createInlineKeyboard } from '../utils/helpers.js';

class BotService {
  constructor() {
    this.bot = null;
    this.db = null;
    this.userModel = null;
    this.categoryModel = null;
    this.productModel = null;
    this.orderModel = null;
    this.ignouService = null;
    this.userSessions = new Map();
    this.adminSessions = new Map();
  }

  async initialize() {
    try {
      // Initialize database
      this.db = new Database(process.env.DB_PATH);
      await this.db.initialize();

      // Initialize models
      this.userModel = new User(this.db);
      this.categoryModel = new Category(this.db);
      this.productModel = new Product(this.db);
      this.orderModel = new Order(this.db);
      this.ignouService = new IGNOUService();

      // Initialize bot
      this.bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
      
      // Set up event handlers
      this.setupEventHandlers();
      
      console.log('Bot service initialized successfully');
      console.log('Admin Chat ID from env:', process.env.ADMIN_CHAT_ID);
    } catch (error) {
      console.error('Bot service initialization error:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStart(msg);
    });

    // Debug command to check admin status
    this.bot.onText(/\/checkadmin/, async (msg) => {
      console.log('Received /checkadmin command from:', msg.from.id);
      await this.handleCheckAdminCommand(msg);
    });

    // Admin commands
    this.bot.onText(/\/admin/, async (msg) => {
      await this.handleAdminCommand(msg);
    });

    this.bot.onText(/\/approve (.+)/, async (msg, match) => {
      await this.handleApproveCommand(msg, match[1]);
    });

    this.bot.onText(/\/reject (.+)/, async (msg, match) => {
      await this.handleRejectCommand(msg, match[1]);
    });

    // Handle callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (callbackQuery) => {
      await this.handleCallbackQuery(callbackQuery);
    });

    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        await this.handleTextMessage(msg);
      }
    });

    // Handle photo messages (payment screenshots)
    this.bot.on('photo', async (msg) => {
      await this.handlePhotoMessage(msg);
    });

    // Handle document messages (file uploads)
    this.bot.on('document', async (msg) => {
      await this.handleDocumentMessage(msg);
    });

    // Error handling
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });
  }

  async handleCheckAdminCommand(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
      console.log('Processing /checkadmin for user:', user.id);
      
      const envAdminId = process.env.ADMIN_CHAT_ID;
      const userTelegramId = user.id.toString();
      const dbUser = await this.userModel.findByTelegramId(userTelegramId);
      const isDbAdmin = dbUser ? await this.userModel.isAdmin(userTelegramId) : false;

      console.log('Debug info:', {
        userTelegramId,
        envAdminId,
        dbUser: !!dbUser,
        isDbAdmin
      });

      const debugInfo = `
🔍 Admin Debug Info:

👤 Your Telegram ID: ${userTelegramId}
⚙️ Admin ID from env: ${envAdminId}
🎯 Direct match: ${userTelegramId === envAdminId ? 'YES ✅' : 'NO ❌'}
💾 User in database: ${dbUser ? 'YES ✅' : 'NO ❌'}
👑 Admin flag in DB: ${isDbAdmin ? 'YES ✅' : 'NO ❌'}
📊 Database user ID: ${dbUser ? dbUser.id : 'N/A'}
🔐 Is admin flag: ${dbUser ? dbUser.is_admin : 'N/A'}

${userTelegramId === envAdminId ? '✅ You should see Admin Panel!' : '❌ You are not configured as admin'}
      `;

      await this.bot.sendMessage(chatId, debugInfo);

      // If user should be admin but isn't marked in DB, fix it
      if (userTelegramId === envAdminId && dbUser && !isDbAdmin) {
        await this.userModel.setAdmin(dbUser.id, true);
        await this.bot.sendMessage(chatId, '✅ Fixed admin status in database. Try /start again.');
      }

      // If user should be admin but not in DB, create them
      if (userTelegramId === envAdminId && !dbUser) {
        const newUser = await this.userModel.createOrUpdate({
          telegram_id: userTelegramId,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        });
        await this.userModel.setAdmin(newUser.id, true);
        await this.bot.sendMessage(chatId, '✅ Created admin user in database. Try /start again.');
      }

    } catch (error) {
      console.error('Error in handleCheckAdminCommand:', error);
      await this.bot.sendMessage(chatId, `❌ Error checking admin status: ${error.message}`);
    }
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
      console.log(`User ${user.id} (${user.first_name}) started the bot`);
      console.log(`Chat ID: ${chatId}`);
      console.log(`Admin Chat ID from env: ${process.env.ADMIN_CHAT_ID}`);

      // Create or update user
      const userData = await this.userModel.createOrUpdate({
        telegram_id: user.id.toString(),
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      });

      console.log('User data created/updated:', userData);

      // Set user session
      this.userSessions.set(chatId, { state: BotStates.BROWSING });

      // Check if user is admin - try multiple methods
      let isAdmin = false;
      
      // Method 1: Check by telegram ID directly
      if (user.id.toString() === process.env.ADMIN_CHAT_ID) {
        isAdmin = true;
        console.log('User is admin (direct ID match)');
        
        // Ensure user is marked as admin in database
        if (userData) {
          await this.userModel.setAdmin(userData.id, true);
          console.log('Set admin flag in database');
        }
      }
      
      // Method 2: Check database admin flag
      const dbAdminCheck = await this.userModel.isAdmin(user.id.toString());
      if (dbAdminCheck) {
        isAdmin = true;
        console.log('User is admin (database check)');
      }

      console.log(`Final admin status: ${isAdmin}`);
      
      const welcomeMessage = `🎓 Welcome to IGNOU STUDY BOT!

Check Ignou Services for:

assignment status, assignment, grade card marks

Check Ignou Materials for:

Pyqs, assignment, study notes, ignou digital books

Choose an option below to get started:`;

      const keyboard = [
        [{ text: '🎓 IGNOU Services', callback_data: 'ignou_services' }],
        [{ text: '📚 IGNOU Materials', callback_data: 'ignou_materials' }],
        [{ text: '📋 My Orders', callback_data: 'my_orders' }]
      ];

      if (isAdmin) {
        keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]);
        console.log('Added Admin Panel button');
      } else {
        console.log('Admin Panel button NOT added - user is not admin');
      }

      await this.bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
    }
  }

  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id);

      // IGNOU Services
      if (data === 'ignou_services') {
        await this.showIGNOUServices(chatId, messageId);
      } else if (data === 'ignou_assignment_status') {
        await this.initiateIGNOUAssignmentStatus(chatId, messageId);
      } else if (data === 'ignou_grade_card') {
        await this.initiateIGNOUGradeCard(chatId, messageId);
      } else if (data === 'ignou_assignment_marks') {
        await this.initiateIGNOUAssignmentMarks(chatId, messageId);
      }
      // IGNOU Materials
      else if (data === 'ignou_materials') {
        await this.showIGNOUMaterials(chatId, messageId);
      } else if (data === 'select_program') {
        await this.showProgramSelection(chatId, messageId);
      } else if (data.startsWith('program_')) {
        const programCode = data.replace('program_', '');
        await this.showMaterialTypes(chatId, messageId, programCode);
      } else if (data.startsWith('pyqs_')) {
        const programCode = data.replace('pyqs_', '');
        await this.showPYQSemesters(chatId, messageId, programCode);
      } else if (data.startsWith('assignments_')) {
        const programCode = data.replace('assignments_', '');
        await this.showAssignmentSemesters(chatId, messageId, programCode);
      } else if (data.startsWith('notes_')) {
        const programCode = data.replace('notes_', '');
        await this.showStudyNotesCategories(chatId, messageId, programCode);
      } else if (data.startsWith('books_')) {
        const programCode = data.replace('books_', '');
        await this.showDigitalBooksCategories(chatId, messageId, programCode);
      } else if (data.startsWith('pyq_sem_')) {
        const [, , programCode, semester] = data.split('_');
        await this.showPYQSubjects(chatId, messageId, programCode, semester);
      } else if (data.startsWith('pyq_subject_')) {
        const parts = data.split('_');
        const programCode = parts[2];
        const semester = parts[3];
        const subjectCode = parts.slice(4).join('_');
        await this.showPYQSessions(chatId, messageId, programCode, semester, subjectCode);
      } else if (data.startsWith('download_pyq_')) {
        const parts = data.split('_');
        const programCode = parts[2];
        const semester = parts[3];
        const subjectCode = parts[4];
        const session = parts.slice(5).join('_');
        await this.downloadPYQ(chatId, messageId, programCode, semester, subjectCode, session);
      }
      // Other existing callbacks
      else if (data === 'my_orders') {
        await this.showUserOrders(chatId, messageId);
      } else if (data === 'admin_panel') {
        await this.showAdminPanel(chatId, messageId);
      } else if (data === 'back_to_main') {
        await this.handleStart({ chat: { id: chatId }, from: callbackQuery.from });
      }
      // Admin callbacks
      else if (data === 'admin_materials') {
        await this.showAdminMaterials(chatId, messageId);
      } else if (data === 'admin_pyqs') {
        await this.showAdminPYQs(chatId, messageId);
      } else if (data === 'admin_assignments') {
        await this.showAdminAssignments(chatId, messageId);
      } else if (data === 'admin_notes') {
        await this.showAdminNotes(chatId, messageId);
      } else if (data === 'admin_books') {
        await this.showAdminBooks(chatId, messageId);
      } else if (data.startsWith('add_pyq_program_')) {
        const programCode = data.replace('add_pyq_program_', '');
        await this.initiateAddPYQProgram(chatId, messageId, programCode);
      }

    } catch (error) {
      console.error('Error in handleCallbackQuery:', error);
      await this.bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
    }
  }

  // IGNOU Services Methods
  async showIGNOUServices(chatId, messageId) {
    const message = `🎓 IGNOU Services

Select the service you need:

📋 Assignment Status - Check submission status
🎓 Grade Card - Complete semester results with SGPA
📊 Assignment Marks - Semester-wise assignment marks with percentages

Choose an option below:`;

    const keyboard = [
      [{ text: '📋 Assignment Status', callback_data: 'ignou_assignment_status' }],
      [{ text: '🎓 Grade Card', callback_data: 'ignou_grade_card' }],
      [{ text: '📊 Assignment Marks', callback_data: 'ignou_assignment_marks' }],
      [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
    ];

    if (messageId) {
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.bot.sendMessage(chatId, message, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  async initiateIGNOUAssignmentStatus(chatId, messageId) {
    this.userSessions.set(chatId, { 
      state: IGNOUStates.WAITING_ENROLLMENT_ASSIGNMENT,
      messageId: messageId,
      service: 'assignment_status'
    });

    const message = `📋 IGNOU Assignment Status

Please enter your Enrollment Number:

Example: 123456789 or 1234567890

⚠️ Make sure to enter the correct enrollment number.`;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'ignou_services' }]]
      }
    });
  }

  async initiateIGNOUGradeCard(chatId, messageId) {
    this.userSessions.set(chatId, { 
      state: IGNOUStates.WAITING_ENROLLMENT_GRADE,
      messageId: messageId,
      service: 'grade_card'
    });

    const message = `🎓 IGNOU Grade Card

Please enter your Enrollment Number:

Example: 123456789 or 1234567890

⚠️ Make sure to enter the correct enrollment number.`;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'ignou_services' }]]
      }
    });
  }

  async initiateIGNOUAssignmentMarks(chatId, messageId) {
    this.userSessions.set(chatId, { 
      state: IGNOUStates.WAITING_ENROLLMENT_MARKS,
      messageId: messageId,
      service: 'assignment_marks'
    });

    const message = `📊 IGNOU Assignment Marks

Please enter your Enrollment Number:

Example: 123456789 or 1234567890

⚠️ Make sure to enter the correct enrollment number.`;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'ignou_services' }]]
      }
    });
  }

  async processIGNOUEnrollment(chatId, enrollmentNumber, service, messageId) {
    // Validate enrollment number (9 or 10 digits)
    if (!/^\d{9,10}$/.test(enrollmentNumber)) {
      await this.bot.editMessageText(
        '❌ Invalid enrollment number. Please enter a 9 or 10 digit enrollment number.',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { 
            inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `ignou_${service}` }]]
          }
        }
      );
      return;
    }

    // Update session to wait for program code
    this.userSessions.set(chatId, { 
      state: IGNOUStates.WAITING_PROGRAM_CODE,
      messageId: messageId,
      service: service,
      enrollmentNumber: enrollmentNumber
    });

    const message = `✅ Enrollment Number: ${enrollmentNumber}

Now please enter your Programme Code:

Examples:
• BCA - Bachelor of Computer Applications
• MCA - Master of Computer Applications
• BA - Bachelor of Arts
• MA - Master of Arts
• BCOM - Bachelor of Commerce
• MCOM - Master of Commerce

Enter your programme code:`;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'ignou_services' }]]
      }
    });
  }

  async processIGNOUProgramCode(chatId, programCode, session) {
    // Validate program code
    if (!/^[A-Za-z]{2,10}$/.test(programCode)) {
      await this.bot.editMessageText(
        '❌ Invalid programme code. Please enter a valid programme code (e.g., BCA, MCA, BA).',
        {
          chat_id: chatId,
          message_id: session.messageId,
          reply_markup: { 
            inline_keyboard: [[{ text: '🔄 Try Again', callback_data: `ignou_${session.service}` }]]
          }
        }
      );
      return;
    }

    // Show loading message
    await this.bot.editMessageText(
      `⏳ Fetching your ${session.service.replace('_', ' ')} data...\n\nPlease wait, this may take a few moments.`,
      {
        chat_id: chatId,
        message_id: session.messageId
      }
    );

    try {
      let result;
      
      switch (session.service) {
        case 'assignment_status':
          result = await this.ignouService.checkAssignmentStatus(session.enrollmentNumber, programCode);
          break;
        case 'grade_card':
          result = await this.ignouService.getGradeCard(session.enrollmentNumber, programCode);
          break;
        case 'assignment_marks':
          result = await this.ignouService.getGradeCard(session.enrollmentNumber, programCode);
          break;
      }

      if (result.success) {
        let formattedMessage;
        
        switch (session.service) {
          case 'assignment_status':
            formattedMessage = this.ignouService.formatAssignmentStatus(result.data);
            break;
          case 'grade_card':
            formattedMessage = this.ignouService.formatGradeCard(result.data);
            break;
          case 'assignment_marks':
            formattedMessage = this.ignouService.formatAssignmentMarks(result.data);
            break;
        }

        // Split message if too long
        if (formattedMessage.length > 4000) {
          const chunks = this.splitMessage(formattedMessage, 4000);
          for (let i = 0; i < chunks.length; i++) {
            if (i === 0) {
              await this.bot.editMessageText(chunks[i], {
                chat_id: chatId,
                message_id: session.messageId
              });
            } else {
              await this.bot.sendMessage(chatId, chunks[i]);
            }
          }
        } else {
          await this.bot.editMessageText(formattedMessage, {
            chat_id: chatId,
            message_id: session.messageId
          });
        }

        // Send back to IGNOU services menu
        await this.bot.sendMessage(chatId, 'Would you like to check another service?', {
          reply_markup: { 
            inline_keyboard: [
              [{ text: '🎓 IGNOU Services', callback_data: 'ignou_services' }],
              [{ text: '🏠 Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });

      } else {
        await this.bot.editMessageText(
          `❌ ${result.error}\n\nPlease check your enrollment number and programme code.`,
          {
            chat_id: chatId,
            message_id: session.messageId,
            reply_markup: { 
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: `ignou_${session.service}` }],
                [{ text: '🎓 IGNOU Services', callback_data: 'ignou_services' }]
              ]
            }
          }
        );
      }

    } catch (error) {
      console.error('Error processing IGNOU request:', error);
      await this.bot.editMessageText(
        '❌ Service temporarily unavailable. Please try again later.',
        {
          chat_id: chatId,
          message_id: session.messageId,
          reply_markup: { 
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: `ignou_${session.service}` }],
              [{ text: '🎓 IGNOU Services', callback_data: 'ignou_services' }]
            ]
          }
        }
      );
    }

    // Clear session
    this.userSessions.delete(chatId);
  }

  // IGNOU Materials Methods
  async showIGNOUMaterials(chatId, messageId) {
    const message = `📚 IGNOU Materials

Access study materials for your IGNOU programme:

📝 PYQs - Previous Year Question Papers
📋 Assignments - Current Session Assignments  
📖 Study Notes - Comprehensive Study Materials
📚 Digital Books - IGNOU Official Books

First, select your programme:`;

    const keyboard = [
      [{ text: '🎓 Select Programme', callback_data: 'select_program' }],
      [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
    ];

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async showProgramSelection(chatId, messageId) {
    const message = `🎓 Select Your Programme

Choose your IGNOU programme:`;

    const keyboard = [
      [{ text: '💻 BCA', callback_data: 'program_BCA' }],
      [{ text: '🖥️ MCA', callback_data: 'program_MCA' }],
      [{ text: '📚 BA', callback_data: 'program_BA' }],
      [{ text: '🎓 MA', callback_data: 'program_MA' }],
      [{ text: '💼 BCOM', callback_data: 'program_BCOM' }],
      [{ text: '📊 MCOM', callback_data: 'program_MCOM' }],
      [{ text: '⬅️ Back', callback_data: 'ignou_materials' }]
    ];

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async showMaterialTypes(chatId, messageId, programCode) {
    const message = `📚 ${programCode} Materials

Select the type of material you need:

📝 PYQs - Previous Year Question Papers (semester-wise)
📋 Assignments - Current Session Assignments
📖 Study Notes - Comprehensive study materials
📚 Digital Books - IGNOU official books`;

    const keyboard = [
      [{ text: '📝 PYQs', callback_data: `pyqs_${programCode}` }],
      [{ text: '📋 Assignments', callback_data: `assignments_${programCode}` }],
      [{ text: '📖 Study Notes', callback_data: `notes_${programCode}` }],
      [{ text: '📚 Digital Books', callback_data: `books_${programCode}` }],
      [{ text: '⬅️ Back', callback_data: 'select_program' }]
    ];

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async showPYQSemesters(chatId, messageId, programCode) {
    const message = `📝 ${programCode} - Previous Year Questions

Select semester:`;

    const keyboard = [];
    
    // Get semesters based on program
    const semesters = this.getSemestersByProgram(programCode);
    
    for (const semester of semesters) {
      keyboard.push([{ text: `📚 Semester ${semester}`, callback_data: `pyq_sem_${programCode}_${semester}` }]);
    }
    
    keyboard.push([{ text: '⬅️ Back', callback_data: `program_${programCode}` }]);

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async showPYQSubjects(chatId, messageId, programCode, semester) {
    try {
      // Get subjects from database for this program and semester
      const subjects = await this.getPYQSubjects(programCode, semester);
      
      const message = `📝 ${programCode} - Semester ${semester} PYQs

Select subject:`;

      const keyboard = [];
      
      if (subjects.length === 0) {
        keyboard.push([{ text: '❌ No subjects available', callback_data: 'noop' }]);
      } else {
        for (const subject of subjects) {
          keyboard.push([{ 
            text: `📖 ${subject.code} - ${subject.name}`, 
            callback_data: `pyq_subject_${programCode}_${semester}_${subject.code}` 
          }]);
        }
      }
      
      keyboard.push([{ text: '⬅️ Back', callback_data: `pyqs_${programCode}` }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error showing PYQ subjects:', error);
      await this.bot.sendMessage(chatId, 'Error loading subjects. Please try again.');
    }
  }

  async showPYQSessions(chatId, messageId, programCode, semester, subjectCode) {
    try {
      // Get available sessions for this subject
      const sessions = await this.getPYQSessions(programCode, semester, subjectCode);
      
      const message = `📝 ${programCode} - ${subjectCode} PYQs

Select session:`;

      const keyboard = [];
      
      if (sessions.length === 0) {
        keyboard.push([{ text: '❌ No papers available', callback_data: 'noop' }]);
      } else {
        for (const session of sessions) {
          keyboard.push([{ 
            text: `📄 ${session.name}`, 
            callback_data: `download_pyq_${programCode}_${semester}_${subjectCode}_${session.id}` 
          }]);
        }
      }
      
      keyboard.push([{ text: '⬅️ Back', callback_data: `pyq_sem_${programCode}_${semester}` }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error showing PYQ sessions:', error);
      await this.bot.sendMessage(chatId, 'Error loading sessions. Please try again.');
    }
  }

  async downloadPYQ(chatId, messageId, programCode, semester, subjectCode, sessionId) {
    try {
      // Get the file from database
      const pyqFile = await this.getPYQFile(programCode, semester, subjectCode, sessionId);
      
      if (!pyqFile) {
        await this.bot.editMessageText('❌ File not found.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      await this.bot.editMessageText('📥 Sending your PYQ file...', {
        chat_id: chatId,
        message_id: messageId
      });

      // Forward the file from storage channel
      await this.bot.forwardMessage(chatId, process.env.STORAGE_CHANNEL_ID, pyqFile.message_id);
      
      await this.bot.sendMessage(chatId, '✅ PYQ file sent successfully!', {
        reply_markup: { 
          inline_keyboard: [
            [{ text: '📝 More PYQs', callback_data: `pyq_subject_${programCode}_${semester}_${subjectCode}` }],
            [{ text: '🏠 Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });

    } catch (error) {
      console.error('Error downloading PYQ:', error);
      await this.bot.sendMessage(chatId, 'Error downloading file. Please try again.');
    }
  }

  // Admin Materials Management
  async showAdminPanel(chatId, messageId = null) {
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      const message = 'You are not authorized to access the admin panel.';
      if (messageId) {
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId
        });
      } else {
        await this.bot.sendMessage(chatId, message);
      }
      return;
    }

    const message = `⚙️ Admin Panel

Choose an option:`;

    const keyboard = [
      [{ text: '📚 Manage Materials', callback_data: 'admin_materials' }],
      [{ text: '📋 Pending Orders', callback_data: 'admin_orders' }],
      [{ text: '📊 Statistics', callback_data: 'admin_stats' }],
      [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
    ];

    if (messageId) {
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.bot.sendMessage(chatId, message, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  async showAdminMaterials(chatId, messageId) {
    const message = `📚 Manage Materials

Select material type to manage:`;

    const keyboard = [
      [{ text: '📝 Manage PYQs', callback_data: 'admin_pyqs' }],
      [{ text: '📋 Manage Assignments', callback_data: 'admin_assignments' }],
      [{ text: '📖 Manage Study Notes', callback_data: 'admin_notes' }],
      [{ text: '📚 Manage Digital Books', callback_data: 'admin_books' }],
      [{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]
    ];

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async showAdminPYQs(chatId, messageId) {
    const message = `📝 Manage PYQs

Select programme to manage:`;

    const keyboard = [
      [{ text: '💻 BCA PYQs', callback_data: 'add_pyq_program_BCA' }],
      [{ text: '🖥️ MCA PYQs', callback_data: 'add_pyq_program_MCA' }],
      [{ text: '📚 BA PYQs', callback_data: 'add_pyq_program_BA' }],
      [{ text: '🎓 MA PYQs', callback_data: 'add_pyq_program_MA' }],
      [{ text: '💼 BCOM PYQs', callback_data: 'add_pyq_program_BCOM' }],
      [{ text: '📊 MCOM PYQs', callback_data: 'add_pyq_program_MCOM' }],
      [{ text: '⬅️ Back', callback_data: 'admin_materials' }]
    ];

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Helper Methods
  getSemestersByProgram(programCode) {
    const semesterMap = {
      'BCA': [1, 2, 3, 4, 5, 6],
      'MCA': [1, 2, 3, 4],
      'BA': [1, 2, 3],
      'MA': [1, 2],
      'BCOM': [1, 2, 3],
      'MCOM': [1, 2]
    };
    
    return semesterMap[programCode] || [1, 2, 3];
  }

  async getPYQSubjects(programCode, semester) {
    try {
      const sql = `
        SELECT DISTINCT subject_code as code, subject_name as name
        FROM ignou_materials 
        WHERE program_code = ? AND semester = ? AND material_type = 'pyq'
        ORDER BY subject_code
      `;
      return await this.db.all(sql, [programCode, semester]);
    } catch (error) {
      console.error('Error getting PYQ subjects:', error);
      return [];
    }
  }

  async getPYQSessions(programCode, semester, subjectCode) {
    try {
      const sql = `
        SELECT id, session_name as name
        FROM ignou_materials 
        WHERE program_code = ? AND semester = ? AND subject_code = ? AND material_type = 'pyq'
        ORDER BY session_name DESC
      `;
      return await this.db.all(sql, [programCode, semester, subjectCode]);
    } catch (error) {
      console.error('Error getting PYQ sessions:', error);
      return [];
    }
  }

  async getPYQFile(programCode, semester, subjectCode, sessionId) {
    try {
      const sql = `
        SELECT * FROM ignou_materials 
        WHERE program_code = ? AND semester = ? AND subject_code = ? AND id = ? AND material_type = 'pyq'
      `;
      return await this.db.get(sql, [programCode, semester, subjectCode, sessionId]);
    } catch (error) {
      console.error('Error getting PYQ file:', error);
      return null;
    }
  }

  splitMessage(message, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        if (line.length > maxLength) {
          // Split very long lines
          const words = line.split(' ');
          let currentLine = '';
          for (const word of words) {
            if ((currentLine + word + ' ').length > maxLength) {
              if (currentLine) {
                chunks.push(currentLine.trim());
                currentLine = '';
              }
              currentLine = word + ' ';
            } else {
              currentLine += word + ' ';
            }
          }
          if (currentLine) {
            currentChunk = currentLine + '\n';
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const session = this.userSessions.get(chatId);
    const adminSession = this.adminSessions.get(chatId);

    // Handle IGNOU service inputs
    if (session) {
      if (session.state === IGNOUStates.WAITING_ENROLLMENT_ASSIGNMENT ||
          session.state === IGNOUStates.WAITING_ENROLLMENT_GRADE ||
          session.state === IGNOUStates.WAITING_ENROLLMENT_MARKS) {
        await this.processIGNOUEnrollment(chatId, text.trim(), session.service, session.messageId);
        return;
      } else if (session.state === IGNOUStates.WAITING_PROGRAM_CODE) {
        await this.processIGNOUProgramCode(chatId, text.trim().toUpperCase(), session);
        return;
      }
    }

    // Handle admin material management inputs
    if (adminSession) {
      // Handle admin inputs here
      return;
    }

    // Handle other text messages based on user session
    if (!session || session.state === BotStates.BROWSING) {
      return;
    }
  }

  // Placeholder methods for missing functionality
  async showUserOrders(chatId, messageId) {
    await this.bot.editMessageText('📋 Order history functionality coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]]
      }
    });
  }

  async showAdminStats(chatId, messageId) {
    await this.bot.editMessageText('📊 Statistics coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]]
      }
    });
  }

  async showAdminAssignments(chatId, messageId) {
    await this.bot.editMessageText('📋 Assignment management coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin_materials' }]]
      }
    });
  }

  async showAdminNotes(chatId, messageId) {
    await this.bot.editMessageText('📖 Study notes management coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin_materials' }]]
      }
    });
  }

  async showAdminBooks(chatId, messageId) {
    await this.bot.editMessageText('📚 Digital books management coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'admin_materials' }]]
      }
    });
  }

  async showAssignmentSemesters(chatId, messageId, programCode) {
    await this.bot.editMessageText('📋 Assignment semesters coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: `program_${programCode}` }]]
      }
    });
  }

  async showStudyNotesCategories(chatId, messageId, programCode) {
    await this.bot.editMessageText('📖 Study notes categories coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: `program_${programCode}` }]]
      }
    });
  }

  async showDigitalBooksCategories(chatId, messageId, programCode) {
    await this.bot.editMessageText('📚 Digital books categories coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: `program_${programCode}` }]]
      }
    });
  }

  async handlePhotoMessage(msg) {
    // Handle photo uploads for admin
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      return;
    }

    await this.bot.sendMessage(chatId, '📸 Photo received. File management coming soon!');
  }

  async handleDocumentMessage(msg) {
    // Handle document uploads for admin
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      return;
    }

    await this.bot.sendMessage(chatId, '📎 Document received. File management coming soon!');
  }

  // Placeholder admin methods
  async handleAdminCommand(msg) {
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      await this.bot.sendMessage(chatId, 'You are not authorized to use this command.');
      return;
    }

    await this.showAdminPanel(chatId);
  }

  async handleApproveCommand(msg, orderId) {
    await this.bot.sendMessage(msg.chat.id, 'Order approval functionality coming soon!');
  }

  async handleRejectCommand(msg, orderId) {
    await this.bot.sendMessage(msg.chat.id, 'Order rejection functionality coming soon!');
  }
}

export default BotService;

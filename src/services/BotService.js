import TelegramBot from 'node-telegram-bot-api';
import Database from '../config/database.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { BotStates, AdminStates } from '../utils/constants.js';
import { formatPrice, formatDate, createInlineKeyboard } from '../utils/helpers.js';

class BotService {
  constructor() {
    this.bot = null;
    this.db = null;
    this.userModel = null;
    this.categoryModel = null;
    this.productModel = null;
    this.orderModel = null;
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
      
      const welcomeMessage = `
🎓 Welcome to ${process.env.BOT_NAME}!

${process.env.WELCOME_MESSAGE}

Choose an option below to get started:
      `;

      const keyboard = [
        [{ text: '📚 Browse Categories', callback_data: 'browse_categories' }],
        [{ text: '🔍 Search Products', callback_data: 'search_products' }],
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

      if (data === 'browse_categories') {
        await this.showCategories(chatId, messageId);
      } else if (data === 'search_products') {
        await this.initiateSearch(chatId, messageId);
      } else if (data === 'my_orders') {
        await this.showUserOrders(chatId, messageId);
      } else if (data === 'admin_panel') {
        await this.showAdminPanel(chatId, messageId);
      } else if (data.startsWith('category_')) {
        const categoryId = data.replace('category_', '');
        await this.showCategoryProducts(chatId, messageId, categoryId);
      } else if (data.startsWith('product_')) {
        const productId = data.replace('product_', '');
        await this.showProductDetails(chatId, messageId, productId);
      } else if (data.startsWith('buy_')) {
        const productId = data.replace('buy_', '');
        await this.initiatePurchase(chatId, messageId, productId);
      } else if (data.startsWith('confirm_buy_')) {
        const productId = data.replace('confirm_buy_', '');
        await this.confirmPurchase(chatId, messageId, productId);
      } else if (data === 'back_to_categories') {
        await this.showCategories(chatId, messageId);
      } else if (data === 'back_to_main') {
        await this.handleStart({ chat: { id: chatId }, from: callbackQuery.from });
      }
      // Admin callback handlers
      else if (data === 'admin_categories') {
        await this.showAdminCategories(chatId, messageId);
      } else if (data === 'admin_products') {
        await this.showAdminProducts(chatId, messageId);
      } else if (data === 'admin_orders') {
        await this.showAdminOrders(chatId, messageId);
      } else if (data === 'admin_stats') {
        await this.showAdminStats(chatId, messageId);
      }
      // Category management callbacks
      else if (data === 'add_category') {
        await this.initiateAddCategory(chatId, messageId);
      } else if (data.startsWith('edit_category_')) {
        const categoryId = data.replace('edit_category_', '');
        await this.showEditCategory(chatId, messageId, categoryId);
      } else if (data.startsWith('delete_category_')) {
        const categoryId = data.replace('delete_category_', '');
        await this.confirmDeleteCategory(chatId, messageId, categoryId);
      } else if (data.startsWith('confirm_delete_category_')) {
        const categoryId = data.replace('confirm_delete_category_', '');
        await this.deleteCategory(chatId, messageId, categoryId);
      } else if (data.startsWith('view_subcategories_')) {
        const categoryId = data.replace('view_subcategories_', '');
        await this.showSubcategories(chatId, messageId, categoryId);
      } else if (data.startsWith('add_subcategory_')) {
        const parentId = data.replace('add_subcategory_', '');
        await this.initiateAddSubcategory(chatId, messageId, parentId);
      }

    } catch (error) {
      console.error('Error in handleCallbackQuery:', error);
      await this.bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
    }
  }

  async showCategories(chatId, messageId = null) {
    try {
      const categories = await this.categoryModel.findByParent(null);
      
      if (categories.length === 0) {
        const message = 'No categories available at the moment.';
        if (messageId) {
          await this.bot.editMessageText(message, { chat_id: chatId, message_id: messageId });
        } else {
          await this.bot.sendMessage(chatId, message);
        }
        return;
      }

      const keyboard = [];
      for (const category of categories) {
        const productCount = await this.categoryModel.getProductCount(category.id);
        keyboard.push([{
          text: `📁 ${category.name} (${productCount} products)`,
          callback_data: `category_${category.id}`
        }]);
      }

      keyboard.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);

      const message = '📚 Select a category to browse:';
      
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

    } catch (error) {
      console.error('Error in showCategories:', error);
      await this.bot.sendMessage(chatId, 'Error loading categories. Please try again.');
    }
  }

  async showCategoryProducts(chatId, messageId, categoryId) {
    try {
      const category = await this.categoryModel.findById(categoryId);
      const products = await this.productModel.findByCategory(categoryId);
      const subcategories = await this.categoryModel.findByParent(categoryId);

      let message = `📁 ${category.name}\n`;
      if (category.description) {
        message += `${category.description}\n`;
      }
      message += '\n';

      const keyboard = [];

      // Show subcategories first
      if (subcategories.length > 0) {
        message += '📂 Subcategories:\n';
        for (const subcat of subcategories) {
          const productCount = await this.categoryModel.getProductCount(subcat.id);
          keyboard.push([{
            text: `📁 ${subcat.name} (${productCount} products)`,
            callback_data: `category_${subcat.id}`
          }]);
        }
        message += '\n';
      }

      // Show products
      if (products.length > 0) {
        message += '📚 Products:\n';
        for (const product of products) {
          keyboard.push([{
            text: `📖 ${product.name} - ${formatPrice(product.price)}`,
            callback_data: `product_${product.id}`
          }]);
        }
      } else if (subcategories.length === 0) {
        message += 'No products available in this category.';
      }

      keyboard.push([{ text: '⬅️ Back to Categories', callback_data: 'back_to_categories' }]);
      keyboard.push([{ text: '🏠 Main Menu', callback_data: 'back_to_main' }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showCategoryProducts:', error);
      await this.bot.sendMessage(chatId, 'Error loading products. Please try again.');
    }
  }

  async showProductDetails(chatId, messageId, productId) {
    try {
      const product = await this.productModel.findById(productId);
      const files = await this.productModel.getFiles(productId);
      
      if (!product) {
        await this.bot.editMessageText('Product not found.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      let message = `📖 ${product.name}\n\n`;
      if (product.description) {
        message += `📝 Description:\n${product.description}\n\n`;
      }
      message += `💰 Price: ${formatPrice(product.price)}\n`;
      message += `📁 Category: ${product.category_name}\n`;
      message += `📎 Files: ${files.length} file(s)\n\n`;

      // Check if user already purchased this product
      const user = await this.userModel.findByTelegramId(chatId.toString());
      const alreadyPurchased = user ? await this.orderModel.hasUserPurchased(user.id, productId) : false;

      const keyboard = [];
      
      if (alreadyPurchased) {
        keyboard.push([{ text: '✅ Already Purchased - Download Files', callback_data: `download_${productId}` }]);
      } else {
        keyboard.push([{ text: '🛒 Buy Now', callback_data: `buy_${productId}` }]);
      }

      keyboard.push([{ text: '⬅️ Back', callback_data: `category_${product.category_id}` }]);
      keyboard.push([{ text: '🏠 Main Menu', callback_data: 'back_to_main' }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showProductDetails:', error);
      await this.bot.sendMessage(chatId, 'Error loading product details. Please try again.');
    }
  }

  async initiatePurchase(chatId, messageId, productId) {
    try {
      const product = await this.productModel.findById(productId);
      
      if (!product) {
        await this.bot.editMessageText('Product not found.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      const message = `
🛒 Purchase Confirmation

📖 Product: ${product.name}
💰 Price: ${formatPrice(product.price)}

Are you sure you want to purchase this product?
      `;

      const keyboard = [
        [
          { text: '✅ Yes, Buy Now', callback_data: `confirm_buy_${productId}` },
          { text: '❌ Cancel', callback_data: `product_${productId}` }
        ]
      ];

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in initiatePurchase:', error);
      await this.bot.sendMessage(chatId, 'Error processing purchase. Please try again.');
    }
  }

  async confirmPurchase(chatId, messageId, productId) {
    try {
      const product = await this.productModel.findById(productId);
      const user = await this.userModel.findByTelegramId(chatId.toString());
      
      if (!product || !user) {
        await this.bot.editMessageText('Error processing purchase.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      // Create order
      const order = await this.orderModel.create({
        user_id: user.id,
        product_id: productId,
        amount: product.price
      });

      // Set user session to waiting for payment screenshot
      this.userSessions.set(chatId, { 
        state: BotStates.WAITING_SCREENSHOT,
        orderId: order.id 
      });

      const message = `
💳 Payment Instructions

📖 Product: ${product.name}
💰 Amount: ${formatPrice(product.price)}

Please make payment using UPI:
🏦 UPI ID: ${process.env.UPI_ID}

After making payment, please send a screenshot of the transaction as proof.

⚠️ Important: Your order will be processed only after payment verification.
      `;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId
      });

      // Notify admin about new order
      await this.notifyAdminNewOrder(order);

    } catch (error) {
      console.error('Error in confirmPurchase:', error);
      await this.bot.sendMessage(chatId, 'Error processing purchase. Please try again.');
    }
  }

  async handlePhotoMessage(msg) {
    const chatId = msg.chat.id;
    const session = this.userSessions.get(chatId);

    if (!session || session.state !== BotStates.WAITING_SCREENSHOT) {
      return;
    }

    try {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      
      // Update order with payment screenshot
      await this.orderModel.updatePaymentScreenshot(session.orderId, fileId);
      
      // Update user session
      this.userSessions.set(chatId, { state: BotStates.WAITING_APPROVAL });

      await this.bot.sendMessage(chatId, `
✅ Payment screenshot received!

Your payment is being verified. You will receive your files once the payment is approved by our admin.

Order ID: ${session.orderId}

Thank you for your patience! 🙏
      `);

      // Notify admin about payment screenshot
      const order = await this.orderModel.findById(session.orderId);
      await this.notifyAdminPaymentScreenshot(order, fileId);

    } catch (error) {
      console.error('Error in handlePhotoMessage:', error);
      await this.bot.sendMessage(chatId, 'Error processing payment screenshot. Please try again.');
    }
  }

  async notifyAdminNewOrder(order) {
    try {
      const message = `
🔔 New Order Received!

👤 Customer: ${order.first_name} ${order.last_name || ''}
📱 Telegram ID: ${order.telegram_id}
📖 Product: ${order.product_name}
💰 Amount: ${formatPrice(order.amount)}
🆔 Order ID: ${order.id}
📅 Date: ${formatDate(order.created_at)}

Waiting for payment screenshot...
      `;

      await this.bot.sendMessage(process.env.ADMIN_CHAT_ID, message);
    } catch (error) {
      console.error('Error notifying admin about new order:', error);
    }
  }

  async notifyAdminPaymentScreenshot(order, fileId) {
    try {
      const message = `
💳 Payment Screenshot Received!

👤 Customer: ${order.first_name} ${order.last_name || ''}
📖 Product: ${order.product_name}
💰 Amount: ${formatPrice(order.amount)}
🆔 Order ID: ${order.id}

Please verify the payment and approve/reject:
/approve ${order.id}
/reject ${order.id}
      `;

      const keyboard = [
        [
          { text: '✅ Approve', callback_data: `approve_${order.id}` },
          { text: '❌ Reject', callback_data: `reject_${order.id}` }
        ]
      ];

      await this.bot.sendPhoto(process.env.ADMIN_CHAT_ID, fileId, {
        caption: message,
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error notifying admin about payment screenshot:', error);
    }
  }

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
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      await this.bot.sendMessage(chatId, 'You are not authorized to use this command.');
      return;
    }

    try {
      const admin = await this.userModel.findByTelegramId(chatId.toString());
      const order = await this.orderModel.approve(orderId, admin.id);
      
      if (!order) {
        await this.bot.sendMessage(chatId, 'Order not found.');
        return;
      }

      // Send files to customer
      await this.sendProductFiles(order.telegram_id, order.product_id);

      await this.bot.sendMessage(chatId, `✅ Order ${orderId} approved and files sent to customer.`);
      
      // Notify customer
      await this.bot.sendMessage(order.telegram_id, `
🎉 Payment Approved!

Your payment has been verified and approved. You should receive your files shortly.

Thank you for your purchase! 🙏
      `);

    } catch (error) {
      console.error('Error in handleApproveCommand:', error);
      await this.bot.sendMessage(chatId, 'Error approving order. Please try again.');
    }
  }

  async handleRejectCommand(msg, orderId) {
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      await this.bot.sendMessage(chatId, 'You are not authorized to use this command.');
      return;
    }

    try {
      const admin = await this.userModel.findByTelegramId(chatId.toString());
      const order = await this.orderModel.reject(orderId, admin.id);
      
      if (!order) {
        await this.bot.sendMessage(chatId, 'Order not found.');
        return;
      }

      await this.bot.sendMessage(chatId, `❌ Order ${orderId} rejected.`);
      
      // Notify customer
      await this.bot.sendMessage(order.telegram_id, `
❌ Payment Rejected

Your payment could not be verified. Please contact support if you believe this is an error.

Order ID: ${orderId}
      `);

    } catch (error) {
      console.error('Error in handleRejectCommand:', error);
      await this.bot.sendMessage(chatId, 'Error rejecting order. Please try again.');
    }
  }

  async sendProductFiles(telegramId, productId) {
    try {
      const files = await this.productModel.getFiles(productId);
      const product = await this.productModel.findById(productId);

      if (files.length === 0) {
        await this.bot.sendMessage(telegramId, 'No files available for this product.');
        return;
      }

      await this.bot.sendMessage(telegramId, `
📦 Your Files for: ${product.name}

Sending ${files.length} file(s)...
      `);

      for (const file of files) {
        try {
          await this.bot.forwardMessage(telegramId, process.env.STORAGE_CHANNEL_ID, file.message_id);
        } catch (error) {
          console.error(`Error sending file ${file.file_name}:`, error);
          await this.bot.sendMessage(telegramId, `❌ Error sending file: ${file.file_name}`);
        }
      }

      await this.bot.sendMessage(telegramId, `
✅ All files sent successfully!

Thank you for your purchase. If you have any issues with the files, please contact support.
      `);

    } catch (error) {
      console.error('Error in sendProductFiles:', error);
      await this.bot.sendMessage(telegramId, 'Error sending files. Please contact support.');
    }
  }

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

    const message = `
⚙️ Admin Panel

Choose an option:
    `;

    const keyboard = [
      [{ text: '📁 Manage Categories', callback_data: 'admin_categories' }],
      [{ text: '📚 Manage Products', callback_data: 'admin_products' }],
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

  async showAdminStats(chatId, messageId) {
    try {
      const userStats = await this.userModel.getStats();
      const productStats = await this.productModel.getStats();
      const orderStats = await this.orderModel.getStats();

      const message = `
📊 Bot Statistics

👥 Users:
• Total Users: ${userStats.totalUsers}
• Active Users (30 days): ${userStats.activeUsers}
• New Users (7 days): ${userStats.newUsers}

📚 Products:
• Total Products: ${productStats.totalProducts}
• Total Files: ${productStats.totalFiles}

📋 Orders:
• Total Orders: ${orderStats.totalOrders}
• Recent Orders (7 days): ${orderStats.recentOrders}
• Total Revenue: ${formatPrice(orderStats.totalRevenue)}

📈 Orders by Status:
${orderStats.ordersByStatus.map(s => `• ${s.status}: ${s.count}`).join('\n')}
      `;

      const keyboard = [
        [{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]
      ];

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showAdminStats:', error);
      await this.bot.sendMessage(chatId, 'Error loading statistics.');
    }
  }

  // Category Management Methods
  async showAdminCategories(chatId, messageId) {
    try {
      const categories = await this.categoryModel.findByParent(null);
      
      let message = '📁 Category Management\n\n';
      
      if (categories.length === 0) {
        message += 'No categories found. Create your first category!';
      } else {
        message += 'Main Categories:\n';
        for (const category of categories) {
          const productCount = await this.categoryModel.getProductCount(category.id);
          const subcategories = await this.categoryModel.findByParent(category.id);
          message += `📁 ${category.name} (${productCount} products, ${subcategories.length} subcategories)\n`;
        }
      }

      const keyboard = [
        [{ text: '➕ Add New Category', callback_data: 'add_category' }]
      ];

      // Add buttons for existing categories
      for (const category of categories) {
        keyboard.push([
          { text: `✏️ ${category.name}`, callback_data: `edit_category_${category.id}` },
          { text: `📂 Subcategories`, callback_data: `view_subcategories_${category.id}` }
        ]);
      }

      keyboard.push([{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showAdminCategories:', error);
      await this.bot.sendMessage(chatId, 'Error loading categories.');
    }
  }

  async initiateAddCategory(chatId, messageId) {
    // Set admin session for adding category
    this.adminSessions.set(chatId, { 
      state: AdminStates.CREATING_CATEGORY,
      messageId: messageId
    });

    const message = `
➕ Add New Category

Please send the category name:
    `;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_categories' }]]
      }
    });
  }

  async showEditCategory(chatId, messageId, categoryId) {
    try {
      const category = await this.categoryModel.findById(categoryId);
      
      if (!category) {
        await this.bot.editMessageText('Category not found.', {
          chat_id: chatId,
          message_id: messageId
        });
        return;
      }

      const productCount = await this.categoryModel.getProductCount(categoryId);
      const subcategories = await this.categoryModel.findByParent(categoryId);

      const message = `
✏️ Edit Category: ${category.name}

📝 Description: ${category.description || 'No description'}
📚 Products: ${productCount}
📂 Subcategories: ${subcategories.length}
📅 Created: ${formatDate(category.created_at)}

What would you like to do?
      `;

      const keyboard = [
        [{ text: '✏️ Edit Name', callback_data: `edit_name_${categoryId}` }],
        [{ text: '📝 Edit Description', callback_data: `edit_desc_${categoryId}` }],
        [{ text: '➕ Add Subcategory', callback_data: `add_subcategory_${categoryId}` }],
        [{ text: '🗑️ Delete Category', callback_data: `delete_category_${categoryId}` }],
        [{ text: '⬅️ Back to Categories', callback_data: 'admin_categories' }]
      ];

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showEditCategory:', error);
      await this.bot.sendMessage(chatId, 'Error loading category details.');
    }
  }

  async confirmDeleteCategory(chatId, messageId, categoryId) {
    try {
      const category = await this.categoryModel.findById(categoryId);
      const productCount = await this.categoryModel.getProductCount(categoryId);
      const subcategories = await this.categoryModel.findByParent(categoryId);

      if (productCount > 0 || subcategories.length > 0) {
        const message = `
❌ Cannot Delete Category

Category "${category.name}" cannot be deleted because it contains:
• ${productCount} products
• ${subcategories.length} subcategories

Please move or delete the contents first.
        `;

        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { 
            inline_keyboard: [[{ text: '⬅️ Back', callback_data: `edit_category_${categoryId}` }]]
          }
        });
        return;
      }

      const message = `
🗑️ Delete Category

Are you sure you want to delete "${category.name}"?

⚠️ This action cannot be undone!
      `;

      const keyboard = [
        [
          { text: '✅ Yes, Delete', callback_data: `confirm_delete_category_${categoryId}` },
          { text: '❌ Cancel', callback_data: `edit_category_${categoryId}` }
        ]
      ];

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in confirmDeleteCategory:', error);
      await this.bot.sendMessage(chatId, 'Error processing delete request.');
    }
  }

  async deleteCategory(chatId, messageId, categoryId) {
    try {
      const category = await this.categoryModel.findById(categoryId);
      await this.categoryModel.delete(categoryId);

      const message = `
✅ Category Deleted

"${category.name}" has been successfully deleted.
      `;

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { 
          inline_keyboard: [[{ text: '⬅️ Back to Categories', callback_data: 'admin_categories' }]]
        }
      });

    } catch (error) {
      console.error('Error in deleteCategory:', error);
      await this.bot.sendMessage(chatId, `Error deleting category: ${error.message}`);
    }
  }

  async showSubcategories(chatId, messageId, parentId) {
    try {
      const parent = await this.categoryModel.findById(parentId);
      const subcategories = await this.categoryModel.findByParent(parentId);

      let message = `📂 Subcategories of: ${parent.name}\n\n`;

      if (subcategories.length === 0) {
        message += 'No subcategories found.';
      } else {
        for (const subcat of subcategories) {
          const productCount = await this.categoryModel.getProductCount(subcat.id);
          message += `📁 ${subcat.name} (${productCount} products)\n`;
        }
      }

      const keyboard = [
        [{ text: '➕ Add Subcategory', callback_data: `add_subcategory_${parentId}` }]
      ];

      // Add edit buttons for subcategories
      for (const subcat of subcategories) {
        keyboard.push([
          { text: `✏️ ${subcat.name}`, callback_data: `edit_category_${subcat.id}` }
        ]);
      }

      keyboard.push([{ text: '⬅️ Back', callback_data: `edit_category_${parentId}` }]);

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error in showSubcategories:', error);
      await this.bot.sendMessage(chatId, 'Error loading subcategories.');
    }
  }

  async initiateAddSubcategory(chatId, messageId, parentId) {
    // Set admin session for adding subcategory
    this.adminSessions.set(chatId, { 
      state: AdminStates.CREATING_CATEGORY,
      parentId: parentId,
      messageId: messageId
    });

    const parent = await this.categoryModel.findById(parentId);
    const message = `
➕ Add Subcategory to: ${parent.name}

Please send the subcategory name:
    `;

    await this.bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: `view_subcategories_${parentId}` }]]
      }
    });
  }

  // Placeholder methods for missing functionality
  async initiateSearch(chatId, messageId) {
    await this.bot.editMessageText('🔍 Search functionality coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]]
      }
    });
  }

  async showUserOrders(chatId, messageId) {
    await this.bot.editMessageText('📋 Order history functionality coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]]
      }
    });
  }

  async showAdminProducts(chatId, messageId) {
    await this.bot.editMessageText('📚 Product management coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]]
      }
    });
  }

  async showAdminOrders(chatId, messageId) {
    await this.bot.editMessageText('📋 Order management coming soon!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { 
        inline_keyboard: [[{ text: '⬅️ Back to Admin Panel', callback_data: 'admin_panel' }]]
      }
    });
  }

  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const session = this.userSessions.get(chatId);
    const adminSession = this.adminSessions.get(chatId);

    // Handle admin category creation
    if (adminSession && adminSession.state === AdminStates.CREATING_CATEGORY) {
      try {
        const categoryData = {
          name: text.trim(),
          description: `${text.trim()} category`
        };

        // If it's a subcategory, add parent_id
        if (adminSession.parentId) {
          categoryData.parent_id = adminSession.parentId;
        }

        const newCategory = await this.categoryModel.create(categoryData);
        
        // Clear admin session
        this.adminSessions.delete(chatId);

        const message = `
✅ Category Created Successfully!

📁 Name: ${newCategory.name}
📝 Description: ${newCategory.description}
${newCategory.parent_id ? '📂 Type: Subcategory' : '📂 Type: Main Category'}

The category is now available in your bot.
        `;

        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: adminSession.messageId,
          reply_markup: { 
            inline_keyboard: [[{ text: '⬅️ Back to Categories', callback_data: 'admin_categories' }]]
          }
        });

      } catch (error) {
        console.error('Error creating category:', error);
        await this.bot.sendMessage(chatId, `❌ Error creating category: ${error.message}`);
        this.adminSessions.delete(chatId);
      }
      return;
    }

    // Handle other text messages based on user session
    if (!session || session.state === BotStates.BROWSING) {
      return;
    }
  }

  async handleDocumentMessage(msg) {
    // Handle document uploads (for admin file uploads)
    const chatId = msg.chat.id;
    
    // Check if user is admin
    const isAdmin = await this.userModel.isAdmin(chatId.toString());
    if (!isAdmin) {
      return;
    }

    // For now, just acknowledge the document
    await this.bot.sendMessage(chatId, '📎 Document received. File management coming soon!');
  }
}

export default BotService;
# 🤖 Telegram Study Material Bot

A comprehensive Telegram bot system for selling digital study materials with advanced product management, hierarchical categories, and automated payment processing.

## ✨ Features

### 🎯 Core Functionality
- **Digital Product Marketplace**: Sell courses, assignments, and study materials
- **Hierarchical Categories**: Unlimited nested categories and subcategories
- **Secure File Delivery**: Files stored in private Telegram channels
- **Payment Verification**: UPI payment screenshot verification workflow
- **Admin Dashboard**: Complete product and order management system

### 👥 User Features
- Browse products by categories and subcategories
- Search products by name and description
- Secure purchase workflow with payment verification
- Automatic file delivery after payment approval
- Order history and purchase tracking
- Mobile-friendly inline keyboard interface

### ⚙️ Admin Features
- **Category Management**: Create, edit, delete categories with unlimited nesting
- **Product Management**: Add products, upload files, set prices
- **Order Processing**: Approve/reject payments with screenshot verification
- **File Management**: Bulk upload, organize files by products
- **Analytics Dashboard**: User statistics, sales reports, order tracking
- **User Management**: Admin role assignment, user activity monitoring

## 🏗️ Architecture

### 📁 Project Structure
```
src/
├── bot.js                 # Main application entry point
├── config/
│   └── database.js        # Database configuration and setup
├── models/
│   ├── User.js           # User model and operations
│   ├── Category.js       # Category model with hierarchy support
│   ├── Product.js        # Product model and file management
│   └── Order.js          # Order processing and payment handling
├── services/
│   └── BotService.js     # Main bot service and message handling
└── utils/
    ├── constants.js      # Application constants and enums
    └── helpers.js        # Utility functions and formatters
```

### 🗄️ Database Schema
- **Categories**: Hierarchical structure with unlimited nesting
- **Products**: Linked to categories with file associations
- **Users**: Telegram user management with admin roles
- **Orders**: Payment tracking and approval workflow
- **Files**: Secure file storage with metadata
- **User Sessions**: Bot state management
- **Admin Logs**: Action tracking and audit trail

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 16+ installed
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Private Telegram channel for file storage
- Admin Telegram user ID

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd telegram-study-bot

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### 3. Configuration
Edit `.env` file with your credentials:
```env
# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_admin_telegram_id
STORAGE_CHANNEL_ID=your_private_channel_id

# Payment Configuration
UPI_ID=your_upi_id@paytm

# Optional Configuration
BOT_NAME=Study Material Bot
WELCOME_MESSAGE=Welcome to our Study Material Store!
```

### 4. Setup Database
```bash
# Initialize database and create sample data
npm run setup
```

### 5. Start the Bot
```bash
# Production mode
npm start

# Development mode with auto-restart
npm run dev
```

## 📱 Bot Usage

### For Users
1. **Start**: Send `/start` to begin
2. **Browse**: Navigate through categories and subcategories
3. **Purchase**: Select product → Pay via UPI → Send screenshot
4. **Receive**: Get files automatically after admin approval

### For Admins
1. **Access**: Use `/admin` or click Admin Panel button
2. **Manage Categories**: Create nested category structures
3. **Add Products**: Upload files and set product details
4. **Process Orders**: Approve/reject payments with `/approve` or `/reject`
5. **Monitor**: View statistics and user activity

## 🔧 Advanced Configuration

### Category Hierarchy
Create unlimited nested categories:
```
IGNOU BCA/
├── Semester 1/
│   ├── Programming Fundamentals/
│   ├── Mathematics/
│   └── Computer Basics/
├── Semester 2/
│   ├── Data Structures/
│   └── Database Management/
└── Assignments/
    ├── Solved Assignments/
    └── Project Reports/
```

### File Management
- **Supported Types**: PDF, DOC, PPT, ZIP, MP4, images
- **Size Limit**: Up to 2GB per file
- **Storage**: Private Telegram channel
- **Organization**: Files linked to specific products
- **Delivery**: Automatic forwarding to customers

### Payment Processing
1. **Order Creation**: User selects product and confirms purchase
2. **Payment Instructions**: UPI details sent to user
3. **Screenshot Upload**: User sends payment proof
4. **Admin Verification**: Manual approval/rejection
5. **File Delivery**: Automatic delivery upon approval

## 🛠️ Development

### Adding New Features
1. **Models**: Extend database models in `src/models/`
2. **Services**: Add business logic in `src/services/`
3. **Bot Commands**: Implement in `BotService.js`
4. **Database**: Update schema in `database.js`

### Database Operations
```javascript
// Create category
const category = await categoryModel.create({
  name: 'New Category',
  description: 'Category description',
  parent_id: parentCategoryId // Optional for subcategory
});

// Add product
const product = await productModel.create({
  name: 'Product Name',
  description: 'Product description',
  price: 299.00,
  category_id: categoryId
});

// Process order
const order = await orderModel.create({
  user_id: userId,
  product_id: productId,
  amount: productPrice
});
```

### Custom Commands
Add new bot commands in `BotService.js`:
```javascript
this.bot.onText(/\/mycommand/, async (msg) => {
  await this.handleMyCommand(msg);
});
```

## 📊 Analytics & Monitoring

### Built-in Statistics
- **User Metrics**: Total users, active users, new registrations
- **Product Analytics**: Products by category, file counts
- **Sales Data**: Revenue tracking, order statistics
- **System Health**: Database performance, error tracking

### Admin Dashboard Features
- Real-time order notifications
- Payment screenshot verification
- Bulk file upload capabilities
- Category and product management
- User activity monitoring

## 🔒 Security Features

### Data Protection
- **User Privacy**: Secure user data handling
- **File Security**: Private channel storage
- **Payment Safety**: Screenshot-based verification
- **Admin Controls**: Role-based access control

### Access Control
- **Admin Verification**: Telegram ID-based admin access
- **Session Management**: Secure user state tracking
- **Command Authorization**: Protected admin commands
- **File Access**: Controlled file delivery

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. **VPS/Cloud Server**: Deploy on Ubuntu/CentOS
2. **Process Manager**: Use PM2 for process management
3. **Database**: SQLite (included) or PostgreSQL
4. **Monitoring**: Set up logging and error tracking

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start src/bot.js --name "telegram-bot"

# Monitor
pm2 status
pm2 logs telegram-bot
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the code examples

## 🔄 Updates & Roadmap

### Current Version: 1.0.0
- ✅ Basic bot functionality
- ✅ Category management
- ✅ Product management
- ✅ Payment processing
- ✅ File delivery system

### Planned Features
- 🔄 Payment gateway integration
- 🔄 Automated payment verification
- 🔄 Advanced analytics dashboard
- 🔄 Multi-language support
- 🔄 Subscription-based products
- 🔄 Affiliate system
- 🔄 Mobile app integration

---

**Built with ❤️ for digital education and e-commerce**
import dotenv from 'dotenv';
import Database from './config/database.js';
import User from './models/User.js';
import Category from './models/Category.js';
import Product from './models/Product.js';

dotenv.config();

async function setupBot() {
  try {
    console.log('🔧 Setting up Telegram Study Material Bot...');
    
    // Initialize database
    const db = new Database(process.env.DB_PATH || './data/bot_database.db');
    await db.initialize();
    console.log('✅ Database initialized');
    
    // Initialize models
    const userModel = new User(db);
    const categoryModel = new Category(db);
    const productModel = new Product(db);
    
    // Create admin user if ADMIN_CHAT_ID is provided
    if (process.env.ADMIN_CHAT_ID) {
      try {
        await userModel.createOrUpdate({
          telegram_id: process.env.ADMIN_CHAT_ID,
          username: 'admin',
          first_name: 'Admin',
          last_name: 'User'
        });
        
        const adminUser = await userModel.findByTelegramId(process.env.ADMIN_CHAT_ID);
        if (adminUser) {
          await userModel.setAdmin(adminUser.id, true);
          console.log('✅ Admin user created/updated');
        }
      } catch (error) {
        console.log('⚠️ Admin user setup skipped:', error.message);
      }
    }
    
    // Create sample categories
    const sampleCategories = [
      {
        name: 'IGNOU BCA',
        description: 'Bachelor of Computer Applications study materials'
      },
      {
        name: 'Programming',
        description: 'Programming languages and development materials'
      },
      {
        name: 'Mathematics',
        description: 'Mathematical concepts and problem solving'
      },
      {
        name: 'Computer Science',
        description: 'Core computer science subjects'
      }
    ];
    
    console.log('📁 Creating sample categories...');
    for (const categoryData of sampleCategories) {
      try {
        const existing = await db.get('SELECT id FROM categories WHERE name = ?', [categoryData.name]);
        if (!existing) {
          await categoryModel.create(categoryData);
          console.log(`✅ Created category: ${categoryData.name}`);
        } else {
          console.log(`⏭️ Category already exists: ${categoryData.name}`);
        }
      } catch (error) {
        console.log(`⚠️ Error creating category ${categoryData.name}:`, error.message);
      }
    }
    
    // Create subcategories for IGNOU BCA
    const ignouCategory = await db.get('SELECT id FROM categories WHERE name = ?', ['IGNOU BCA']);
    if (ignouCategory) {
      const ignouSubcategories = [
        { name: 'Semester 1', description: 'First semester subjects' },
        { name: 'Semester 2', description: 'Second semester subjects' },
        { name: 'Semester 3', description: 'Third semester subjects' },
        { name: 'Semester 4', description: 'Fourth semester subjects' },
        { name: 'Semester 5', description: 'Fifth semester subjects' },
        { name: 'Semester 6', description: 'Sixth semester subjects' }
      ];
      
      for (const subcatData of ignouSubcategories) {
        try {
          const existing = await db.get('SELECT id FROM categories WHERE name = ? AND parent_id = ?', 
            [subcatData.name, ignouCategory.id]);
          if (!existing) {
            await categoryModel.create({
              ...subcatData,
              parent_id: ignouCategory.id
            });
            console.log(`✅ Created subcategory: ${subcatData.name}`);
          }
        } catch (error) {
          console.log(`⚠️ Error creating subcategory ${subcatData.name}:`, error.message);
        }
      }
    }
    
    // Create sample products
    const categories = await categoryModel.getHierarchy();
    if (categories.length > 0) {
      const sampleProducts = [
        {
          name: 'Complete BCA Notes Bundle',
          description: 'Comprehensive study materials for all BCA subjects including assignments, solved papers, and reference materials.',
          price: 299.00,
          category_id: categories[0].id
        },
        {
          name: 'Programming Fundamentals Course',
          description: 'Learn programming from basics to advanced concepts with practical examples and projects.',
          price: 199.00,
          category_id: categories.find(c => c.name === 'Programming')?.id || categories[0].id
        }
      ];
      
      console.log('📚 Creating sample products...');
      for (const productData of sampleProducts) {
        try {
          const existing = await db.get('SELECT id FROM products WHERE name = ?', [productData.name]);
          if (!existing) {
            await productModel.create(productData);
            console.log(`✅ Created product: ${productData.name}`);
          } else {
            console.log(`⏭️ Product already exists: ${productData.name}`);
          }
        } catch (error) {
          console.log(`⚠️ Error creating product ${productData.name}:`, error.message);
        }
      }
    }
    
    await db.close();
    console.log('✅ Bot setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure your .env file is configured with the correct values');
    console.log('2. Add your bot to the storage channel as an admin');
    console.log('3. Run "npm start" to start the bot');
    console.log('4. Send /start to your bot to test it');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupBot();
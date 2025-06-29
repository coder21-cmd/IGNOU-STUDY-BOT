import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';

// Fix the sqlite3 import for ES modules
const sqlite = sqlite3.verbose();

class Database {
  constructor(dbPath = './data/bot_database.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Use sqlite.Database instead of sqlite3.Database
      this.db = new sqlite.Database(this.dbPath);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Categories table with hierarchical structure
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        level INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id)
      )`,

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category_id TEXT,
        is_active BOOLEAN DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )`,

      // Files table
      `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        file_hash TEXT,
        message_id INTEGER,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        is_admin BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_screenshot_file_id TEXT,
        payment_method TEXT DEFAULT 'upi',
        transaction_id TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,

      // User sessions for bot state management
      `CREATE TABLE IF NOT EXISTS user_sessions (
        user_id TEXT PRIMARY KEY,
        current_state TEXT DEFAULT 'browsing',
        session_data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Admin logs
      `CREATE TABLE IF NOT EXISTS admin_logs (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id)
      )`,

      // IGNOU Materials table
      `CREATE TABLE IF NOT EXISTS ignou_materials (
        id TEXT PRIMARY KEY,
        material_type TEXT NOT NULL,
        program_code TEXT NOT NULL,
        semester INTEGER,
        subject_code TEXT,
        subject_name TEXT,
        session_name TEXT,
        file_name TEXT NOT NULL,
        file_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        file_size INTEGER DEFAULT 0,
        category_path TEXT,
        subcategory_path TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // IGNOU Programs table
      `CREATE TABLE IF NOT EXISTS ignou_programs (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        duration_years INTEGER DEFAULT 3,
        total_semesters INTEGER DEFAULT 6,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // IGNOU Subjects table
      `CREATE TABLE IF NOT EXISTS ignou_subjects (
        id TEXT PRIMARY KEY,
        program_code TEXT NOT NULL,
        semester INTEGER NOT NULL,
        subject_code TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        credits INTEGER DEFAULT 4,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (program_code) REFERENCES ignou_programs(code)
      )`,

      // Material Categories table (for notes and books)
      `CREATE TABLE IF NOT EXISTS material_categories (
        id TEXT PRIMARY KEY,
        material_type TEXT NOT NULL,
        program_code TEXT NOT NULL,
        category_name TEXT NOT NULL,
        parent_category_id TEXT,
        level INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_category_id) REFERENCES material_categories(id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_files_product ON files(product_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id)',
      'CREATE INDEX IF NOT EXISTS idx_ignou_materials_program ON ignou_materials(program_code)',
      'CREATE INDEX IF NOT EXISTS idx_ignou_materials_type ON ignou_materials(material_type)',
      'CREATE INDEX IF NOT EXISTS idx_ignou_materials_semester ON ignou_materials(semester)',
      'CREATE INDEX IF NOT EXISTS idx_ignou_materials_subject ON ignou_materials(subject_code)',
      'CREATE INDEX IF NOT EXISTS idx_ignou_subjects_program ON ignou_subjects(program_code)',
      'CREATE INDEX IF NOT EXISTS idx_material_categories_type ON material_categories(material_type)',
      'CREATE INDEX IF NOT EXISTS idx_material_categories_program ON material_categories(program_code)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    // Insert default IGNOU programs
    await this.insertDefaultPrograms();
  }

  async insertDefaultPrograms() {
    const programs = [
      { code: 'BCA', name: 'BCA', full_name: 'Bachelor of Computer Applications', duration_years: 3, total_semesters: 6 },
      { code: 'MCA', name: 'MCA', full_name: 'Master of Computer Applications', duration_years: 2, total_semesters: 4 },
      { code: 'BA', name: 'BA', full_name: 'Bachelor of Arts', duration_years: 3, total_semesters: 6 },
      { code: 'MA', name: 'MA', full_name: 'Master of Arts', duration_years: 2, total_semesters: 4 },
      { code: 'BCOM', name: 'BCOM', full_name: 'Bachelor of Commerce', duration_years: 3, total_semesters: 6 },
      { code: 'MCOM', name: 'MCOM', full_name: 'Master of Commerce', duration_years: 2, total_semesters: 4 },
      { code: 'BSC', name: 'BSC', full_name: 'Bachelor of Science', duration_years: 3, total_semesters: 6 },
      { code: 'MSC', name: 'MSC', full_name: 'Master of Science', duration_years: 2, total_semesters: 4 }
    ];

    for (const program of programs) {
      try {
        const existing = await this.get('SELECT code FROM ignou_programs WHERE code = ?', [program.code]);
        if (!existing) {
          await this.run(
            'INSERT INTO ignou_programs (code, name, full_name, duration_years, total_semesters) VALUES (?, ?, ?, ?, ?)',
            [program.code, program.name, program.full_name, program.duration_years, program.total_semesters]
          );
        }
      } catch (error) {
        console.error(`Error inserting program ${program.code}:`, error);
      }
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default Database;

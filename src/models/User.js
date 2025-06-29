import { v4 as uuidv4 } from 'uuid';

class User {
  constructor(db) {
    this.db = db;
  }

  async create(userData) {
    const id = uuidv4();
    const { telegram_id, username, first_name, last_name, phone, email } = userData;
    
    const sql = `
      INSERT INTO users (id, telegram_id, username, first_name, last_name, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [
      id, 
      telegram_id, 
      username || null, 
      first_name || null, 
      last_name || null, 
      phone || null, 
      email || null
    ]);
    return await this.findById(id);
  }

  async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ? AND is_active = 1';
    return await this.db.get(sql, [id]);
  }

  async findByTelegramId(telegramId) {
    const sql = 'SELECT * FROM users WHERE telegram_id = ? AND is_active = 1';
    return await this.db.get(sql, [telegramId]);
  }

  async createOrUpdate(userData) {
    const existing = await this.findByTelegramId(userData.telegram_id);
    
    if (existing) {
      return await this.update(existing.id, userData);
    } else {
      return await this.create(userData);
    }
  }

  async update(id, updateData) {
    const { username, first_name, last_name, phone, email } = updateData;
    
    const sql = `
      UPDATE users 
      SET username = ?, first_name = ?, last_name = ?, phone = ?, email = ?,
          last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this.db.run(sql, [
      username || null, 
      first_name || null, 
      last_name || null, 
      phone || null, 
      email || null, 
      id
    ]);
    return await this.findById(id);
  }

  async setAdmin(userId, isAdmin = true) {
    const sql = 'UPDATE users SET is_admin = ? WHERE id = ?';
    await this.db.run(sql, [isAdmin ? 1 : 0, userId]);
    return await this.findById(userId);
  }

  async isAdmin(telegramId) {
    const user = await this.findByTelegramId(telegramId);
    return user && user.is_admin === 1;
  }

  async getOrders(userId) {
    const sql = `
      SELECT o.*, p.name as product_name, p.price
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `;
    return await this.db.all(sql, [userId]);
  }

  async updateLastActivity(userId) {
    const sql = 'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [userId]);
  }

  async getStats() {
    const stats = {};
    
    // Total users
    const totalUsers = await this.db.get(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    );
    stats.totalUsers = totalUsers.count;

    // Active users (last 30 days)
    const activeUsers = await this.db.get(`
      SELECT COUNT(*) as count FROM users 
      WHERE is_active = 1 AND last_activity > datetime('now', '-30 days')
    `);
    stats.activeUsers = activeUsers.count;

    // New users (last 7 days)
    const newUsers = await this.db.get(`
      SELECT COUNT(*) as count FROM users 
      WHERE is_active = 1 AND created_at > datetime('now', '-7 days')
    `);
    stats.newUsers = newUsers.count;

    return stats;
  }
}

export default User;
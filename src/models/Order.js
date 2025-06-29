import { v4 as uuidv4 } from 'uuid';

class Order {
  constructor(db) {
    this.db = db;
  }

  async create(orderData) {
    const id = uuidv4();
    const { user_id, product_id, amount, payment_method = 'upi' } = orderData;
    
    const sql = `
      INSERT INTO orders (id, user_id, product_id, amount, payment_method)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [id, user_id, product_id, amount, payment_method]);
    return await this.findById(id);
  }

  async findById(id) {
    const sql = `
      SELECT o.*, u.telegram_id, u.first_name, u.last_name, 
             p.name as product_name, p.description as product_description
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async findByUser(userId) {
    const sql = `
      SELECT o.*, p.name as product_name, p.description as product_description
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `;
    return await this.db.all(sql, [userId]);
  }

  async getPendingOrders() {
    const sql = `
      SELECT o.*, u.telegram_id, u.first_name, u.last_name, 
             p.name as product_name, p.price
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at ASC
    `;
    return await this.db.all(sql);
  }

  async updatePaymentScreenshot(orderId, fileId) {
    const sql = `
      UPDATE orders 
      SET payment_screenshot_file_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [fileId, orderId]);
    return await this.findById(orderId);
  }

  async approve(orderId, adminId, transactionId = null) {
    const sql = `
      UPDATE orders 
      SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP,
          transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [adminId, transactionId, orderId]);
    return await this.findById(orderId);
  }

  async reject(orderId, adminId) {
    const sql = `
      UPDATE orders 
      SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [adminId, orderId]);
    return await this.findById(orderId);
  }

  async getStats() {
    const stats = {};
    
    // Total orders
    const totalOrders = await this.db.get(
      'SELECT COUNT(*) as count FROM orders'
    );
    stats.totalOrders = totalOrders.count;

    // Orders by status
    const ordersByStatus = await this.db.all(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `);
    stats.ordersByStatus = ordersByStatus;

    // Revenue
    const revenue = await this.db.get(`
      SELECT SUM(amount) as total
      FROM orders
      WHERE status = 'approved'
    `);
    stats.totalRevenue = revenue.total || 0;

    // Recent orders (last 7 days)
    const recentOrders = await this.db.get(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at > datetime('now', '-7 days')
    `);
    stats.recentOrders = recentOrders.count;

    return stats;
  }

  async hasUserPurchased(userId, productId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE user_id = ? AND product_id = ? AND status = 'approved'
    `;
    const result = await this.db.get(sql, [userId, productId]);
    return result.count > 0;
  }
}

export default Order;
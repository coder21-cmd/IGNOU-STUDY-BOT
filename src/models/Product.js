import { v4 as uuidv4 } from 'uuid';

class Product {
  constructor(db) {
    this.db = db;
  }

  async create(productData) {
    const id = uuidv4();
    const { name, description, price, category_id, sort_order = 0 } = productData;
    
    const sql = `
      INSERT INTO products (id, name, description, price, category_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [id, name, description, price, category_id, sort_order]);
    return await this.findById(id);
  }

  async findById(id) {
    const sql = `
      SELECT p.*, c.name as category_name, c.parent_id as category_parent
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_active = 1
    `;
    return await this.db.get(sql, [id]);
  }

  async findByCategory(categoryId) {
    const sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ? AND p.is_active = 1
      ORDER BY p.sort_order, p.name
    `;
    return await this.db.all(sql, [categoryId]);
  }

  async getAll() {
    const sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY c.name, p.sort_order, p.name
    `;
    return await this.db.all(sql);
  }

  async search(query) {
    const sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.name LIKE ? OR p.description LIKE ?) AND p.is_active = 1
      ORDER BY p.name
    `;
    const searchTerm = `%${query}%`;
    return await this.db.all(sql, [searchTerm, searchTerm]);
  }

  async update(id, updateData) {
    const { name, description, price, category_id, sort_order } = updateData;
    
    const sql = `
      UPDATE products 
      SET name = ?, description = ?, price = ?, category_id = ?, sort_order = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this.db.run(sql, [name, description, price, category_id, sort_order, id]);
    return await this.findById(id);
  }

  async delete(id) {
    // Check if product has pending orders
    const pendingOrders = await this.db.get(
      'SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status = "pending"',
      [id]
    );
    
    if (pendingOrders.count > 0) {
      throw new Error('Cannot delete product with pending orders');
    }

    const sql = 'UPDATE products SET is_active = 0 WHERE id = ?';
    await this.db.run(sql, [id]);
    return true;
  }

  async getFiles(productId) {
    const sql = `
      SELECT * FROM files 
      WHERE product_id = ? AND is_active = 1
      ORDER BY upload_date
    `;
    return await this.db.all(sql, [productId]);
  }

  async addFile(productId, fileData) {
    const id = uuidv4();
    const { file_name, file_id, file_type, file_size, file_hash, message_id } = fileData;
    
    const sql = `
      INSERT INTO files (id, product_id, file_name, file_id, file_type, file_size, file_hash, message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [id, productId, file_name, file_id, file_type, file_size, file_hash, message_id]);
    return id;
  }

  async removeFile(fileId) {
    const sql = 'UPDATE files SET is_active = 0 WHERE id = ?';
    await this.db.run(sql, [fileId]);
    return true;
  }

  async getStats() {
    const stats = {};
    
    // Total products
    const totalProducts = await this.db.get(
      'SELECT COUNT(*) as count FROM products WHERE is_active = 1'
    );
    stats.totalProducts = totalProducts.count;

    // Products by category
    const productsByCategory = await this.db.all(`
      SELECT c.name as category, COUNT(p.id) as count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
      WHERE c.is_active = 1
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);
    stats.productsByCategory = productsByCategory;

    // Total files
    const totalFiles = await this.db.get(
      'SELECT COUNT(*) as count FROM files WHERE is_active = 1'
    );
    stats.totalFiles = totalFiles.count;

    return stats;
  }
}

export default Product;
import { v4 as uuidv4 } from 'uuid';

class Category {
  constructor(db) {
    this.db = db;
  }

  async create(categoryData) {
    const id = uuidv4();
    const { name, description, parent_id, level = 0, sort_order = 0 } = categoryData;
    
    // Calculate level based on parent
    let actualLevel = level;
    if (parent_id) {
      const parent = await this.findById(parent_id);
      if (parent) {
        actualLevel = parent.level + 1;
      }
    }

    const sql = `
      INSERT INTO categories (id, name, description, parent_id, level, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(sql, [id, name, description, parent_id, actualLevel, sort_order]);
    return await this.findById(id);
  }

  async findById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ? AND is_active = 1';
    return await this.db.get(sql, [id]);
  }

  async findByParent(parentId = null) {
    const sql = parentId 
      ? 'SELECT * FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order, name'
      : 'SELECT * FROM categories WHERE parent_id IS NULL AND is_active = 1 ORDER BY sort_order, name';
    
    return await this.db.all(sql, parentId ? [parentId] : []);
  }

  async getHierarchy() {
    const sql = `
      WITH RECURSIVE category_tree AS (
        SELECT id, name, description, parent_id, level, sort_order, 
               name as path, 0 as depth
        FROM categories 
        WHERE parent_id IS NULL AND is_active = 1
        
        UNION ALL
        
        SELECT c.id, c.name, c.description, c.parent_id, c.level, c.sort_order,
               ct.path || ' > ' || c.name as path, ct.depth + 1
        FROM categories c
        JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.is_active = 1
      )
      SELECT * FROM category_tree ORDER BY path
    `;
    
    return await this.db.all(sql);
  }

  async update(id, updateData) {
    const { name, description, parent_id, sort_order } = updateData;
    
    // Calculate new level if parent changed
    let level = 0;
    if (parent_id) {
      const parent = await this.findById(parent_id);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const sql = `
      UPDATE categories 
      SET name = ?, description = ?, parent_id = ?, level = ?, sort_order = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this.db.run(sql, [name, description, parent_id, level, sort_order, id]);
    return await this.findById(id);
  }

  async delete(id) {
    // Check if category has children
    const children = await this.findByParent(id);
    if (children.length > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check if category has products
    const productCount = await this.db.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = 1',
      [id]
    );
    
    if (productCount.count > 0) {
      throw new Error('Cannot delete category with products');
    }

    const sql = 'UPDATE categories SET is_active = 0 WHERE id = ?';
    await this.db.run(sql, [id]);
    return true;
  }

  async getFullPath(categoryId) {
    const sql = `
      WITH RECURSIVE category_path AS (
        SELECT id, name, parent_id, name as path
        FROM categories 
        WHERE id = ?
        
        UNION ALL
        
        SELECT c.id, c.name, c.parent_id, c.name || ' > ' || cp.path
        FROM categories c
        JOIN category_path cp ON cp.parent_id = c.id
      )
      SELECT path FROM category_path WHERE parent_id IS NULL
    `;
    
    const result = await this.db.get(sql, [categoryId]);
    return result ? result.path : '';
  }

  async getProductCount(categoryId) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE category_id = ? AND is_active = 1
    `;
    
    const result = await this.db.get(sql, [categoryId]);
    return result.count;
  }
}

export default Category;
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.VERCEL 
  ? '/tmp' 
  : path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'canteen.db');
const db = new sqlite3.Database(DB_PATH);

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  dietary_tag: 'veg' | 'non-veg' | 'vegan';
  image_url: string;
  is_available: number; // 0 or 1
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  pickup_slot: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  total_price: number;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface OrderItem {
  id: number;
  order_id: string;
  menu_item_id: number;
  quantity: number;
  price: number;
  name?: string;
  dietary_tag?: string;
}

export interface Feedback {
  id: number;
  user_id: string;
  menu_item_id: number;
  stars: number;
  tags: string; // JSON string array
  comment: string;
  created_at: string;
  user_name?: string;
  menu_item_name?: string;
}

export interface DailySummary {
  date: string;
  summary_text: string;
  created_at: string;
}

// Promisified DB helpers
export const query = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const queryOne = <T>(sql: string, params: any[] = []): Promise<T | null> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
};

export const run = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Initialize database
export const initDb = async () => {
  console.log('Initializing SQLite Database...');
  
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('breakfast', 'lunch', 'snacks', 'dinner')),
      dietary_tag TEXT NOT NULL CHECK(dietary_tag IN ('veg', 'non-veg', 'vegan')),
      image_url TEXT,
      is_available INTEGER NOT NULL DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pickup_slot TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'preparing', 'ready', 'completed')),
      total_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      menu_item_id INTEGER NOT NULL,
      stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
      tags TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      date TEXT PRIMARY KEY,
      summary_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Admin Users if empty
  const users = await query<User>('SELECT * FROM users');
  if (users.length === 0) {
    console.log('Seeding initial users...');
    await run(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
      ['admin1', 'chef@campus.edu', 'Chef Rajesh', 'admin']
    );
    await run(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
      ['student1', 'rahul.s@campus.edu', 'Rahul Sharma', 'student']
    );
    await run(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
      ['student2', 'priya.k@campus.edu', 'Priya Kapoor', 'student']
    );
  }

  // Seed Menu Items if empty
  const items = await query<MenuItem>('SELECT * FROM menu_items');
  if (items.length === 0) {
    console.log('Seeding initial menu items...');
    const initialItems = [
      // Breakfast
      {
        name: 'Masala Dosa',
        description: 'Crispy rice crepe filled with spiced potato mash, served with coconut chutney and hot sambar.',
        price: 3.50,
        category: 'breakfast',
        dietary_tag: 'veg',
        image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Idli Sambar',
        description: 'Soft steamed rice cakes served with flavor-rich lentil soup and coconut chutney.',
        price: 2.50,
        category: 'breakfast',
        dietary_tag: 'vegan',
        image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Bread Omelette',
        description: 'Toasted bread slices sandwiches with a fluffy double-egg masala omelette.',
        price: 3.00,
        category: 'breakfast',
        dietary_tag: 'non-veg',
        image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80',
        is_available: 1
      },
      // Lunch
      {
        name: 'Butter Chicken with Rice',
        description: 'Tender chicken tikka cooked in a creamy tomato-butter gravy, served with aromatic basmati rice.',
        price: 7.50,
        category: 'lunch',
        dietary_tag: 'non-veg',
        image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Paneer Kadhai with Naan',
        description: 'Cottage cheese chunks sautéed with bell peppers and ground spices, served with fresh garlic naan.',
        price: 6.50,
        category: 'lunch',
        dietary_tag: 'veg',
        image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Veg Hakka Noodles',
        description: 'Wok-tossed noodles with crunchy julienned cabbage, carrots, bell peppers, and scallions.',
        price: 5.50,
        category: 'lunch',
        dietary_tag: 'vegan',
        image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80',
        is_available: 1
      },
      // Snacks
      {
        name: 'Evening Samosas (2pcs)',
        description: 'Crispy fried pastries filled with potato peas mixture, served with sweet and spicy chutneys.',
        price: 2.00,
        category: 'snacks',
        dietary_tag: 'veg',
        image_url: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&q=80',
        is_available: 1
      },
      {
        name: 'French Fries',
        description: 'Golden potato fries seasoned with sea salt, served with hot sauce and ketchup.',
        price: 2.50,
        category: 'snacks',
        dietary_tag: 'vegan',
        image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Masala Chai',
        description: 'Fragrant and strong spiced Indian tea brewed with milk, ginger, and cardamom.',
        price: 1.50,
        category: 'snacks',
        dietary_tag: 'veg',
        image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
        is_available: 1
      },
      // Dinner
      {
        name: 'Chicken Biryani',
        description: 'Slow-cooked layered basmati rice with marinated chicken, saffron, and aromatic spices, served with raita.',
        price: 8.50,
        category: 'dinner',
        dietary_tag: 'non-veg',
        image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Dal Tadka with Jeera Rice',
        description: 'Yellow lentils cooked with turmeric and garlic, tempered with ghee and cumin, served with jeera rice.',
        price: 6.00,
        category: 'dinner',
        dietary_tag: 'vegan',
        image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80',
        is_available: 1
      },
      {
        name: 'Paneer Butter Masala with Roti',
        description: 'Paneer cubes in a rich, buttery, sweet tomato sauce, served with soft whole wheat rotis.',
        price: 7.00,
        category: 'dinner',
        dietary_tag: 'veg',
        image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80',
        is_available: 1
      }
    ];

    for (const item of initialItems) {
      await run(
        `INSERT INTO menu_items (name, description, price, category, dietary_tag, image_url, is_available)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.name, item.description, item.price, item.category, item.dietary_tag, item.image_url, item.is_available]
      );
    }
  }
  
  console.log('Database initialized successfully.');
};

export default db;

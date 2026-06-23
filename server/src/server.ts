import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDb, query, queryOne, run, MenuItem, User, Order, Feedback, DailySummary } from './db';
import { generateDailyBriefing } from './llm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static assets in production from the frontend dist folder
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Generate unique Order ID: ORD-XXXXXX
function generateOrderId(): string {
  const chars = '0123456789';
  let result = 'ORD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------
app.post('/api/auth/mock-login', async (req, res) => {
  const { email, name, role } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: 'Missing email, name, or role' });
  }

  try {
    const id = email.replace(/[^a-zA-Z0-9]/g, '_'); // simple unique user id
    let user = await queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    
    if (!user) {
      await run(
        'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        [id, email, name, role]
      );
      user = { id, email, name, role, created_at: new Date().toISOString() };
    } else if (user.role !== role) {
      // Allow updating role during testing
      await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
      user.role = role;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Menu Management API
// ----------------------------------------------------
app.get('/api/menu', async (req, res) => {
  try {
    const menuItems = await query<MenuItem & { avg_rating?: number; rating_count?: number }>(`
      SELECT m.*, ROUND(AVG(f.stars), 1) as avg_rating, COUNT(f.id) as rating_count
      FROM menu_items m
      LEFT JOIN feedback f ON m.id = f.menu_item_id
      GROUP BY m.id
    `);
    res.json(menuItems);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', async (req, res) => {
  const { name, description, price, category, dietary_tag, image_url } = req.body;
  if (!name || price === undefined || !category || !dietary_tag) {
    return res.status(400).json({ error: 'Missing required menu fields' });
  }

  try {
    const result = await run(
      `INSERT INTO menu_items (name, description, price, category, dietary_tag, image_url, is_available)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, description, price, category, dietary_tag, image_url || '']
    );
    const newItem = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [result.lastID]);
    res.status(201).json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/menu/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { is_available } = req.body; // should be 0 or 1

  if (is_available !== 0 && is_available !== 1) {
    return res.status(400).json({ error: 'is_available must be 0 (Sold Out) or 1 (Available)' });
  }

  try {
    const item = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await run('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available, id]);
    const updatedItem = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [id]);
    res.json(updatedItem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/menu/:id/price', async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;

  if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: 'Price must be a valid non-negative number' });
  }

  try {
    const item = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    await run('UPDATE menu_items SET price = ? WHERE id = ?', [Number(price), id]);
    const updatedItem = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [id]);
    res.json(updatedItem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if there are any orders referencing this menu item
    const referenced = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?',
      [id]
    );

    if (referenced && referenced.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete item: it has order history. Please toggle it to "Sold Out" instead to hide it.' 
      });
    }

    // Delete associated feedback
    await run('DELETE FROM feedback WHERE menu_item_id = ?', [id]);
    
    // Delete menu item
    const result = await run('DELETE FROM menu_items WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({ message: 'Menu item deleted successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Pre-Order Management API
// ----------------------------------------------------
app.post('/api/orders', async (req, res) => {
  const { userId, items, pickupSlot } = req.body; // items: [{ menuItemId: number, quantity: number }]

  if (!userId || !items || !Array.isArray(items) || items.length === 0 || !pickupSlot) {
    return res.status(400).json({ error: 'Missing userId, items, or pickupSlot' });
  }

  try {
    // Check if user exists
    const user = await queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify item availability and calculate total price
    let total_price = 0;
    const itemsWithPrices: { id: number; quantity: number; price: number }[] = [];

    for (const orderItem of items) {
      const menuItem = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [orderItem.menuItemId]);
      if (!menuItem) {
        return res.status(400).json({ error: `Menu item with ID ${orderItem.menuItemId} does not exist.` });
      }
      if (menuItem.is_available === 0) {
        return res.status(400).json({ error: `Item "${menuItem.name}" is currently sold out!` });
      }
      total_price += menuItem.price * orderItem.quantity;
      itemsWithPrices.push({
        id: menuItem.id,
        quantity: orderItem.quantity,
        price: menuItem.price
      });
    }

    const orderId = generateOrderId();
    
    // Insert into orders
    await run(
      'INSERT INTO orders (id, user_id, pickup_slot, status, total_price) VALUES (?, ?, ?, ?, ?)',
      [orderId, userId, pickupSlot, 'pending', total_price]
    );

    // Insert into order_items
    for (const item of itemsWithPrices) {
      await run(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.quantity, item.price]
      );
    }

    const createdOrder = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(createdOrder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  const { role, userId } = req.query;

  try {
    let orders: Order[] = [];
    if (role === 'admin') {
      orders = await query<Order>(`
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        ORDER BY 
          CASE o.status
            WHEN 'pending' THEN 1
            WHEN 'preparing' THEN 2
            WHEN 'ready' THEN 3
            WHEN 'completed' THEN 4
            ELSE 5
          END,
          o.pickup_slot ASC,
          o.created_at DESC
      `);
    } else if (userId) {
      orders = await query<Order>(`
        SELECT o.*, u.name as user_name, u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `, [userId]);
    } else {
      return res.status(400).json({ error: 'Missing role or userId query parameter' });
    }

    // Attach order items to each order
    const ordersWithItems = [];
    for (const order of orders) {
      const items = await query<any>(`
        SELECT oi.*, m.name, m.dietary_tag
        FROM order_items oi
        JOIN menu_items m ON oi.menu_item_id = m.id
        WHERE oi.order_id = ?
      `, [order.id]);
      ordersWithItems.push({
        ...order,
        items
      });
    }

    res.json(ordersWithItems);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'preparing', 'ready', 'completed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const order = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const updatedOrder = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [id]);
    res.json(updatedOrder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/complete-by-qr', async (req, res) => {
  const { id } = req.params;

  try {
    const order = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order ID not found' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Order is already marked as completed' });
    }

    await run("UPDATE orders SET status = 'completed' WHERE id = ?", [id]);
    const updatedOrder = await queryOne<Order>('SELECT * FROM orders WHERE id = ?', [id]);
    res.json({ message: 'Order validated and completed successfully!', order: updatedOrder });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/completed', async (req, res) => {
  try {
    // Get all completed order IDs first
    const completedOrders = await query<{ id: string }>("SELECT id FROM orders WHERE status = 'completed'");
    const completedIds = completedOrders.map(o => o.id);
    
    if (completedIds.length === 0) {
      return res.json({ message: 'No completed orders to remove.', deletedCount: 0 });
    }

    // Delete from order_items first using placeholders
    const placeholders = completedIds.map(() => '?').join(',');
    await run(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, completedIds);
    
    // Delete from orders
    const result = await run(`DELETE FROM orders WHERE status = 'completed'`);
    
    res.json({ message: 'Completed orders removed successfully!', deletedCount: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Feedback & Rating API
// ----------------------------------------------------
app.post('/api/feedback', async (req, res) => {
  const { userId, menuItemId, stars, tags, comment } = req.body;

  if (!userId || !menuItemId || !stars || !tags || !Array.isArray(tags)) {
    return res.status(400).json({ error: 'Missing userId, menuItemId, stars, or tags' });
  }

  if (stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating stars must be between 1 and 5' });
  }

  try {
    // Guardrail: feedback can only be submitted for items on the current day's menu.
    // In our system, all active items in the menu_items database represent the menu.
    const item = await queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = ?', [menuItemId]);
    if (!item) {
      return res.status(400).json({ error: 'Feedback can only be submitted for items on the current menu.' });
    }

    // Verify if user exists
    const user = await queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tagsJson = JSON.stringify(tags);
    await run(
      'INSERT INTO feedback (user_id, menu_item_id, stars, tags, comment) VALUES (?, ?, ?, ?, ?)',
      [userId, menuItemId, stars, tagsJson, comment || '']
    );

    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Analytics & Briefing API
// ----------------------------------------------------
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Top Rated Items (Average rating last 7 days)
    const topRated = await query(`
      SELECT m.id, m.name, m.category, m.dietary_tag, ROUND(AVG(f.stars), 1) as avg_rating, COUNT(f.id) as feedback_count
      FROM menu_items m
      JOIN feedback f ON m.id = f.menu_item_id
      WHERE f.created_at >= datetime('now', '-7 days')
      GROUP BY m.id
      ORDER BY avg_rating DESC, feedback_count DESC
      LIMIT 5
    `);

    // 2. High Velocity Items (Total pre-order count)
    const highVelocity = await query(`
      SELECT m.id, m.name, m.category, m.dietary_tag, SUM(oi.quantity) as order_volume
      FROM menu_items m
      JOIN order_items oi ON m.id = oi.menu_item_id
      GROUP BY m.id
      ORDER BY order_volume DESC
      LIMIT 5
    `);

    // 3. Critical Attention Items (Rating < 2.5)
    // Gather all item average ratings and check if average is below 2.5
    const criticalItemsRaw = await query<any>(`
      SELECT m.id, m.name, m.category, m.dietary_tag, ROUND(AVG(f.stars), 1) as avg_rating, COUNT(f.id) as feedback_count
      FROM menu_items m
      JOIN feedback f ON m.id = f.menu_item_id
      GROUP BY m.id
      HAVING avg_rating <= 3.0
      ORDER BY avg_rating ASC
    `);

    // For critical items, compile their tags
    const criticalItems = [];
    for (const item of criticalItemsRaw) {
      const feed = await query<{ tags: string }>('SELECT tags FROM feedback WHERE menu_item_id = ?', [item.id]);
      const tagCounts: Record<string, number> = {};
      feed.forEach(f => {
        try {
          const parsed = JSON.parse(f.tags);
          if (Array.isArray(parsed)) {
            parsed.forEach((tag: string) => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        } catch (e) {}
      });

      const topNegativeTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => `${tag} (${count})`)
        .join(', ');

      criticalItems.push({
        ...item,
        negative_tags: topNegativeTags || 'None'
      });
    }

    res.json({
      topRated,
      highVelocity,
      criticalItems
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch or generate today's briefing
app.get('/api/summary/today', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    let summary = await queryOne<DailySummary>('SELECT * FROM daily_summaries WHERE date = ?', [today]);
    if (!summary) {
      // Auto generate briefing
      console.log(`Generating brief for date: ${today}`);
      const summaryText = await generateDailyBriefing(today);
      await run('INSERT OR REPLACE INTO daily_summaries (date, summary_text) VALUES (?, ?)', [today, summaryText]);
      summary = { date: today, summary_text: summaryText, created_at: new Date().toISOString() };
    }
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Force generate summary for a specific date (for testing)
app.post('/api/summary/generate', async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  try {
    console.log(`Manually generating brief for date: ${date}`);
    const summaryText = await generateDailyBriefing(date);
    await run('INSERT OR REPLACE INTO daily_summaries (date, summary_text) VALUES (?, ?)', [date, summaryText]);
    res.json({ date, summary_text: summaryText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Fallback Background cron summary generator at 9:00 PM
// ----------------------------------------------------
// We run a check interval every hour to see if it is 9:00 PM and today's summary is generated.
setInterval(async () => {
  const now = new Date();
  // Check if current hour is 21 (9:00 PM)
  if (now.getHours() === 21) {
    const today = now.toISOString().split('T')[0];
    try {
      const summary = await queryOne<DailySummary>('SELECT * FROM daily_summaries WHERE date = ?', [today]);
      if (!summary) {
        console.log(`9:00 PM Automated Scheduler Triggered for ${today}`);
        const summaryText = await generateDailyBriefing(today);
        await run('INSERT OR REPLACE INTO daily_summaries (date, summary_text) VALUES (?, ?)', [today, summaryText]);
      }
    } catch (err) {
      console.error('Failed to run nightly automated briefing schedule:', err);
    }
  }
}, 60 * 60 * 1000); // Hourly check

// Fallback index.html route for SPA client in production
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

export default app;

if (!process.env.VERCEL) {
  // Initialize database then start server
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database. Server exiting...', err);
    });
} else {
  // On Vercel, initialize database asynchronously
  initDb().catch((err) => {
    console.error('Failed to initialize database on Vercel:', err);
  });
}

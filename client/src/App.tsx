import { useState, useEffect } from 'react';
import { 
  Utensils, 
  ShoppingBag, 
  ClipboardList, 
  Scan, 
  BarChart3, 
  Lock, 
  LogOut, 
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  Plus,
  Check,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import { StudentMenu } from './components/StudentMenu';
import { StudentTray } from './components/StudentTray';
import { FeedbackModal } from './components/FeedbackModal';
import { AdminOrders } from './components/AdminOrders';
import { AdminScanner } from './components/AdminScanner';
import { AdminAnalytics } from './components/AdminAnalytics';

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  dietary_tag: 'veg' | 'non-veg' | 'vegan';
  image_url: string;
  is_available: number;
  avg_rating?: number;
  rating_count?: number;
}

interface TrayItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

interface OrderItem {
  id: number;
  order_id: string;
  menu_item_id: number;
  quantity: number;
  price: number;
  name: string;
  dietary_tag: string;
}

interface Order {
  id: string;
  user_id: string;
  pickup_slot: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  total_price: number;
  created_at: string;
  user_name?: string;
  user_email?: string;
  items: OrderItem[];
}

function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginError, setLoginError] = useState('');

  // App shared states
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'breakfast' | 'lunch' | 'snacks' | 'dinner'>('lunch');
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Feedback Modal states
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackItemId, setFeedbackItemId] = useState<number | null>(null);
  const [feedbackItemName, setFeedbackItemName] = useState<string>('');

  // Admin Views states
  const [adminView, setAdminView] = useState<'orders' | 'scanner' | 'inventory' | 'analytics'>('orders');
  const [studentView, setStudentView] = useState<'menu' | 'orders'>('menu');
  const [briefing, setBriefing] = useState<string>('');
  const [analytics, setAnalytics] = useState({
    topRated: [],
    highVelocity: [],
    criticalItems: []
  });

  // State for Add New Item Form
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'breakfast' | 'lunch' | 'snacks' | 'dinner'>('lunch');
  const [newItemDietary, setNewItemDietary] = useState<'veg' | 'non-veg' | 'vegan'>('veg');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [formError, setFormError] = useState('');

  // State for inline price editing
  const [editingPriceItemId, setEditingPriceItemId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  const [loading, setLoading] = useState(false);

  // Initialize: Check local storage for session
  useEffect(() => {
    const savedUser = localStorage.getItem('canteen_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  // Fetch Menu
  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_URL}/menu`);
      if (res.ok) {
        const data = await res.json();
        setMenu(data);
      }
    } catch (e) {
      console.error('Error fetching menu:', e);
    }
  };

  // Fetch Orders (either all for admin, or user specific)
  const fetchOrders = async () => {
    if (!user) return;
    try {
      const url = user.role === 'admin' 
        ? `${API_URL}/orders?role=admin` 
        : `${API_URL}/orders?userId=${user.id}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    }
  };

  // Fetch Admin briefing & analytics
  const fetchAdminData = async () => {
    if (!user || user.role !== 'admin') return;
    try {
      // 1. Fetch Analytics
      const resAnal = await fetch(`${API_URL}/analytics`);
      if (resAnal.ok) {
        const data = await resAnal.json();
        setAnalytics(data);
      }
      // 2. Fetch Briefing
      const resBrief = await fetch(`${API_URL}/summary/today`);
      if (resBrief.ok) {
        const data = await resBrief.json();
        setBriefing(data.summary_text);
      }
    } catch (e) {
      console.error('Error fetching analytics/briefing:', e);
    }
  };

  // Auto poll data
  useEffect(() => {
    fetchMenu();
    
    if (user) {
      fetchOrders();
      if (user.role === 'admin') {
        fetchAdminData();
      }
    }

    const pollInterval = setInterval(() => {
      fetchMenu();
      if (user) {
        fetchOrders();
      }
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(pollInterval);
  }, [user]);

  // If a student selects an order, generate its QR code
  useEffect(() => {
    if (selectedOrder) {
      QRCode.toDataURL(selectedOrder.id, { margin: 1, width: 180 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
      
      // Update selectedOrder object when orders list changes (polls live status)
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && updated.status !== selectedOrder.status) {
        setSelectedOrder(updated);
      }
    } else {
      setQrCodeUrl('');
    }
  }, [selectedOrder, orders]);

  // Auth: handle mock login
  const handleLogin = async (role: 'student' | 'admin') => {
    if (!loginEmail.trim() || !loginName.trim()) {
      setLoginError('Please enter both name and campus email');
      return;
    }
    if (!loginEmail.includes('@')) {
      setLoginError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      const res = await fetch(`${API_URL}/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.toLowerCase().trim(),
          name: loginName.trim(),
          role
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to authenticate');
      
      setUser(data);
      localStorage.setItem('canteen_user', JSON.stringify(data));
      // Reset form
      setLoginEmail('');
      setLoginName('');
    } catch (err: any) {
      setLoginError(err.message || 'Connection error. Is backend server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTray([]);
    setOrders([]);
    setSelectedOrder(null);
    localStorage.removeItem('canteen_user');
  };

  // Student Tray Handlers
  const addToTray = (item: MenuItem) => {
    // Prevent adding if sold out
    if (item.is_available === 0) return;
    
    // Check if item is already in tray
    const existing = tray.find(t => t.menuItemId === item.id);
    if (existing) {
      setTray(tray.map(t => t.menuItemId === item.id ? { ...t, quantity: t.quantity + 1 } : t));
    } else {
      setTray([...tray, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]);
    }
  };

  const updateTrayQty = (itemId: number, change: number) => {
    const existing = tray.find(t => t.menuItemId === itemId);
    if (!existing) return;

    if (existing.quantity + change <= 0) {
      setTray(tray.filter(t => t.menuItemId !== itemId));
    } else {
      setTray(tray.map(t => t.menuItemId === itemId ? { ...t, quantity: t.quantity + change } : t));
    }
  };

  // Admin order status update
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchOrders();
        // If updating status on the active order
        if (selectedOrder && selectedOrder.id === orderId) {
          const updated = await res.json();
          setSelectedOrder(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Admin scanner validator completion
  const handleCompleteOrder = async (orderId: string) => {
    const res = await fetch(`${API_URL}/orders/${orderId}/complete-by-qr`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to complete order');
    }
    // Refresh
    fetchOrders();
    return data;
  };

  const handleToggleAvailability = async (itemId: number, currentStatus: number) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
      const res = await fetch(`${API_URL}/menu/${itemId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: newStatus })
      });
      if (res.ok) {
        fetchMenu();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePrice = async (itemId: number, priceVal: number) => {
    if (isNaN(priceVal) || priceVal < 0) {
      alert('Please enter a valid price.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/menu/${itemId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: priceVal })
      });
      if (res.ok) {
        fetchMenu();
        setEditingPriceItemId(null);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update price');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      setFormError('Please enter an item name.');
      return;
    }
    const priceVal = parseFloat(newItemPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setFormError('Please enter a valid non-negative price.');
      return;
    }
    setFormError('');
    setLoading(true);

    let imageUrl = newItemImageUrl.trim();
    if (!imageUrl) {
      const defaultImages: Record<string, string> = {
        breakfast: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80',
        lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
        snacks: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&q=80',
        dinner: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80'
      };
      imageUrl = defaultImages[newItemCategory] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80';
    }

    try {
      const res = await fetch(`${API_URL}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName.trim(),
          description: newItemDesc.trim(),
          price: priceVal,
          category: newItemCategory,
          dietary_tag: newItemDietary,
          image_url: imageUrl
        })
      });
      if (res.ok) {
        fetchMenu();
        setNewItemName('');
        setNewItemDesc('');
        setNewItemPrice('');
        setNewItemCategory('lunch');
        setNewItemDietary('veg');
        setNewItemImageUrl('');
        setIsAddingItem(false);
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to add menu item');
      }
    } catch (e: any) {
      setFormError(e.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCompleted = async () => {
    if (loading) return;
    if (!window.confirm('Are you sure you want to remove all completed orders?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/completed`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to clear completed orders');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/menu/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchMenu();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete item');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Force LLM briefing compilation
  const handleTriggerBriefing = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`${API_URL}/summary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today })
      });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data.summary_text);
        fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open feedback modal
  const handleOpenFeedback = (itemId: number, itemName: string) => {
    setFeedbackItemId(itemId);
    setFeedbackItemName(itemName);
    setFeedbackOpen(true);
  };

  // Total Tray items
  const trayCount = tray.reduce((sum, item) => sum + item.quantity, 0);
  const trayTotal = tray.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Render Login Portal
  if (!user) {
    return (
      <div className="app-container">
        <header className="app-header glass">
          <div className="logo-container">
            <Utensils className="primary" />
            <span className="logo-text">Campus Canteen</span>
          </div>
        </header>

        <div className="auth-container animate-fade-in">
          <div className="auth-card glass">
            <h2 style={{ fontSize: '24px', letterSpacing: '-0.5px' }}>Skip Canteen Queues</h2>
            <p className="auth-subtitle">
              Pre-order meals ahead of time and give quick feedback to the chef.
            </p>

            {loginError && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '8px' }}>
                {loginError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <input
                type="text"
                className="text-input"
                placeholder="Full Name"
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                disabled={loading}
              />
              <input
                type="email"
                className="text-input"
                placeholder="Campus Email (@campus.edu)"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="auth-roles-grid">
              <button
                className="auth-role-btn role-student"
                onClick={() => handleLogin('student')}
                disabled={loading}
              >
                <div className="role-icon-wrapper">
                  <ShoppingBag size={20} />
                </div>
                <div className="role-info-text">
                  <h4>Log In as Student</h4>
                  <p>View daily menus, order meals, and submit ratings.</p>
                </div>
              </button>

              <button
                className="auth-role-btn role-admin"
                onClick={() => handleLogin('admin')}
                disabled={loading}
              >
                <div className="role-icon-wrapper">
                  <Lock size={20} />
                </div>
                <div className="role-info-text">
                  <h4>Log In as Chef / Canteen Admin</h4>
                  <p>Manage pre-orders, toggle stock, and view AI briefings.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STUDENT VIEW PORTAL
  // ----------------------------------------------------
  if (user.role === 'student') {
    return (
      <div className="app-container">
        {/* Header */}
        <header className="app-header glass">
          <div className="logo-container" onClick={() => { setSelectedOrder(null); setStudentView('menu'); }} style={{ cursor: 'pointer' }}>
            <Utensils className="primary" />
            <span className="logo-text">Campus Canteen</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="user-badge" onClick={handleLogout}>
              <LogOut size={12} className="text-muted" />
              <span>Sign Out</span>
            </div>
          </div>
        </header>

        {/* Student View Selector */}
        {!selectedOrder && (
          <div style={{ display: 'flex', margin: '14px 20px 0 20px', gap: '10px' }}>
            <button
              className={`btn ${studentView === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '20px' }}
              onClick={() => setStudentView('menu')}
            >
              Order Meal
            </button>
            <button
              className={`btn ${studentView === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '20px' }}
              onClick={() => setStudentView('orders')}
            >
              My Orders ({orders.length})
            </button>
          </div>
        )}

        {/* Selected Order Status / Receipt Ticket View */}
        {selectedOrder ? (
          <div className="animate-fade-in" style={{ padding: '0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 4px 10px' }}>
              <button 
                onClick={() => setSelectedOrder(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                <ChevronLeft size={16} />
                Back to Orders
              </button>
            </div>

            <div className="ticket-container glass">
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Pickup Receipt</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Order ID: {selectedOrder.id}</p>

              {/* Status Badge */}
              <div className={`order-status-badge status-${selectedOrder.status}`}>
                {selectedOrder.status}
              </div>

              {/* Timeline Progress Bar */}
              <div className="timeline">
                <div className={`timeline-step ${['pending', 'preparing', 'ready', 'completed'].includes(selectedOrder.status) ? 'active' : ''} ${selectedOrder.status !== 'pending' ? 'completed' : ''}`}>
                  <div className="timeline-dot">1</div>
                  <span className="timeline-label">Pending</span>
                </div>
                <div className={`timeline-step ${['preparing', 'ready', 'completed'].includes(selectedOrder.status) ? 'active' : ''} ${!['pending', 'preparing'].includes(selectedOrder.status) ? 'completed' : ''}`}>
                  <div className="timeline-dot">2</div>
                  <span className="timeline-label">Kitchen</span>
                </div>
                <div className={`timeline-step ${['ready', 'completed'].includes(selectedOrder.status) ? 'active' : ''} ${selectedOrder.status === 'completed' ? 'completed' : ''}`}>
                  <div className="timeline-dot">3</div>
                  <span className="timeline-label">Ready</span>
                </div>
                <div className={`timeline-step ${selectedOrder.status === 'completed' ? 'active' : ''}`}>
                  <div className="timeline-dot">4</div>
                  <span className="timeline-label">Done</span>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeUrl && selectedOrder.status !== 'completed' ? (
                <div>
                  <div className="qr-code-wrapper">
                    <img src={qrCodeUrl} alt="Order QR code" style={{ display: 'block' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 20px' }}>
                    Show this QR code at the counter during your pickup slot (**{selectedOrder.pickup_slot}**).
                  </p>
                </div>
              ) : selectedOrder.status === 'completed' ? (
                <div style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={48} color="var(--tag-veg-text)" />
                  <p style={{ fontWeight: 600, color: 'var(--tag-veg-text)' }}>Order Claimed!</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thank you for dining with us. Hope you loved your meal.</p>
                </div>
              ) : null}

              {/* Ticket Items */}
              <div style={{ marginTop: '24px', padding: '16px 0 0 0', borderTop: '1px dashed var(--border-light)', textAlign: 'left' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Order Details</h5>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {item.name} <strong style={{ color: '#ffffff' }}>x{item.quantity}</strong>
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', borderTop: '1px solid var(--border-light)', paddingTop: '10px', marginTop: '10px' }}>
                  <span>Total Paid</span>
                  <span className="primary">${selectedOrder.total_price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : studentView === 'menu' ? (
          // Menu Screen
          <StudentMenu
            items={menu}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            tray={tray}
            addToTray={addToTray}
            updateQty={updateTrayQty}
            openFeedback={handleOpenFeedback}
          />
        ) : (
          // My Orders Screen
          <div className="animate-fade-in" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Order History</h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                You haven't placed any pre-orders today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="glass"
                    onClick={() => setSelectedOrder(order)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${
                        order.status === 'pending' ? '#fbbf24' :
                        order.status === 'preparing' ? '#60a5fa' :
                        order.status === 'ready' ? '#34d399' : '#9ca3af'
                      }`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-title)' }}>{order.id}</span>
                      <span className={`order-status-badge status-${order.status}`} style={{ margin: 0, padding: '2px 8px', fontSize: '9px' }}>
                        {order.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pickup: {order.pickup_slot}</p>
                        <p style={{ fontSize: '12px', marginTop: '2px', color: '#ffffff' }}>
                          {order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                        </p>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                        ${order.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sticky floating bottom bar for student tray */}
        {studentView === 'menu' && !selectedOrder && tray.length > 0 && (
          <div className="sticky-bottom-bar glass animate-fade-in">
            <div className="tray-info">
              <span className="tray-count">{trayCount} item{trayCount > 1 ? 's' : ''} in tray</span>
              <span className="tray-price">${trayTotal.toFixed(2)}</span>
            </div>
            <button
              className="btn btn-primary view-tray-btn"
              onClick={() => setIsTrayOpen(true)}
            >
              <span>View Tray</span>
            </button>
          </div>
        )}

        {/* Slide up checkout tray drawer */}
        <StudentTray
          isOpen={isTrayOpen}
          onClose={() => setIsTrayOpen(false)}
          tray={tray}
          updateQty={updateTrayQty}
          clearTray={() => setTray([])}
          userId={user.id}
          category={activeCategory}
          onOrderCreated={(order) => setSelectedOrder(order)}
          apiUrl={API_URL}
        />

        {/* Rating and Feedback modal dialog */}
        <FeedbackModal
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          menuItemId={feedbackItemId}
          menuItemName={feedbackItemName}
          userId={user.id}
          onSubmitSuccess={() => {
            fetchMenu(); // Re-fetch menu to update the average star counts
          }}
          apiUrl={API_URL}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // CHEF / ADMIN VIEW PORTAL
  // ----------------------------------------------------
  return (
    <div className="app-container" style={{ maxWidth: '640px' /* wider layout for admin dashboard */ }}>
      {/* Header */}
      <header className="app-header glass">
        <div className="logo-container">
          <Utensils className="primary" />
          <span className="logo-text">Canteen Chef Console</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="user-badge" onClick={handleLogout}>
            <LogOut size={12} className="text-muted" />
            <span>Sign Out</span>
          </div>
        </div>
      </header>

      {/* Admin tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', padding: '14px 20px 0 20px', gap: '8px' }}>
        <button
          className={`btn ${adminView === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 12px', fontSize: '12px', width: 'auto', flex: 1 }}
          onClick={() => setAdminView('orders')}
        >
          <ClipboardList size={14} />
          <span>Orders</span>
        </button>
        <button
          className={`btn ${adminView === 'scanner' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 12px', fontSize: '12px', width: 'auto', flex: 1 }}
          onClick={() => setAdminView('scanner')}
        >
          <Scan size={14} />
          <span>Scanner</span>
        </button>
        <button
          className={`btn ${adminView === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 12px', fontSize: '12px', width: 'auto', flex: 1 }}
          onClick={() => setAdminView('inventory')}
        >
          <Utensils size={14} />
          <span>Stock</span>
        </button>
        <button
          className={`btn ${adminView === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 12px', fontSize: '12px', width: 'auto', flex: 1 }}
          onClick={() => setAdminView('analytics')}
        >
          <BarChart3 size={14} />
          <span>Analytics</span>
        </button>
      </div>

      {/* Admin View Render */}
      {adminView === 'orders' ? (
        <AdminOrders
          orders={orders}
          onUpdateStatus={handleUpdateStatus}
          onClearCompleted={handleClearCompleted}
          loading={loading}
        />
      ) : adminView === 'scanner' ? (
        <AdminScanner
          onCompleteOrder={handleCompleteOrder}
        />
      ) : adminView === 'inventory' ? (
        // Inventory Availability Toggle View
        <div className="animate-fade-in" style={{ padding: '20px' }}>
          <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>Live Inventory Controller</h3>
              <button
                className="btn btn-primary"
                style={{ width: 'auto', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsAddingItem(!isAddingItem)}
              >
                {isAddingItem ? (
                  <>
                    <X size={12} />
                    <span>Close</span>
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    <span>Add Item</span>
                  </>
                )}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Mark items as "Sold Out" when the kitchen runs out. Changes propagate instantly to the students' menu.
            </p>
          </div>

          {isAddingItem && (
            <div className="glass animate-fade-in" style={{ padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>New Menu Item</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Item Name"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                />
                <textarea
                  className="feedback-textarea"
                  style={{ height: '60px', marginBottom: 0 }}
                  placeholder="Description"
                  value={newItemDesc}
                  onChange={e => setNewItemDesc(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    className="text-input"
                    placeholder="Price ($)"
                    step="0.01"
                    min="0"
                    value={newItemPrice}
                    onChange={e => setNewItemPrice(e.target.value)}
                  />
                  <select
                    className="text-input"
                    value={newItemCategory}
                    onChange={e => setNewItemCategory(e.target.value as any)}
                    style={{ background: 'var(--bg-primary)', color: '#ffffff', padding: '10px' }}
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="snacks">Snacks</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    className="text-input"
                    value={newItemDietary}
                    onChange={e => setNewItemDietary(e.target.value as any)}
                    style={{ background: 'var(--bg-primary)', color: '#ffffff', padding: '10px' }}
                  >
                    <option value="veg">Veg</option>
                    <option value="non-veg">Non-Veg</option>
                    <option value="vegan">Vegan</option>
                  </select>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Image URL (Optional)"
                    value={newItemImageUrl}
                    onChange={e => setNewItemImageUrl(e.target.value)}
                  />
                </div>
                {formError && (
                  <div style={{ color: '#ef4444', fontSize: '12px' }}>{formError}</div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    onClick={handleAddItem}
                    disabled={loading}
                  >
                    Save Item
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    onClick={() => {
                      setIsAddingItem(false);
                      setNewItemName('');
                      setNewItemDesc('');
                      setNewItemPrice('');
                      setFormError('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {menu.map((item) => (
              <div
                key={item.id}
                className="glass"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  opacity: item.is_available === 0 ? 0.6 : 1
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0, marginRight: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{item.category}</span>
                    <span>•</span>
                    {editingPriceItemId === item.id ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                        <span>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tempPrice}
                          onChange={e => setTempPrice(e.target.value)}
                          style={{
                            width: '60px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            padding: '2px 4px',
                            fontSize: '11px'
                          }}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdatePrice(item.id, parseFloat(tempPrice));
                            if (e.key === 'Escape') setEditingPriceItemId(null);
                          }}
                        />
                        <button
                          onClick={() => handleUpdatePrice(item.id, parseFloat(tempPrice))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--tag-veg-text)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingPriceItemId(null)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--tag-nonveg-text)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          setEditingPriceItemId(item.id);
                          setTempPrice(item.price.toString());
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          borderBottom: '1px dashed var(--text-muted)' 
                        }}
                        title="Click to edit price"
                      >
                        <span>${item.price.toFixed(2)}</span>
                        <Edit2 size={10} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleToggleAvailability(item.id, item.is_available)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: item.is_available === 1 ? 'var(--tag-veg-text)' : 'var(--tag-nonveg-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    {item.is_available === 1 ? (
                      <>
                        <span>Available</span>
                        <ToggleRight size={32} />
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#ef4444' }}>Sold Out</span>
                        <ToggleLeft size={32} />
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={loading}
                    title="Delete item"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      color: '#ef4444',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AdminAnalytics
          analytics={analytics}
          briefing={briefing}
          onRefresh={fetchAdminData}
          onTriggerBriefing={handleTriggerBriefing}
          loading={loading}
        />
      )}
    </div>
  );
}

export default App;

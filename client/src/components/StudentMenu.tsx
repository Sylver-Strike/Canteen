import React from 'react';
import { Plus, Minus, Star, Heart, Leaf } from 'lucide-react';

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

interface StudentMenuProps {
  items: MenuItem[];
  activeCategory: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  setActiveCategory: (category: 'breakfast' | 'lunch' | 'snacks' | 'dinner') => void;
  tray: TrayItem[];
  addToTray: (item: MenuItem) => void;
  updateQty: (itemId: number, change: number) => void;
  openFeedback: (itemId: number, itemName: string) => void;
}

export const StudentMenu: React.FC<StudentMenuProps> = ({
  items,
  activeCategory,
  setActiveCategory,
  tray,
  addToTray,
  updateQty,
  openFeedback
}) => {
  const filteredItems = items.filter(item => item.category === activeCategory);

  const getTrayQty = (itemId: number) => {
    const item = tray.find(t => t.menuItemId === itemId);
    return item ? item.quantity : 0;
  };

  const getDietaryIcon = (tag: string) => {
    if (tag === 'vegan') return <Leaf size={12} style={{ marginRight: '3px' }} />;
    if (tag === 'veg') return <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', marginRight: '4px' }}></span>;
    return <Heart size={10} style={{ marginRight: '3px' }} />;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '30px' }}>
      {/* Category Tabs */}
      <div className="tab-container">
        {(['breakfast', 'lunch', 'snacks', 'dinner'] as const).map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="menu-grid">
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            No items available for this meal category.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSoldOut = item.is_available === 0;
            const trayQty = getTrayQty(item.id);

            return (
              <div
                key={item.id}
                className={`menu-card glass ${isSoldOut ? 'sold-out' : ''}`}
              >
                {isSoldOut && <div className="soldout-label">SOLD OUT</div>}

                {/* Item Image */}
                <div className="item-img-wrapper">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80'}
                    alt={item.name}
                    className="item-img"
                  />
                  <div className={`item-badge badge-${item.dietary_tag}`}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {getDietaryIcon(item.dietary_tag)}
                      <span>{item.dietary_tag}</span>
                    </div>
                  </div>
                </div>

                {/* Item Details */}
                <div className="item-details">
                  <div>
                    <div className="item-title-row">
                      <h4 className="item-name">{item.name}</h4>
                      <span className="item-price">${item.price.toFixed(2)}</span>
                    </div>
                    <p className="item-desc">{item.description}</p>
                  </div>

                  <div className="item-footer-row">
                    {/* Rating display & Click to Rate */}
                    <div 
                      onClick={() => !isSoldOut && openFeedback(item.id, item.name)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        cursor: isSoldOut ? 'default' : 'pointer',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-light)'
                      }}
                      title="Click to rate this item"
                    >
                      <Star size={12} fill={item.avg_rating ? '#fbbf24' : 'none'} color={item.avg_rating ? '#fbbf24' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: item.avg_rating ? '#ffffff' : 'var(--text-muted)' }}>
                        {item.avg_rating ? item.avg_rating : 'Rate'}
                      </span>
                      {item.rating_count ? (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          ({item.rating_count})
                        </span>
                      ) : null}
                    </div>

                    {/* Add to Tray or Qty Pill */}
                    <div>
                      {isSoldOut ? (
                        <button className="btn-action-sm btn-outline" disabled style={{ fontSize: '10px', padding: '4px 8px' }}>
                          Unavailable
                        </button>
                      ) : trayQty > 0 ? (
                        <div className="qty-pill">
                          <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>
                            <Minus size={10} strokeWidth={3} />
                          </button>
                          <span className="qty-val">{trayQty}</span>
                          <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>
                            <Plus size={10} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-btn-sm"
                          onClick={() => addToTray(item)}
                          aria-label={`Add ${item.name} to tray`}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default StudentMenu;

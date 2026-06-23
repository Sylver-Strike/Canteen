import React, { useState } from 'react';
import { X, Trash2, Clock, ShieldCheck } from 'lucide-react';

interface TrayItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface StudentTrayProps {
  isOpen: boolean;
  onClose: () => void;
  tray: TrayItem[];
  updateQty: (itemId: number, change: number) => void;
  clearTray: () => void;
  userId: string;
  category: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  onOrderCreated: (order: any) => void;
  apiUrl: string;
}

const CATEGORY_SLOTS: Record<string, string[]> = {
  breakfast: ['8:00 AM - 8:15 AM', '8:15 AM - 8:30 AM', '8:30 AM - 8:45 AM', '8:45 AM - 9:00 AM'],
  lunch: ['12:15 PM - 12:30 PM', '12:30 PM - 12:45 PM', '12:45 PM - 1:00 PM', '1:00 PM - 1:15 PM', '1:15 PM - 1:30 PM'],
  snacks: ['4:15 PM - 4:30 PM', '4:30 PM - 4:45 PM', '4:45 PM - 5:00 PM', '5:00 PM - 5:15 PM'],
  dinner: ['7:15 PM - 7:30 PM', '7:30 PM - 7:45 PM', '7:45 PM - 8:00 PM', '8:00 PM - 8:15 PM', '8:15 PM - 8:30 PM']
};

export const StudentTray: React.FC<StudentTrayProps> = ({
  isOpen,
  onClose,
  tray,
  updateQty,
  clearTray,
  userId,
  category,
  onOrderCreated,
  apiUrl
}) => {
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const totalPrice = tray.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const slots = CATEGORY_SLOTS[category] || CATEGORY_SLOTS.lunch;

  const handleCheckout = async () => {
    if (!selectedSlot) {
      setError('Please select a preferred pickup time slot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          items: tray.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity
          })),
          pickupSlot: selectedSlot
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to place pre-order');
      }

      clearTray();
      onOrderCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3 style={{ fontSize: '18px' }}>Your Tray</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Review items for {category.charAt(0).toUpperCase() + category.slice(1)}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {tray.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            Your tray is empty. Add delicious meals from the menu to get started!
          </div>
        ) : (
          <div className="animate-fade-in">
            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* Item List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {tray.map((item) => (
                <div
                  key={item.menuItemId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <div>
                    <h5 style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</h5>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Qty controller */}
                    <div className="qty-pill">
                      <button className="qty-btn" onClick={() => updateQty(item.menuItemId, -1)}>
                        <X size={10} />
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.menuItemId, 1)}>
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => updateQty(item.menuItemId, -item.quantity)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Time Slot Picker */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                <Clock size={14} className="text-muted" />
                <span>Select Pickup Time Slot</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Helps us pace preparations and skip queue bottlenecks.
              </p>

              <div className="slot-grid">
                {slots.map((slot) => (
                  <div
                    key={slot}
                    className={`slot-card ${selectedSlot === slot ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <span className="slot-time">{slot}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Price Section */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                borderTop: '1px solid var(--border-light)',
                marginBottom: '20px'
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Price</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                ${totalPrice.toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearTray}
                disabled={loading}
                style={{ flex: '1', padding: '12px' }}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCheckout}
                disabled={loading}
                style={{ flex: '2', padding: '12px' }}
              >
                {loading ? 'Processing...' : 'Place Pre-Order'}
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '14px' }}>
              <ShieldCheck size={12} color="var(--tag-veg-text)" />
              <span>Campus Google Account Secured Check</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentTray;

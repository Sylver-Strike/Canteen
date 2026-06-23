import React, { useEffect, useState } from 'react';
import { Play, CheckCircle2, ChevronRight, Clock, AlertTriangle, User } from 'lucide-react';

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

interface AdminOrdersProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, newStatus: string) => Promise<void>;
  onClearCompleted?: () => Promise<void>;
  loading: boolean;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({
  orders,
  onUpdateStatus,
  onClearCompleted,
  loading
}) => {
  const [now, setNow] = useState<Date>(new Date());

  // Keep 'now' updated every 10 seconds for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Parse time slot and calculate minutes remaining until slot starts
  const getCountdown = (slot: string): { text: string; isUrgent: boolean } => {
    try {
      // Slot format: e.g. "12:30 PM - 12:45 PM"
      const startTimeStr = slot.split('-')[0].trim(); // "12:30 PM"
      const parts = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      
      if (!parts) return { text: '--', isUrgent: false };
      
      let hours = parseInt(parts[1], 10);
      const minutes = parseInt(parts[2], 10);
      const ampm = parts[3].toUpperCase();
      
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);
      
      const diffMs = targetDate.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 0) {
        // If it is within the 15-minute slot window
        if (diffMins >= -15) {
          return { text: 'Active Slot', isUrgent: true };
        }
        return { text: `Overdue (${Math.abs(diffMins)}m ago)`, isUrgent: true };
      }
      
      if (diffMins <= 15) {
        return { text: `${diffMins}m left`, isUrgent: true };
      }
      
      return { text: `${diffMins}m left`, isUrgent: false };
    } catch (e) {
      return { text: '--', isUrgent: false };
    }
  };

  const getStatusAction = (order: Order) => {
    if (order.status === 'pending') {
      return {
        label: 'Start Preparing',
        nextStatus: 'preparing',
        icon: <Play size={12} fill="currentColor" />
      };
    }
    if (order.status === 'preparing') {
      return {
        label: 'Mark Ready',
        nextStatus: 'ready',
        icon: <ChevronRight size={12} strokeWidth={2.5} />
      };
    }
    if (order.status === 'ready') {
      return {
        label: 'Complete Order',
        nextStatus: 'completed',
        icon: <CheckCircle2 size={12} />
      };
    }
    return null;
  };

  // Group orders by columns
  const columns = {
    pending: orders.filter(o => o.status === 'pending'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
    completed: orders.filter(o => o.status === 'completed').slice(0, 10) // Only show last 10 completed orders to avoid clutter
  };

  return (
    <div className="kanban-container animate-fade-in">
      {(['pending', 'preparing', 'ready', 'completed'] as const).map((status) => {
        const columnOrders = columns[status];
        const statusColors: Record<string, string> = {
          pending: '#fbbf24',
          preparing: '#60a5fa',
          ready: '#34d399',
          completed: '#9ca3af'
        };

        return (
          <div key={status} className="kanban-column glass">
            <div className="column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="column-title" style={{ display: 'flex', alignItems: 'center', color: statusColors[status] }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: statusColors[status],
                    marginRight: '6px'
                  }}
                />
                {status.toUpperCase()}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {status === 'completed' && onClearCompleted && orders.some(o => o.status === 'completed') && (
                  <button
                    onClick={onClearCompleted}
                    disabled={loading}
                    title="Clear all completed orders"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                  >
                    Clear All
                  </button>
                )}
                <span className="column-count">{columnOrders.length}</span>
              </div>
            </div>

            <div className="kanban-cards-wrapper">
              {columnOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No orders in this stage
                </div>
              ) : (
                columnOrders.map((order) => {
                  const countdown = getCountdown(order.pickup_slot);
                  const action = getStatusAction(order);

                  return (
                    <div
                      key={order.id}
                      className={`kanban-card card-${order.status}`}
                    >
                      <div className="card-top">
                        <div>
                          <span className="card-id">{order.id}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <Clock size={10} />
                            <span>{order.pickup_slot}</span>
                          </div>
                        </div>
                        
                        {order.status !== 'completed' && (
                          <div className={`countdown-timer ${countdown.isUrgent ? '' : 'safe'}`}>
                            {countdown.isUrgent && <AlertTriangle size={10} style={{ display: 'inline', marginRight: '2px', verticalAlign: 'text-top' }} />}
                            {countdown.text}
                          </div>
                        )}
                      </div>

                      {/* Items Details */}
                      <div className="card-items">
                        {order.items.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                            <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer: User & Action */}
                      <div className="card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                          <User size={10} className="text-muted" />
                          <span className="client-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {order.user_name || 'Student'}
                          </span>
                        </div>

                        {action && (
                          <button
                            className="btn-action-sm"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: statusColors[action.nextStatus],
                              color: '#000000',
                              fontWeight: 700
                            }}
                            onClick={() => onUpdateStatus(order.id, action.nextStatus)}
                            disabled={loading}
                          >
                            {action.icon}
                            <span>{action.label}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default AdminOrders;

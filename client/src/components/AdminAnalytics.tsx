import React, { useState } from 'react';
import { Star, TrendingUp, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

interface MetricItem {
  id: number;
  name: string;
  category: string;
  dietary_tag: string;
  avg_rating?: number;
  feedback_count?: number;
  order_volume?: number;
  negative_tags?: string;
}

interface AnalyticsData {
  topRated: MetricItem[];
  highVelocity: MetricItem[];
  criticalItems: MetricItem[];
}

interface AdminAnalyticsProps {
  analytics: AnalyticsData;
  briefing: string;
  onRefresh: () => void;
  onTriggerBriefing: () => Promise<void>;
  loading: boolean;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  analytics,
  briefing,
  onRefresh,
  onTriggerBriefing,
  loading
}) => {
  const [briefLoading, setBriefLoading] = useState<boolean>(false);

  const handleRegenerate = async () => {
    setBriefLoading(true);
    try {
      await onTriggerBriefing();
    } finally {
      setBriefLoading(false);
    }
  };

  // Basic parser to render Chef Briefing Markdown correctly in react
  const renderBriefingText = (text: string) => {
    if (!text) return <p>No briefings generated yet.</p>;

    return text.split('\n').map((line, idx) => {
      // Headers: e.g. "### Chef's Daily Briefing"
      if (line.startsWith('###')) {
        return <h4 key={idx} style={{ fontSize: '15px', color: '#ffffff', margin: '14px 0 8px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>{line.replace('###', '').trim()}</h4>;
      }
      // Subheaders: e.g. "**The Good News:**"
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={idx} style={{ fontWeight: 700, color: 'var(--primary)', marginTop: '10px' }}>{line.replace(/\*\*/g, '').trim()}</p>;
      }
      if (line.startsWith('**The Good News:**')) {
        return <p key={idx} style={{ fontWeight: 700, color: 'var(--tag-veg-text)', marginTop: '10px' }}>🍳 The Good News:</p>;
      }
      if (line.startsWith('**The Smoke (What to Fix):**')) {
        return <p key={idx} style={{ fontWeight: 700, color: 'var(--tag-nonveg-text)', marginTop: '10px' }}>🔥 The Smoke (What to Fix):</p>;
      }
      if (line.startsWith('**Tomorrow\'s Forecast:**')) {
        return <p key={idx} style={{ fontWeight: 700, color: '#60a5fa', marginTop: '10px' }}>🔮 Tomorrow's Forecast:</p>;
      }
      // Bullet points
      if (line.startsWith('*')) {
        // Handle bold items inside bullet points e.g. "The **Butter Chicken** was..."
        const content = line.replace(/^\*\s*/, '').trim();
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(content)) !== null) {
          // text before bold
          if (match.index > lastIndex) {
            parts.push(content.substring(lastIndex, match.index));
          }
          // bold text
          parts.push(<strong key={match.index} style={{ color: '#ffffff' }}>{match[1]}</strong>);
          lastIndex = boldRegex.lastIndex;
        }

        if (lastIndex < content.length) {
          parts.push(content.substring(lastIndex));
        }

        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '13px', margin: '6px 0', paddingLeft: '8px' }}>
            <span style={{ color: 'var(--primary)' }}>•</span>
            <span style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>
              {parts.length > 0 ? parts : content}
            </span>
          </div>
        );
      }
      // Default line
      return line.trim() ? <p key={idx} style={{ fontSize: '13px', margin: '4px 0', color: 'var(--text-muted)' }}>{line}</p> : null;
    });
  };

  return (
    <div className="analytics-section animate-fade-in">
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '18px' }}>Performance Analytics</h3>
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
          style={{ width: 'auto', padding: '8px 12px', display: 'flex', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin-slow' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 🍳 Chef's Daily Briefing Card */}
      <div className="briefing-card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--primary)" />
            Chef's Daily Briefing
          </h3>
          
          <button
            className="btn-action-sm btn-outline"
            onClick={handleRegenerate}
            disabled={briefLoading}
            style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={10} className={briefLoading ? 'animate-spin-slow' : ''} />
            <span>Regen</span>
          </button>
        </div>

        <div className="briefing-markdown">
          {briefLoading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Compiling reviews, tags, and orders for today...
            </div>
          ) : (
            renderBriefingText(briefing)
          )}
        </div>
      </div>

      {/* Top Rated Table */}
      <div className="table-wrapper glass">
        <div className="table-title" style={{ color: 'var(--tag-veg-text)' }}>
          <Star size={16} fill="currentColor" />
          <span>Top Rated (Last 7 Days)</span>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Rating</th>
              <th style={{ textAlign: 'right' }}>Reviews</th>
            </tr>
          </thead>
          <tbody>
            {analytics.topRated.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No feedback reviews submitted yet.</td>
              </tr>
            ) : (
              analytics.topRated.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{item.category}</td>
                  <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {item.avg_rating} <Star size={10} fill="currentColor" />
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.feedback_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* High Velocity Table */}
      <div className="table-wrapper glass">
        <div className="table-title" style={{ color: 'var(--primary)' }}>
          <TrendingUp size={16} />
          <span>High Velocity (Most Pre-Orders)</span>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Quantity Sold</th>
            </tr>
          </thead>
          <tbody>
            {analytics.highVelocity.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No orders placed yet.</td>
              </tr>
            ) : (
              analytics.highVelocity.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{item.category}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>{item.order_volume}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Critical Attention Table */}
      <div className="table-wrapper glass">
        <div className="table-title" style={{ color: 'var(--tag-nonveg-text)' }}>
          <AlertCircle size={16} />
          <span>Critical Attention (Rating &lt; 3.0)</span>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th style={{ textAlign: 'right' }}>Avg Rating</th>
              <th>Top Complaints</th>
            </tr>
          </thead>
          <tbody>
            {analytics.criticalItems.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--tag-veg-text)' }}>All items are performing well!</td>
              </tr>
            ) : (
              analytics.criticalItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ textAlign: 'right', color: '#f87171', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {item.avg_rating} <Star size={10} fill="currentColor" />
                    </span>
                  </td>
                  <td style={{ color: '#f87171', fontSize: '11px' }}>{item.negative_tags}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminAnalytics;

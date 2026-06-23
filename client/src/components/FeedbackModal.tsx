import React, { useState } from 'react';
import { Star, X, MessageSquare, Tag } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItemId: number | null;
  menuItemName: string;
  userId: string;
  onSubmitSuccess: () => void;
  apiUrl: string;
}

const POSITIVE_TAGS = ['Perfectly Cooked', 'Super Fresh', 'Great Portion', 'Quick Service', 'Hot & Fresh', 'Perfect Spice'];
const NEGATIVE_TAGS = ['Too Salty', 'Cold', 'Delayed', 'Oily/Greasy', 'Undercooked', 'Bland Taste', 'Small Portion'];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  menuItemId,
  menuItemName,
  userId,
  onSubmitSuccess,
  apiUrl
}) => {
  const [stars, setStars] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !menuItemId) return null;

  const handleStarClick = (rating: number) => {
    setStars(rating);
    // Clear tags that don't match the rating category
    setSelectedTags([]);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stars === 0) {
      setError('Please select a rating of 1 to 5 stars');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          menuItemId,
          stars,
          tags: selectedTags,
          comment
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Reset form
      setStars(0);
      setSelectedTags([]);
      setComment('');
      onSubmitSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const tagsToDisplay = stars >= 4 ? POSITIVE_TAGS : (stars > 0 ? NEGATIVE_TAGS : []);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3 style={{ fontSize: '18px' }}>Rate Your Meal</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{menuItemName}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Star Input */}
          <div className="star-rating-input">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`star-btn ${star <= stars ? 'filled' : ''}`}
                onClick={() => handleStarClick(star)}
              >
                <Star size={36} fill={star <= stars ? '#fbbf24' : 'none'} strokeWidth={1.5} />
              </button>
            ))}
          </div>

          {stars > 0 && (
            <div className="animate-fade-in">
              {/* Quick Tags Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                <Tag size={14} className="text-muted" />
                <span>What describes this meal best?</span>
              </div>
              <div className="tags-list-wrapper">
                {tagsToDisplay.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-pill ${selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Text comment */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ffffff', fontWeight: 600, marginBottom: '8px' }}>
                <MessageSquare size={14} className="text-muted" />
                <span>Additional comments (optional)</span>
              </div>
              <textarea
                className="feedback-textarea"
                placeholder="How was the flavor, texture, or service? Tell us more..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
export default FeedbackModal;

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RnClientFeedbackForms({ 
  hasSubmittedFeedback, 
  hasSubmittedReview,
  serviceName
}: { 
  hasSubmittedFeedback: boolean; 
  hasSubmittedReview: boolean;
  serviceName: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feedback' | 'review'>(
    !hasSubmittedFeedback ? 'feedback' : 'review'
  );

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Feedback State
  const [rating, setRating] = useState(0);
  const [npsScore, setNpsScore] = useState(10);
  const [communication, setCommunication] = useState(0);
  const [deliveryQuality, setDeliveryQuality] = useState(0);
  const [turnaroundTime, setTurnaroundTime] = useState(0);
  const [comments, setComments] = useState('');

  // Review State
  const [reviewRating, setReviewRating] = useState(0);
  const [testimonial, setTestimonial] = useState('');
  const [designation, setDesignation] = useState('');
  const [company, setCompany] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !communication || !deliveryQuality || !turnaroundTime) {
      alert('Please fill out all ratings');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/rn/client/feedback', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: serviceName,
        rating, npsScore, communication, deliveryQuality, turnaroundTime, comments
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    setLoading(false);
    if (res.ok) {
      setSuccess('Thank you for your feedback!');
      setTimeout(() => {
        setSuccess('');
        setActiveTab('review');
        router.refresh();
      }, 2000);
    } else {
      alert('Failed to submit feedback');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRating || !testimonial) {
      alert('Please provide a rating and testimonial');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/rn/client/review', {
      method: 'POST',
      body: JSON.stringify({
        rating: reviewRating, testimonial, designation, company, linkedinUrl
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    setLoading(false);
    if (res.ok) {
      setSuccess('Thank you for your testimonial!');
      setTimeout(() => {
        setSuccess('');
        router.refresh();
      }, 2000);
    } else {
      alert('Failed to submit testimonial');
    }
  };

  if (hasSubmittedFeedback && hasSubmittedReview) return null;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', marginBottom: 24, gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
        {!hasSubmittedFeedback && (
          <button 
            style={{ flex: 1, padding: '16px', fontSize: 14, fontWeight: 700, border: 'none', background: 'transparent', color: activeTab === 'feedback' ? '#22D3EE' : '#A1A1AA', borderBottom: activeTab === 'feedback' ? '2px solid #22D3EE' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('feedback')}
          >
            Project Feedback
          </button>
        )}
        {!hasSubmittedReview && (
          <button 
            style={{ flex: 1, padding: '16px', fontSize: 14, fontWeight: 700, border: 'none', background: 'transparent', color: activeTab === 'review' ? '#22D3EE' : '#A1A1AA', borderBottom: activeTab === 'review' ? '2px solid #22D3EE' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setActiveTab('review')}
          >
            Public Testimonial
          </button>
        )}
      </div>

      <div style={{ padding: 24 }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#22c55e', fontWeight: 700 }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>✓</span>
            {success}
          </div>
        ) : activeTab === 'feedback' && !hasSubmittedFeedback ? (
          <form onSubmit={submitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#F4F5FA' }}>How did we do?</h3>
              <p style={{ fontSize: 14, color: '#A1A1AA', margin: 0 }}>Your feedback helps us improve. It will remain internal.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Overall Rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>How likely to recommend us? (NPS)</label>
                <input type="range" min="0" max="10" value={npsScore} onChange={e => setNpsScore(parseInt(e.target.value))} style={{ width: '100%' }} />
                <div style={{ fontSize: 12, color: '#A1A1AA', textAlign: 'center', fontWeight: 700, marginTop: 4 }}>{npsScore} / 10</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Communication</label>
                <StarRating value={communication} onChange={setCommunication} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Delivery Quality</label>
                <StarRating value={deliveryQuality} onChange={setDeliveryQuality} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Turnaround Time</label>
                <StarRating value={turnaroundTime} onChange={setTurnaroundTime} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Additional Comments</label>
              <textarea 
                value={comments} onChange={e => setComments(e.target.value)} 
                style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F4F5FA', outline: 'none', resize: 'vertical' }} rows={3}
                placeholder="What did you like? What can we improve?"
              />
            </div>

            <button disabled={loading} type="submit" style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        ) : activeTab === 'review' && !hasSubmittedReview ? (
          <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#F4F5FA' }}>Share your experience</h3>
              <p style={{ fontSize: 14, color: '#A1A1AA', margin: 0 }}>Leave a public testimonial to help others discover our services.</p>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Rating</label>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Your Testimonial</label>
              <textarea 
                value={testimonial} onChange={e => setTestimonial(e.target.value)} 
                style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F4F5FA', outline: 'none', resize: 'vertical' }} rows={4}
                placeholder="Write your review here..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Designation</label>
                <input value={designation} onChange={e => setDesignation(e.target.value)} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F4F5FA', outline: 'none' }} placeholder="e.g. Software Engineer" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F4F5FA', outline: 'none' }} placeholder="e.g. Google" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A1A1AA', marginBottom: 4 }}>LinkedIn Profile URL</label>
                <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F4F5FA', outline: 'none' }} placeholder="https://linkedin.com/in/..." />
              </div>
            </div>

            <button disabled={loading} type="submit" style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #7C5CFF, #22D3EE)', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Submitting...' : 'Submit Testimonial'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button 
          key={star} 
          type="button" 
          onClick={() => onChange(star)}
          style={{ fontSize: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: star <= value ? '#facc15' : 'rgba(255,255,255,0.1)' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

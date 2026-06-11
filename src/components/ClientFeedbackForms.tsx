'use client';

import { useState } from 'react';

export function ClientFeedbackForms({ 
  hasSubmittedFeedback, 
  hasSubmittedReview,
  onSubmitted 
}: { 
  hasSubmittedFeedback: boolean; 
  hasSubmittedReview: boolean;
  onSubmitted: () => void;
}) {
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
    const res = await fetch('/api/career/portal/feedback', {
      method: 'POST',
      body: JSON.stringify({
        serviceType: 'Career Booster',
        rating, npsScore, communication, deliveryQuality, turnaroundTime, comments
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    setLoading(false);
    if (res.ok) {
      setSuccess('Thank you for your feedback!');
      setTimeout(() => {
        setSuccess('');
        onSubmitted();
        setActiveTab('review');
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
    const res = await fetch('/api/career/portal/review', {
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
        onSubmitted();
      }, 2000);
    } else {
      alert('Failed to submit testimonial');
    }
  };

  if (hasSubmittedFeedback && hasSubmittedReview) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      <div className="flex border-b border-slate-100 bg-slate-50">
        {!hasSubmittedFeedback && (
          <button 
            className={`flex-1 py-3 text-sm font-bold ${activeTab === 'feedback' ? 'text-[#B8935B] border-b-2 border-[#B8935B]' : 'text-slate-500'}`}
            onClick={() => setActiveTab('feedback')}
          >
            Project Feedback
          </button>
        )}
        {!hasSubmittedReview && (
          <button 
            className={`flex-1 py-3 text-sm font-bold ${activeTab === 'review' ? 'text-[#B8935B] border-b-2 border-[#B8935B]' : 'text-slate-500'}`}
            onClick={() => setActiveTab('review')}
          >
            Public Testimonial
          </button>
        )}
      </div>

      <div className="p-6">
        {success ? (
          <div className="text-center py-8 text-emerald-600 font-bold">
            <span className="text-4xl block mb-2">✓</span>
            {success}
          </div>
        ) : activeTab === 'feedback' && !hasSubmittedFeedback ? (
          <form onSubmit={submitFeedback} className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">How did we do?</h3>
            <p className="text-sm text-slate-500 mb-4">Your feedback helps us improve our services. It will remain internal.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Overall Rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">How likely to recommend us? (NPS)</label>
                <input type="range" min="0" max="10" value={npsScore} onChange={e => setNpsScore(parseInt(e.target.value))} className="w-full accent-[#B8935B]" />
                <div className="text-xs text-slate-500 text-center font-bold mt-1">{npsScore} / 10</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Communication</label>
                <StarRating value={communication} onChange={setCommunication} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Quality</label>
                <StarRating value={deliveryQuality} onChange={setDeliveryQuality} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Turnaround Time</label>
                <StarRating value={turnaroundTime} onChange={setTurnaroundTime} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Additional Comments</label>
              <textarea 
                value={comments} onChange={e => setComments(e.target.value)} 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm" rows={3}
                placeholder="What did you like? What can we improve?"
              />
            </div>

            <button disabled={loading} type="submit" className="w-full py-2 bg-[#B8935B] text-white rounded-lg font-bold hover:bg-[#9A7540] disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        ) : activeTab === 'review' && !hasSubmittedReview ? (
          <form onSubmit={submitReview} className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Share your experience</h3>
            <p className="text-sm text-slate-500 mb-4">Leave a public testimonial to help others discover our services.</p>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rating</label>
              <StarRating value={reviewRating} onChange={setReviewRating} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Testimonial</label>
              <textarea 
                value={testimonial} onChange={e => setTestimonial(e.target.value)} 
                className="w-full p-2 border border-slate-200 rounded-lg text-sm" rows={4}
                placeholder="Write your review here..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <input value={designation} onChange={e => setDesignation(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. Software Engineer" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. Google" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn Profile URL</label>
                <input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" placeholder="https://linkedin.com/in/..." />
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full py-2 bg-[#B8935B] text-white rounded-lg font-bold hover:bg-[#9A7540] disabled:opacity-50">
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
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button 
          key={star} 
          type="button" 
          onClick={() => onChange(star)}
          className={`text-2xl focus:outline-none ${star <= value ? 'text-amber-400' : 'text-slate-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

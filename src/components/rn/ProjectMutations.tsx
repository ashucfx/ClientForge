'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MessageInput({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      setContent('');
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--obsidian)' }}>
      <input 
        type="text" 
        placeholder="Type a message to the client or team..." 
        className="input" 
        style={{ width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={loading}
      />
    </div>
  );
}

export function AdvanceStageButton({ projectId, currentStage, allStages }: { projectId: string, currentStage: string, allStages: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const currentIndex = allStages.indexOf(currentStage);
  const nextStage = currentIndex >= 0 && currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;

  if (!nextStage) return null;

  const handleAdvance = async () => {
    if (!confirm(`Are you sure you want to advance the project to ${nextStage.replace(/_/g, ' ')}?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage: nextStage })
      });
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleAdvance} disabled={loading} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12 }}>
      {loading ? 'Advancing...' : `Advance to ${nextStage.replace(/_/g, ' ')}`}
    </button>
  );
}

export function UploadDeliverableButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    // In a real implementation, this would open a Cloudinary widget.
    // For this demonstration, we'll simulate an upload.
    const label = prompt('Enter deliverable name (e.g. Wireframes.pdf):');
    if (!label) return;

    setLoading(true);
    try {
      await fetch(`/api/rn/projects/${projectId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label, 
          fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          publicId: `mock_${Date.now()}`,
          fileType: 'image',
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
          fileCategory: 'client-review'
        })
      });
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleUpload} disabled={loading} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600 }}>
      {loading ? 'Uploading...' : '+ Add Deliverable'}
    </button>
  );
}

'use client';

import { useState, useRef } from 'react';

interface Pin {
  x: number;
  y: number;
  comment: string;
}

export function DeliverableViewer({
  fileUrl,
  fileId,
  fileName,
  onClose,
  onSubmitAnnotation
}: {
  fileUrl: string;
  fileId: string;
  fileName: string;
  onClose: () => void;
  onSubmitAnnotation: (x: number, y: number, comment: string) => Promise<void>;
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activePin) return; // already drafting a pin
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setActivePin({ x, y });
  };

  const handleSavePin = async () => {
    if (!activePin || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await onSubmitAnnotation(activePin.x, activePin.y, commentText);
      setPins([...pins, { x: activePin.x, y: activePin.y, comment: commentText }]);
      setActivePin(null);
      setCommentText('');
    } catch (e) {
      console.error(e);
      alert('Failed to save annotation.');
    } finally {
      setSubmitting(false);
    }
  };

  const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#121214] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#27272A] bg-black">
        <div className="text-white font-medium">{fileName}</div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">Click anywhere on the image to drop a pin.</span>
          <button onClick={onClose} className="px-3 py-1.5 bg-[#27272A] text-white text-xs rounded hover:bg-[#3F3F46]">Close</button>
        </div>
      </div>

      {/* Viewer Area */}
      <div className="flex-1 overflow-auto relative flex justify-center items-start p-8 bg-[#09090b]">
        {isImage ? (
          <div className="relative inline-block shadow-2xl cursor-crosshair">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={fileUrl} 
              alt={fileName} 
              className="max-w-[1200px] w-full h-auto object-contain bg-white" 
              onClick={handleImageClick}
            />
            
            {/* Render Saved Pins */}
            {pins.map((p, i) => (
              <div 
                key={i} 
                className="absolute w-6 h-6 bg-[#B8935B] rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                title={p.comment}
              >
                {i + 1}
              </div>
            ))}

            {/* Render Active Pin input */}
            {activePin && (
              <div 
                className="absolute z-20 flex flex-col gap-2 p-3 bg-white rounded-lg shadow-2xl w-[260px]"
                style={{ left: `${activePin.x}%`, top: `${activePin.y}%`, transform: 'translate(-50%, 12px)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white" />
                <textarea 
                  className="w-full text-sm text-slate-800 p-2 border border-slate-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-[#B8935B]"
                  rows={3}
                  placeholder="Leave a comment here..."
                  autoFocus
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setActivePin(null); setCommentText(''); }} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                  <button onClick={handleSavePin} disabled={submitting || !commentText.trim()} className="px-3 py-1 text-xs text-white bg-[#B8935B] rounded hover:bg-[#9A7540] disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save Pin'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>Annotation is currently only supported for image files.</p>
            <a href={fileUrl} target="_blank" className="mt-4 px-4 py-2 bg-[#27272A] text-white text-sm rounded hover:bg-[#3F3F46]">Open File in New Tab</a>
          </div>
        )}
      </div>
    </div>
  );
}

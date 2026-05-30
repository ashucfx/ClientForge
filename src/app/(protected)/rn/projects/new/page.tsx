'use client';
import { useState, useEffect } from 'react';
import { RippleNexusShell } from '@/components/shells/RippleNexusShell';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RnNewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<{ id: string, name: string }[]>([]);
  
  const [formData, setFormData] = useState({
    clientName: '',
    companyName: '',
    email: '',
    serviceModuleId: '',
    budget: '',
    expectedDeliveryAt: '',
  });

  useEffect(() => {
    // Fetch available service modules for the dropdown
    fetch('/api/rn/services')
      .then(r => r.json())
      .then(data => {
        if (data.services) setServices(data.services);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/rn/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok && data.project) {
        router.push(`/rn/projects/${data.project.id}`);
      } else {
        alert(data.error || 'Failed to create project');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <RippleNexusShell>
      <main className="page-body" style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto' }}>
        
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <Link href="/rn/projects" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Projects</Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="rn-title-xl">Provision Workspace</h1>
          <p className="rn-subtitle" style={{ marginTop: 8 }}>Create a new project workspace and initialize the delivery pipeline.</p>
        </div>

        <form onSubmit={handleSubmit} className="rn-panel" style={{ padding: 32 }}>
          
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 24 }}>Client Details</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Primary Contact Name *</label>
              <input 
                type="text" required 
                className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
                value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Contact Email *</label>
              <input 
                type="email" required 
                className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>
          
          <div style={{ marginBottom: 40 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Company Name (Optional)</label>
            <input 
              type="text" 
              className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
              value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})}
            />
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 24 }}>Project Configuration</h2>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Service Blueprint (Workflow) *</label>
            <select 
              required 
              className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, appearance: 'none', background: 'var(--obsidian-soft)' }}
              value={formData.serviceModuleId} onChange={e => setFormData({...formData, serviceModuleId: e.target.value})}
            >
              <option value="">Select a blueprint...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Project Budget (INR)</label>
              <input 
                type="number" 
                className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
                placeholder="e.g. 50000"
                value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Expected Deadline</label>
              <input 
                type="date" 
                className="input" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}
                value={formData.expectedDeliveryAt} onChange={e => setFormData({...formData, expectedDeliveryAt: e.target.value})}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <button type="button" onClick={() => router.back()} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8 }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 8, fontWeight: 600 }}>
              {loading ? 'Provisioning...' : 'Provision Workspace'}
            </button>
          </div>

        </form>

      </main>
    </RippleNexusShell>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { useBrand } from '@/components/BrandProvider';
import { IconInbox, IconUser } from '@/components/Icons';

export default function FlywheelLeadsPage() {
  const { activeBrand } = useBrand();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContacts();
  }, [activeBrand]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/flywheel/leads?brandId=${activeBrand}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch leads', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const leads = results.data.map((row: any) => ({
            name: row.Name || row.name || row.First_Name || 'Unknown',
            email: row.Email || row.email || row.Email_Address || '',
            phone: row.Phone || row.phone || ''
          })).filter(l => l.email || l.phone);

          const res = await fetch('/api/admin/flywheel/leads/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads, brandId: activeBrand })
          });

          const data = await res.json();
          if (data.success) {
            setImportResult(`Successfully imported ${data.importedCount} new leads (${data.existingCount} updated).`);
            fetchContacts();
          } else {
            setImportResult(`Error: ${data.error}`);
          }
        } catch (error) {
          setImportResult('An error occurred during import.');
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: () => {
        setImportResult('Failed to parse CSV.');
        setImporting(false);
      }
    });
  };

  return (
    <main style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Audience & Leads</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Manage your CRM contacts and import external leads into Flywheel.</p>
        </div>
        <div>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, 
              background: '#10B981', color: 'white', 
              padding: '10px 20px', borderRadius: 8, 
              fontWeight: 600, border: 'none', cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            <IconInbox size={18} />
            {importing ? 'Processing...' : 'Import CSV'}
          </button>
        </div>
      </div>

      {importResult && (
        <div style={{ padding: 16, background: '#ECFDF5', color: '#065F46', borderRadius: 8, marginBottom: 20, border: '1px solid #A7F3D0' }}>
          {importResult}
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Name</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Email</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading leads...</td></tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <IconUser size={48} style={{ opacity: 0.2, marginBottom: 16, display: 'block', margin: '0 auto' }} />
                  No leads found. Import a CSV to get started.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 500, color: 'var(--text)' }}>{contact.name}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{contact.email || '-'}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ background: '#F3F4F6', color: '#374151', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {contact.flywheelProfile?.lifecycleStage || 'LEAD'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>{contact.contactSource}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

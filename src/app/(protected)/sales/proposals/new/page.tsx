"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProposalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Minimal state for demo purposes
  const [formData, setFormData] = useState({
    inquiryId: "", // In a real app, this would be selected from a dropdown or passed via query param
    title: "Enterprise Custom Package",
    scopeSummary: "Comprehensive overhaul of executive branding materials.",
    subtotal: 5000,
    discount: 500,
    tax: 450,
    total: 4950,
    currency: "USD",
    currencySymbol: "$",
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/admin/sales/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          deliverables: [
            { name: "Executive Resume", description: "ATS-optimized resume" },
            { name: "LinkedIn Revamp", description: "Full profile rewrite" }
          ],
          lineItems: [
            { description: "Resume Writing", unitPrice: 2500, qty: 1, lineTotal: 2500 },
            { description: "LinkedIn Optimization", unitPrice: 2500, qty: 1, lineTotal: 2500 }
          ],
          revisionLimits: { "Resume": 2, "LinkedIn": 1 },
          deliveryTimeline: { "EstimatedDays": 10, "Description": "10 business days from payment" }
        }),
      });
      
      if (res.ok) {
        router.push("/sales/proposals");
      } else {
        const error = await res.json();
        alert(`Failed to create: ${error.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Proposal</h1>
        <p className="text-muted-foreground mt-2">Build a custom package and generate a checkout link.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Proposal Title</label>
            <input 
              required
              className="w-full p-2 border rounded-md"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Valid Until</label>
            <input 
              type="date"
              required
              className="w-full p-2 border rounded-md"
              value={formData.validUntil}
              onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Scope Summary</label>
          <textarea 
            required
            className="w-full p-2 border rounded-md h-24"
            value={formData.scopeSummary}
            onChange={(e) => setFormData({...formData, scopeSummary: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <label className="text-sm font-medium">Subtotal</label>
            <input 
              type="number" required className="w-full p-2 border rounded-md"
              value={formData.subtotal}
              onChange={(e) => setFormData({...formData, subtotal: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Discount</label>
            <input 
              type="number" required className="w-full p-2 border rounded-md"
              value={formData.discount}
              onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tax</label>
            <input 
              type="number" required className="w-full p-2 border rounded-md"
              value={formData.tax}
              onChange={(e) => setFormData({...formData, tax: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Total</label>
            <input 
              type="number" required className="w-full p-2 border rounded-md bg-gray-50"
              value={formData.total}
              onChange={(e) => setFormData({...formData, total: Number(e.target.value)})}
            />
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-4">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Creating..." : "Create & Save Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

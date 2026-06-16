"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/sales/proposals")
      .then((res) => res.json())
      .then((data) => {
        setProposals(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proposal Center</h1>
          <p className="text-muted-foreground mt-2">
            Manage custom proposals, pricing, and enterprise checkouts.
          </p>
        </div>
        <Link
          href="/sales/proposals/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition"
        >
          Create Proposal
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900">No proposals yet</h3>
            <p className="text-gray-500 mt-2">Get started by creating your first custom proposal.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-900">Title</th>
                <th className="px-6 py-4 font-medium text-gray-900">Client</th>
                <th className="px-6 py-4 font-medium text-gray-900">Total</th>
                <th className="px-6 py-4 font-medium text-gray-900">Status</th>
                <th className="px-6 py-4 font-medium text-gray-900">Created</th>
                <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {proposals.map((proposal) => (
                <tr key={proposal.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{proposal.title}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {proposal.inquiry?.name} <br />
                    <span className="text-xs text-gray-400">{proposal.inquiry?.email}</span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {proposal.currencySymbol}{proposal.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${proposal.status === "ACCEPTED" ? "bg-green-100 text-green-800" :
                        proposal.status === "DRAFT" ? "bg-gray-100 text-gray-800" :
                        proposal.status === "SENT" ? "bg-blue-100 text-blue-800" :
                        "bg-yellow-100 text-yellow-800"}`}
                    >
                      {proposal.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {format(new Date(proposal.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link
                      href={`/proposal/${proposal.publicToken}`}
                      target="_blank"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                    <button className="text-gray-400 hover:text-gray-600">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

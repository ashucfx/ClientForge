import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRnAdmin } from '@/lib/auth/rnAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BLUEPRINT_DATA: Record<string, string[]> = {
  "AI & Agent Development": ["Custom AI Agents", "Internal Knowledge AI", "Customer Support AI", "AI Sales Assistants", "Voice AI Agents", "Multi-Agent Systems"],
  "AI Workflow Automation": ["n8n Automation", "Make.com", "Zapier", "CRM Automation", "HR Automation", "Finance Automation", "Lead Routing", "Document Processing"],
  "Custom Software Development": ["SaaS Platforms", "Enterprise Software", "Dashboards", "Admin Panels", "Internal Tools", "ERP Modules", "CRM Development"],
  "Web Development": ["Corporate Websites", "Startup Websites", "Landing Pages", "E-commerce", "CMS", "Headless Websites"],
  "Mobile App Development": ["Android", "iOS", "Flutter", "React Native", "Enterprise Apps", "AI Business Services"],
  "AI Consulting": ["AI Strategy", "AI Roadmap", "AI Adoption", "AI Audits", "AI Readiness Assessment"],
  "Business Process Automation": ["Invoice Automation", "Approval Workflows", "HR Automation", "Employee Onboarding", "Procurement Automation"],
  "Chatbot Development": ["Website Chatbots", "WhatsApp AI", "Messenger AI", "Slack Bots", "Teams Bots"],
  "Cloud Solutions": ["AWS", "Azure", "Google Cloud", "Server Migration", "Infrastructure Setup"],
  "DevOps": ["CI/CD", "Docker", "Kubernetes", "Monitoring", "Security"],
  "Business Intelligence": ["Power BI", "Looker Studio", "Tableau", "Executive Dashboards", "KPI Dashboards"],
  "Data Engineering": ["Data Warehouses", "ETL Pipelines", "API Integrations", "Analytics Platforms"],
  "UI/UX Design": ["Product Design", "SaaS Design", "Mobile UI", "Dashboard Design", "Design Systems"],
  "Branding": ["Brand Identity", "Logo Design", "Brand Guidelines", "Marketing Assets"],
  "AI Search Optimization (AEO/GEO)": ["ChatGPT Visibility", "Perplexity Optimization", "Gemini Optimization", "Claude Optimization", "AI Content Strategy"],
  "SEO": ["Technical SEO", "Local SEO", "Enterprise SEO"],
  "Performance Marketing": ["Google Ads", "Meta Ads", "LinkedIn Ads", "Conversion Optimization"],
  "Security Services": ["Security Audits", "Penetration Testing", "Compliance", "Vulnerability Assessment"],
  "Startup Launch Package": ["MVP Development", "Product Strategy", "UI/UX", "Landing Page", "Investor Pitch Deck", "Technical Consulting"],
  "Digital Transformation": ["Legacy Modernization", "Enterprise Automation", "AI Integration", "System Integration", "Process Re-engineering"],
  "Ripple Nexus Product Development": ["ClientForge (Client Portal & CRM)", "TaxSentry", "KaaryaFlow", "HR Management SaaS", "AI Helpdesk", "AI Sales CRM", "AI Knowledge Base", "Invoice Management", "Workflow Automation Platform"]
};

function getMilestones(category: string) {
  const isAI = category.includes('AI') || category.includes('Agent') || category.includes('Chatbot');
  const isDesign = category.includes('Design') || category.includes('Branding') || category.includes('UI');
  const isMarketing = category.includes('Marketing') || category.includes('SEO') || category.includes('AEO');
  const isCloud = category.includes('Cloud') || category.includes('DevOps') || category.includes('Security');

  if (isAI) return [
    { title: 'Discovery & Requirements', description: 'Gather business goals and define AI architecture.', order: 1, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Business Goal Analysis', 'Data Assessment', 'Solution Architecture'] },
    { title: 'Model Development', description: 'Build, train and iterate on the AI model.', order: 2, estimatedDurationDays: 21, paymentPercentage: 40, tasks: ['Model Training', 'Integration Development', 'API Setup'] },
    { title: 'Testing & Deployment', description: 'QA, safety testing and production launch.', order: 3, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Performance Testing', 'Safety Evaluation', 'Production Deployment'] },
  ];
  if (isDesign) return [
    { title: 'Brand Discovery', description: 'Understand brand identity, audience and positioning.', order: 1, estimatedDurationDays: 5, paymentPercentage: 30, tasks: ['Brand Questionnaire', 'Competitor Analysis', 'Mood Board'] },
    { title: 'Design & Iteration', description: 'Create design concepts and iterate with client.', order: 2, estimatedDurationDays: 14, paymentPercentage: 40, tasks: ['Initial Concepts', 'Client Feedback Round 1', 'Refinement'] },
    { title: 'Final Delivery', description: 'Deliver all final design assets.', order: 3, estimatedDurationDays: 3, paymentPercentage: 30, tasks: ['Asset Export', 'Brand Guidelines Doc', 'File Handover'] },
  ];
  if (isMarketing) return [
    { title: 'Audit & Strategy', description: 'Audit current state and define marketing strategy.', order: 1, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Current State Audit', 'Keyword/Audience Research', 'Campaign Strategy'] },
    { title: 'Execution', description: 'Implement campaigns and create content.', order: 2, estimatedDurationDays: 21, paymentPercentage: 40, tasks: ['Campaign Setup', 'Content Creation', 'Ad Management'] },
    { title: 'Reporting & Optimization', description: 'Analyze results and optimize for performance.', order: 3, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Performance Report', 'A/B Test Analysis', 'Strategy Refinement'] },
  ];
  if (isCloud) return [
    { title: 'Infrastructure Assessment', description: 'Assess existing setup and plan cloud architecture.', order: 1, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Current Infrastructure Review', 'Architecture Design', 'Security Planning'] },
    { title: 'Implementation', description: 'Deploy and configure cloud infrastructure.', order: 2, estimatedDurationDays: 14, paymentPercentage: 40, tasks: ['Environment Setup', 'Service Configuration', 'CI/CD Pipeline'] },
    { title: 'Handover & Monitoring', description: 'Final testing, documentation and monitoring setup.', order: 3, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Load Testing', 'Monitoring Setup', 'Documentation & Handover'] },
  ];
  // Default: Software/Web
  return [
    { title: 'Discovery & Planning', description: 'Requirements gathering, scoping and project planning.', order: 1, estimatedDurationDays: 7, paymentPercentage: 30, tasks: ['Requirements Documentation', 'Technical Architecture', 'Project Plan'] },
    { title: 'Development', description: 'Full development and internal testing phase.', order: 2, estimatedDurationDays: 21, paymentPercentage: 40, tasks: ['Core Development', 'Code Review', 'Internal QA'] },
    { title: 'QA & Deployment', description: 'User acceptance testing and final production deployment.', order: 3, estimatedDurationDays: 10, paymentPercentage: 30, tasks: ['UAT (User Acceptance Testing)', 'Production Deployment', 'Handoff & Training'] },
  ];
}

export async function POST(req: Request) {
  try {
    const admin = await requireRnAdmin();
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN only' }, { status: 403 });
    }

    // Wipe existing templates first
    await prisma.rnServiceTemplate.deleteMany({});

    let totalCount = 0;
    const results: string[] = [];

    for (const [category, services] of Object.entries(BLUEPRINT_DATA)) {
      const milestones = getMilestones(category);
      for (const serviceName of services) {
        await prisma.rnServiceTemplate.create({
          data: {
            name: serviceName,
            category,
            description: `Comprehensive ${serviceName} services tailored for enterprise clients.`,
            pricingModel: 'FIXED',
            baseCurrency: 'INR',
            taxRate: 0,
            isActive: true,
            milestoneTemplates: {
              create: milestones.map(m => ({
                title: m.title,
                description: m.description,
                order: m.order,
                estimatedDurationDays: m.estimatedDurationDays,
                paymentPercentage: m.paymentPercentage,
                taskTemplates: {
                  create: m.tasks.map(t => ({
                    title: t,
                    priority: 'HIGH',
                    estimatedHours: 5
                  }))
                }
              }))
            }
          }
        });
        totalCount++;
        results.push(`[${category}] ${serviceName}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      seeded: totalCount,
      message: `Successfully seeded ${totalCount} service blueprints into the production database.`,
      blueprints: results
    });
  } catch (err: any) {
    console.error('[seed-templates] Error:', err);
    return NextResponse.json({ error: err.message || 'Seed failed' }, { status: 500 });
  }
}

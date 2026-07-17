import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = {
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

// Define standard milestones based on category
function getMilestonesForCategory(category: string) {
  const consultingCategories = ["AI Consulting", "Security Services"];
  const marketingCategories = ["Branding", "AI Search Optimization (AEO/GEO)", "SEO", "Performance Marketing"];
  
  if (consultingCategories.includes(category)) {
    return [
      {
        title: "Discovery & Assessment",
        description: "Initial audit, gap analysis, and requirements gathering.",
        order: 1,
        estimatedDurationDays: 7,
        paymentPercentage: 30,
        tasks: ["Initial Audit", "Gap Analysis Document", "Stakeholder Interviews"]
      },
      {
        title: "Strategy & Roadmap Formulation",
        description: "Developing the comprehensive strategy and actionable roadmap.",
        order: 2,
        estimatedDurationDays: 14,
        paymentPercentage: 40,
        tasks: ["Draft Strategy Document", "Review with Client", "Finalize Roadmap"]
      },
      {
        title: "Delivery & Final Review",
        description: "Final presentation and handover of all materials.",
        order: 3,
        estimatedDurationDays: 7,
        paymentPercentage: 30,
        tasks: ["Final Presentation", "Handover Documentation"]
      }
    ];
  } else if (marketingCategories.includes(category)) {
    return [
      {
        title: "Research & Strategy Setup",
        description: "Competitor analysis, keyword research, and campaign planning.",
        order: 1,
        estimatedDurationDays: 7,
        paymentPercentage: 50,
        tasks: ["Competitor Analysis", "Keyword/Target Audience Research", "Strategy Briefing"]
      },
      {
        title: "Execution & Optimization",
        description: "Implementing the strategy and running the campaigns.",
        order: 2,
        estimatedDurationDays: 30,
        paymentPercentage: 50,
        tasks: ["Asset Creation", "Campaign Launch", "Continuous Optimization"]
      }
    ];
  } else {
    // Default for Development / Engineering / Automation
    return [
      {
        title: "Requirements & Architecture",
        description: "Defining the scope, technical architecture, and UI/UX.",
        order: 1,
        estimatedDurationDays: 10,
        paymentPercentage: 30,
        tasks: ["Requirement Gathering", "UI/UX Wireframing", "Architecture Planning"]
      },
      {
        title: "Core Implementation",
        description: "Building the core functionality and backend systems.",
        order: 2,
        estimatedDurationDays: 20,
        paymentPercentage: 40,
        tasks: ["Backend Infrastructure Setup", "Frontend / Core Logic Build", "Internal Testing"]
      },
      {
        title: "QA & Deployment",
        description: "User acceptance testing and final production deployment.",
        order: 3,
        estimatedDurationDays: 10,
        paymentPercentage: 30,
        tasks: ["UAT (User Acceptance Testing)", "Production Deployment", "Handoff & Training"]
      }
    ];
  }
}

async function main() {
  console.log("🔥 Starting seed script for Ripple Nexus Service Blueprints...");
  
  // Wipe existing templates
  console.log("🧹 Wiping existing RnServiceTemplate records...");
  await prisma.rnServiceTemplate.deleteMany({});
  console.log("✅ Wiped successfully.");

  let totalCount = 0;

  for (const [category, services] of Object.entries(data)) {
    for (const serviceName of services) {
      
      const milestones = getMilestonesForCategory(category);
      
      const createdTemplate = await prisma.rnServiceTemplate.create({
        data: {
          name: serviceName,
          category: category,
          description: `Comprehensive ${serviceName} services tailored for enterprise clients.`,
          pricingModel: "FIXED",
          baseCurrency: "USD",
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
                  priority: "HIGH",
                  estimatedHours: 5
                }))
              }
            }))
          }
        }
      });
      totalCount++;
      console.log(`✨ Created: [${category}] ${serviceName}`);
    }
  }

  console.log(`\n🎉 Successfully seeded ${totalCount} service blueprints!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};

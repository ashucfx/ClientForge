// src/lib/career/forms.ts
// Form schemas matching the official Google Forms shared with clients

import type { FormSchema, CareerPackage, FormType } from './types';
import { PACKAGE_FORMS } from './types';

export const DEFAULT_FORM_SCHEMAS: Record<FormType, FormSchema> = {

  // ── Career Information Form (Resume + Cover Letter intake) ─────────────────
  resume: {
    formType: 'resume',
    title: 'Career Information Form',
    description:
      'Please fill out this form to provide the necessary details for your resume writing, LinkedIn profile optimisation, and cover letter writing services. Your responses will help us tailor these documents to best reflect your career goals, experiences, and professional image.\n\nIf you have any questions, feel free to reach out at info@theripplenexus.com',
    disclaimer:
      'By submitting this form you confirm all information is accurate and you have the right to share it. Ripple Nexus will use this information solely to provide your purchased Career Booster Services.',
    fields: [
      // ── Contact Information ──
      {
        id: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        placeholder: 'Your full name as it should appear on your resume',
        hint: 'Please provide your full name as you would like it to appear on your resume and LinkedIn profile.',
        section: 'Contact Information',
      },
      {
        id: 'email',
        label: 'Email Address',
        type: 'text',
        required: true,
        placeholder: 'your@email.com',
        hint: 'Please provide your email address for communication purposes.',
        section: 'Contact Information',
      },
      {
        id: 'phone',
        label: 'Phone Number (With Country Code)',
        type: 'text',
        required: true,
        placeholder: '+91 98765 43210',
        hint: 'Provide a phone number where we can contact you — and the number you want to appear on your resume.',
        section: 'Contact Information',
      },

      // ── Career Direction ──
      {
        id: 'current_job_title',
        label: 'Current Job Title',
        type: 'text',
        required: true,
        placeholder: 'e.g. Senior Software Engineer at TCS',
        hint: 'What is your current job title or role?',
        section: 'Career Direction',
      },
      {
        id: 'desired_job_title',
        label: 'Desired Job Title / Role',
        type: 'text',
        required: true,
        placeholder: 'e.g. Product Manager, Data Scientist',
        hint: 'What job title or role are you aiming for with your resume and LinkedIn profile?',
        section: 'Career Direction',
      },
      {
        id: 'career_goals',
        label: 'Summary of Career Goals',
        type: 'textarea',
        required: true,
        placeholder: 'Describe your career goals and aspirations in a few sentences…',
        hint: 'Please provide a brief summary of your career goals and aspirations.',
        section: 'Career Direction',
      },

      // ── Professional Background ──
      {
        id: 'professional_experience',
        label: 'Professional Experience',
        type: 'textarea',
        required: true,
        placeholder: 'Job Title — Company — Dates\nKey responsibilities and achievements for each role…',
        hint: 'Please list your recent professional experiences, including job titles, companies, and dates of employment.',
        section: 'Professional Background',
      },
      {
        id: 'educational_background',
        label: 'Educational Background',
        type: 'textarea',
        required: true,
        placeholder: 'Degree — Institution — Year\ne.g. B.Tech CSE — IIT Bombay — 2019',
        hint: 'Provide details about your educational qualifications, including institutions attended and degrees earned.',
        section: 'Professional Background',
      },

      // ── Skills & Achievements ──
      {
        id: 'key_skills',
        label: 'Key Skills and Competencies',
        type: 'textarea',
        required: true,
        placeholder: 'List your technical skills, soft skills, tools, and domain expertise…',
        hint: 'List any specific skills or competencies that you would like to highlight.',
        section: 'Skills & Achievements',
      },
      {
        id: 'certifications_awards',
        label: 'Certifications and Awards',
        type: 'textarea',
        required: true,
        placeholder: 'e.g. AWS Certified Solutions Architect (2023)\nHackerRank Gold Badge — Python',
        hint: 'List any relevant certifications, licenses, or awards that should be included.',
        section: 'Skills & Achievements',
      },
      {
        id: 'achievements',
        label: 'Specific Achievements or Projects',
        type: 'textarea',
        required: true,
        placeholder: 'e.g. Led a migration that reduced costs by 30%\nBuilt a real-time dashboard used by 50,000+ users',
        hint: 'Include any notable achievements or projects you would like to emphasise.',
        section: 'Skills & Achievements',
      },

      // ── Additional Details ──
      {
        id: 'additional_info',
        label: 'Additional Information',
        type: 'textarea',
        required: false,
        placeholder: 'Career gaps, specific requirements, or anything else we should know…',
        hint: 'Is there any other information or specific requirements you would like us to consider?',
        section: 'Additional Details',
      },
      {
        id: 'consent',
        label: 'Consent to Contact',
        type: 'select',
        options: [
          'Yes — I consent to being contacted via email or phone for follow-up and updates',
          'No — Email only, do not contact me via phone',
        ],
        required: true,
        hint: 'Do you consent to being contacted via email or phone for follow-up and updates?',
        section: 'Additional Details',
      },

      // ── Attachments ──
      {
        id: 'attachments',
        label: 'Attachments (Existing Resume / Supporting Documents)',
        type: 'file',
        accept: '.pdf,.doc,.docx',
        required: false,
        hint: 'You can upload any existing resume, cover letter, or additional documents. If you have an extensive career history (Executive or Executive+ level), please attach your existing resume and note "Refer to resume" in the relevant fields above — we will take it from there.',
        section: 'Attachments',
      },
    ],
  },

  // ── LinkedIn Profile Information Form ──────────────────────────────────────
  linkedin: {
    formType: 'linkedin',
    title: 'LinkedIn Profile Information',
    description:
      'To ensure we optimise your LinkedIn profile to its fullest potential, please fill out the following form with the necessary details. This information will allow us to tailor your profile to highlight your strengths and experiences.\n\nYour login credentials are completely safe with us — used solely for optimising your profile and kept strictly confidential.\n\nQuestions? Reach out at info@theripplenexus.com',
    disclaimer:
      'By submitting this form you confirm you are the owner of this LinkedIn account and authorise Ripple Nexus to access and optimise your profile. Your credentials will be treated with strict confidentiality and will not be shared with any third party. You are advised to change your password after the work is complete.',
    fields: [
      // ── Account Access ──
      {
        id: 'linkedin_username',
        label: 'LinkedIn Username',
        type: 'text',
        required: true,
        placeholder: 'e.g. john-doe-12345',
        hint: 'This is the part of your LinkedIn URL that comes after "linkedin.com/in/" — e.g. linkedin.com/in/john-doe-12345',
        section: 'Account Access',
      },
      {
        id: 'linkedin_email',
        label: 'LinkedIn Email Address',
        type: 'text',
        required: true,
        placeholder: 'email@example.com',
        hint: 'Enter the email address associated with your LinkedIn account.',
        section: 'Account Access',
      },
      {
        id: 'linkedin_password',
        label: 'LinkedIn Password',
        type: 'password',
        required: true,
        placeholder: '••••••••',
        hint: 'Used solely to access and update your profile. You can change your password after the work is complete.',
        section: 'Account Access',
      },

      // ── Profile Media ──
      {
        id: 'profile_photo',
        label: 'Professional Profile Photo (High Resolution)',
        type: 'file',
        accept: '.jpg,.jpeg,.png',
        required: true,
        hint: 'Please upload a professional photo that you\'d like to use for your LinkedIn profile.',
        section: 'Profile Media',
      },

      // ── Optimisation Goals ──
      {
        id: 'linkedin_goals',
        label: 'Top Professional Goals for Optimising Your LinkedIn Profile',
        type: 'checkbox',
        options: [
          'Increase job/opportunity visibility',
          'Expand professional network',
          'Establish thought leadership/expertise',
          'Generate business leads',
          'Improve personal brand recognition',
        ],
        required: false,
        hint: 'Select all that apply.',
        section: 'Optimisation Goals',
      },
      {
        id: 'industry',
        label: 'Industry / Professional Field',
        type: 'select',
        options: [
          'Technology/Software',
          'Finance/Accounting',
          'Marketing/Advertising',
          'Healthcare/Medical',
          'Education/Academia',
          'Manufacturing',
          'Consulting',
          'Other',
        ],
        required: false,
        hint: 'Which industry best describes your current or desired professional field?',
        section: 'Optimisation Goals',
      },

      // ── Profile Assessment ──
      {
        id: 'profile_completeness',
        label: 'Current Profile Completeness & Quality',
        type: 'rating',
        required: false,
        hint: 'How would you rate the current completeness and quality of your LinkedIn profile? (1 = Needs major overhaul · 5 = Excellent and complete)',
        section: 'Profile Assessment',
      },
      {
        id: 'headline_rating',
        label: 'Effectiveness of Your Current Headline',
        type: 'rating',
        required: false,
        hint: 'How would you rate the effectiveness of your current headline in immediately communicating your value? (1 = Poor · 5 = Excellent)',
        section: 'Profile Assessment',
      },
      {
        id: 'improvement_areas',
        label: 'Areas Requiring Most Immediate Improvement',
        type: 'checkbox',
        options: [
          'Headline',
          'Summary/About section',
          'Experience section details',
          'Skills and endorsements',
          'Education/Certifications',
          'Activity/Posts',
        ],
        required: false,
        hint: 'Which areas of your LinkedIn profile do you believe require the most immediate attention?',
        section: 'Profile Assessment',
      },

      // ── Brand & Voice ──
      {
        id: 'profile_tone',
        label: 'Primary Tone / Voice for Your LinkedIn Profile',
        type: 'select',
        options: [
          'Professional and authoritative',
          'Friendly and approachable',
          'Innovative and forward-thinking',
          'Detail-oriented and thorough',
          'Other (specify in additional notes below)',
        ],
        required: false,
        hint: 'What is the primary tone or voice you want your LinkedIn profile to convey?',
        section: 'Brand & Voice',
      },
      {
        id: 'keyword_importance',
        label: 'Importance of Industry Keyword Integration',
        type: 'rating',
        required: false,
        hint: 'How important is it to integrate specific keywords relevant to your industry into your profile? (1 = Not important · 5 = Extremely important)',
        section: 'Brand & Voice',
      },
      {
        id: 'passive_search_importance',
        label: 'Importance of Passive Job Search Optimisation',
        type: 'rating',
        required: false,
        hint: 'How important is optimising your LinkedIn for passive job searching (being found by recruiters)? (1 = Not important · 5 = Essential)',
        section: 'Brand & Voice',
      },

      // ── Content Strategy ──
      {
        id: 'achievements',
        label: 'Specific Achievements or Career Milestones to Feature',
        type: 'textarea',
        required: false,
        placeholder: 'List achievements or milestones you want prominently featured on your profile…',
        hint: 'Are there any specific achievements or career milestones you want prominently featured in your profile?',
        section: 'Content Strategy',
      },
      {
        id: 'target_roles',
        label: 'Target Job Titles / Roles to Attract After Optimisation',
        type: 'text',
        required: false,
        placeholder: 'e.g. Product Manager, Senior Data Analyst, CTO',
        hint: 'What specific job titles or roles are you hoping to attract or be associated with after optimisation?',
        section: 'Content Strategy',
      },
      {
        id: 'featured_section',
        label: 'Featured Section — Priority Ranking',
        type: 'textarea',
        required: false,
        placeholder: 'Rank by importance, e.g.:\n1. Portfolio/Work Samples\n2. Publications/Articles\n3. Recommendations/Testimonials\n4. Media Mentions/Press',
        hint: 'Please rank the importance of content elements for your profile\'s Featured section: Portfolio/Work Samples, Publications/Articles, Media Mentions/Press, Recommendations/Testimonials.',
        section: 'Content Strategy',
      },
      {
        id: 'active_features',
        label: 'LinkedIn Features You Actively Use or Plan to Use',
        type: 'checkbox',
        options: [
          'LinkedIn Learning/Courses',
          'Creator Mode/Newsletters',
          'LinkedIn Groups',
          'Posting/Sharing content',
          'Direct Messaging/InMail',
        ],
        required: false,
        hint: 'Which of these features do you actively use or plan to use frequently on LinkedIn?',
        section: 'Content Strategy',
      },
    ],
  },

  // ── Cover Letter Form (fallback — not used directly) ─────────────────────
  cover_letter: {
    formType: 'cover_letter',
    title: 'Cover Letter Details',
    description:
      'Provide the details below and we will write a compelling, personalised cover letter for your target role. The more specific you are, the better we can tailor it.',
    disclaimer:
      'By submitting this form you confirm all information is accurate. Ripple Nexus uses this information exclusively to write your cover letter.',
    fields: [
      {
        id: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        placeholder: 'Your name as it should appear on the cover letter',
        section: 'Personal Details',
      },
      {
        id: 'current_job_title',
        label: 'Current Job Title',
        type: 'text',
        required: true,
        placeholder: 'e.g. Marketing Executive',
        section: 'Personal Details',
      },
      {
        id: 'job_title',
        label: 'Job Title You Are Applying For',
        type: 'text',
        required: true,
        placeholder: 'e.g. Marketing Manager',
        section: 'Target Role',
      },
      {
        id: 'company_name',
        label: 'Company Name',
        type: 'text',
        required: false,
        placeholder: 'Leave blank for a general version',
        section: 'Target Role',
      },
      {
        id: 'industry',
        label: 'Industry / Sector',
        type: 'select',
        options: [
          'Technology/Software', 'Finance/Banking', 'Healthcare/Medical',
          'FMCG/Retail', 'Consulting', 'Education/Academia',
          'Marketing/Advertising', 'Government/PSU', 'Manufacturing', 'Startup', 'Other',
        ],
        required: true,
        section: 'Target Role',
      },
      {
        id: 'tone',
        label: 'Preferred Tone',
        type: 'select',
        options: [
          'Professional and Formal', 'Confident and Bold',
          'Warm and Engaging', 'Concise and Direct',
        ],
        required: true,
        section: 'Target Role',
      },
      {
        id: 'key_strengths',
        label: 'Top 3 Strengths to Highlight',
        type: 'textarea',
        required: true,
        placeholder: 'What makes you the best fit for this role? List your top strengths…',
        section: 'Your Story',
      },
      {
        id: 'motivation',
        label: 'Why This Role / Company?',
        type: 'textarea',
        required: false,
        placeholder: 'Your genuine motivation helps personalise the letter…',
        section: 'Your Story',
      },
      {
        id: 'key_achievements',
        label: 'Key Achievements to Mention',
        type: 'textarea',
        required: false,
        placeholder: 'e.g. Grew social media following by 200% in 6 months…',
        section: 'Your Story',
      },
      {
        id: 'jd_text',
        label: 'Paste Job Description (optional)',
        type: 'textarea',
        required: false,
        placeholder: 'Paste the full JD here for better tailoring…',
        section: 'Job Description',
      },
      {
        id: 'jd_file',
        label: 'Upload Job Description PDF (optional)',
        type: 'file',
        accept: '.pdf,.doc,.docx,.txt',
        required: false,
        section: 'Job Description',
      },
    ],
  },
};

export function getFormsForPackage(pkg: CareerPackage): FormType[] {
  return PACKAGE_FORMS[pkg] ?? [];
}

export function canAccessForm(pkg: CareerPackage, formType: FormType): boolean {
  return PACKAGE_FORMS[pkg]?.includes(formType) ?? false;
}

// src/lib/career/forms.ts

import type { FormSchema, CareerPackage, FormType, CareerServiceSlug } from './types';
import { PACKAGE_FORMS, SERVICE_FORM_MAP, getFormsForServices } from './types';

export const DEFAULT_FORM_SCHEMAS: Record<FormType, FormSchema> = {

  // ── Career Profile Strategy Brief (Resume + Cover Letter intake) ───────────
  career_profile: {
    formType: 'career_profile',
    title: 'Career Profile Strategy Brief',
    description:
      'Please fill out this form to provide the necessary details for your resume writing, cover letter, and career strategy services. Your responses will help us tailor these documents to best reflect your career goals, experiences, and professional image.\n\nIf you have any questions, feel free to reach out at info@theripplenexus.com',
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
        hint: 'Please provide your full name as you would like it to appear on your resume and cover letter.',
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
        hint: 'What job title or role are you aiming for?',
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
        hint: 'Provide details about your educational qualifications.',
        section: 'Professional Background',
      },

      // ── Skills & Achievements ──
      {
        id: 'key_skills',
        label: 'Key Skills and Competencies',
        type: 'textarea',
        required: true,
        placeholder: 'List your technical skills, soft skills, tools, and domain expertise…',
        section: 'Skills & Achievements',
      },
      {
        id: 'certifications_awards',
        label: 'Certifications and Awards',
        type: 'textarea',
        required: true,
        placeholder: 'e.g. AWS Certified Solutions Architect (2023)',
        section: 'Skills & Achievements',
      },
      {
        id: 'achievements',
        label: 'Specific Achievements or Projects',
        type: 'textarea',
        required: true,
        placeholder: 'e.g. Led a migration that reduced costs by 30%',
        section: 'Skills & Achievements',
      },

      // ── Additional Details ──
      {
        id: 'additional_info',
        label: 'Additional Information',
        type: 'textarea',
        required: false,
        placeholder: 'Career gaps, specific requirements, or anything else we should know…',
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
        hint: 'You can upload any existing resume, cover letter, or additional documents.',
        section: 'Attachments',
      },
    ],
  },

  // ── LinkedIn Profile Optimization Brief ────────────────────────────────────
  linkedin_profile: {
    formType: 'linkedin_profile',
    title: 'LinkedIn Profile Optimization Brief',
    description:
      'To ensure we optimise your LinkedIn profile to its fullest potential, please fill out the following form with the necessary details.\n\nYour login credentials are completely safe with us — used solely for optimising your profile and kept strictly confidential.\n\nQuestions? Reach out at info@theripplenexus.com',
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
        hint: 'This is the part of your LinkedIn URL after "linkedin.com/in/"',
        section: 'Account Access',
      },
      {
        id: 'linkedin_email',
        label: 'LinkedIn Email Address',
        type: 'text',
        required: true,
        placeholder: 'email@example.com',
        section: 'Account Access',
      },
      {
        id: 'linkedin_password',
        label: 'LinkedIn Password',
        type: 'password',
        required: true,
        placeholder: '••••••••',
        hint: 'Used solely to access and update your profile. Change your password after the work is complete.',
        section: 'Account Access',
      },

      // ── Profile Media ──
      {
        id: 'profile_photo',
        label: 'Professional Profile Photo (High Resolution)',
        type: 'file',
        accept: '.jpg,.jpeg,.png',
        required: true,
        hint: "Please upload a professional photo you'd like to use for your LinkedIn profile.",
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
        section: 'Optimisation Goals',
      },
      {
        id: 'industry',
        label: 'Industry / Professional Field',
        type: 'select',
        options: [
          'Technology/Software', 'Finance/Accounting', 'Marketing/Advertising',
          'Healthcare/Medical', 'Education/Academia', 'Manufacturing',
          'Consulting', 'Other',
        ],
        required: false,
        section: 'Optimisation Goals',
      },

      // ── Profile Assessment ──
      {
        id: 'profile_completeness',
        label: 'Current Profile Completeness & Quality',
        type: 'rating',
        required: false,
        hint: '1 = Needs major overhaul · 5 = Excellent and complete',
        section: 'Profile Assessment',
      },
      {
        id: 'headline_rating',
        label: 'Effectiveness of Your Current Headline',
        type: 'rating',
        required: false,
        hint: '1 = Poor · 5 = Excellent',
        section: 'Profile Assessment',
      },
      {
        id: 'improvement_areas',
        label: 'Areas Requiring Most Immediate Improvement',
        type: 'checkbox',
        options: [
          'Headline', 'Summary/About section', 'Experience section details',
          'Skills and endorsements', 'Education/Certifications', 'Activity/Posts',
        ],
        required: false,
        section: 'Profile Assessment',
      },

      // ── Brand & Voice ──
      {
        id: 'profile_tone',
        label: 'Primary Tone / Voice for Your LinkedIn Profile',
        type: 'select',
        options: [
          'Professional and authoritative', 'Friendly and approachable',
          'Innovative and forward-thinking', 'Detail-oriented and thorough',
          'Other (specify in additional notes below)',
        ],
        required: false,
        section: 'Brand & Voice',
      },
      {
        id: 'keyword_importance',
        label: 'Importance of Industry Keyword Integration',
        type: 'rating',
        required: false,
        hint: '1 = Not important · 5 = Extremely important',
        section: 'Brand & Voice',
      },

      // ── Content Strategy ──
      {
        id: 'achievements',
        label: 'Specific Achievements or Career Milestones to Feature',
        type: 'textarea',
        required: false,
        placeholder: 'List achievements or milestones you want prominently featured…',
        section: 'Content Strategy',
      },
      {
        id: 'target_roles',
        label: 'Target Job Titles / Roles to Attract After Optimisation',
        type: 'text',
        required: false,
        placeholder: 'e.g. Product Manager, Senior Data Analyst, CTO',
        section: 'Content Strategy',
      },
    ],
  },

  // ── Portfolio Website Development Brief ────────────────────────────────────
  portfolio_website: {
    formType: 'portfolio_website',
    title: 'Portfolio Website Development Brief',
    description:
      'Please fill out this form so we can build a portfolio website that showcases your work and personal brand. The more detail you provide, the better we can tailor the site to your goals.\n\nQuestions? Reach out at info@theripplenexus.com',
    disclaimer:
      'By submitting this form you confirm all information provided is accurate and you own or have the right to use all content, images, and materials submitted. Ripple Nexus will use this information solely to build your portfolio website.',
    fields: [
      // ── Personal Details ──
      {
        id: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        placeholder: 'Your name as it should appear on the site',
        section: 'Personal Details',
      },
      {
        id: 'profession',
        label: 'Profession / Job Title',
        type: 'text',
        required: true,
        placeholder: 'e.g. UI/UX Designer, Full-Stack Developer',
        section: 'Personal Details',
      },
      {
        id: 'bio',
        label: 'About / Bio',
        type: 'textarea',
        required: true,
        placeholder: 'A short bio for your "About Me" section…',
        section: 'Personal Details',
      },
      {
        id: 'contact_email',
        label: 'Public Contact Email',
        type: 'text',
        required: true,
        placeholder: 'email@example.com',
        section: 'Personal Details',
      },
      {
        id: 'contact_phone',
        label: 'Public Phone Number (optional)',
        type: 'text',
        required: false,
        placeholder: '+91 98765 43210',
        section: 'Personal Details',
      },

      // ── Website Goals ──
      {
        id: 'website_goal',
        label: 'Primary Goal of Your Portfolio Website',
        type: 'select',
        options: [
          'Showcase work to potential employers',
          'Attract freelance clients',
          'Build personal brand / thought leadership',
          'Sell products or services',
          'Other',
        ],
        required: true,
        section: 'Website Goals',
      },
      {
        id: 'target_audience',
        label: 'Target Audience',
        type: 'text',
        required: true,
        placeholder: 'e.g. Recruiters in fintech, Startup founders, Creative directors',
        section: 'Website Goals',
      },

      // ── Portfolio Content ──
      {
        id: 'projects',
        label: 'Projects / Work Samples to Feature',
        type: 'textarea',
        required: true,
        placeholder: 'List each project with a brief description, your role, and outcome…',
        hint: 'Include live URLs or GitHub links where available.',
        section: 'Portfolio Content',
      },
      {
        id: 'skills',
        label: 'Key Skills to Highlight',
        type: 'textarea',
        required: true,
        placeholder: 'List your top skills, tools, and technologies…',
        section: 'Portfolio Content',
      },
      {
        id: 'testimonials',
        label: 'Testimonials / Recommendations (optional)',
        type: 'textarea',
        required: false,
        placeholder: 'Paste any testimonials or client recommendations…',
        section: 'Portfolio Content',
      },

      // ── Design Preferences ──
      {
        id: 'design_style',
        label: 'Preferred Design Style',
        type: 'select',
        options: [
          'Minimal & Clean', 'Bold & Creative', 'Corporate & Professional',
          'Dark & Modern', 'Colourful & Playful', 'No preference',
        ],
        required: true,
        section: 'Design Preferences',
      },
      {
        id: 'colour_preference',
        label: 'Colour Preferences',
        type: 'text',
        required: false,
        placeholder: 'e.g. Navy + White, or any hex codes…',
        section: 'Design Preferences',
      },
      {
        id: 'reference_sites',
        label: 'Reference Websites You Like',
        type: 'textarea',
        required: false,
        placeholder: 'Paste URLs of sites you like the look of…',
        section: 'Design Preferences',
      },

      // ── Social / Links ──
      {
        id: 'linkedin_url',
        label: 'LinkedIn Profile URL',
        type: 'url',
        required: false,
        placeholder: 'https://linkedin.com/in/your-profile',
        section: 'Social & Links',
      },
      {
        id: 'github_url',
        label: 'GitHub / Behance / Dribbble URL',
        type: 'url',
        required: false,
        placeholder: 'https://github.com/yourusername',
        section: 'Social & Links',
      },

      // ── Assets ──
      {
        id: 'profile_photo',
        label: 'Profile Photo',
        type: 'file',
        accept: '.jpg,.jpeg,.png',
        required: false,
        hint: 'High-resolution professional photo for the site.',
        section: 'Assets',
      },
      {
        id: 'resume_upload',
        label: 'Resume / CV (for reference)',
        type: 'file',
        accept: '.pdf,.doc,.docx',
        required: false,
        section: 'Assets',
      },

      // ── Additional ──
      {
        id: 'additional_info',
        label: 'Any Other Requirements or Notes',
        type: 'textarea',
        required: false,
        placeholder: 'Specific sections, features, integrations, or anything else…',
        section: 'Additional',
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

export function getFormsForServiceSlugs(slugs: CareerServiceSlug[]): FormType[] {
  return getFormsForServices(slugs);
}

export function canAccessFormByServices(slugs: CareerServiceSlug[], formType: FormType): boolean {
  return getFormsForServices(slugs).includes(formType);
}

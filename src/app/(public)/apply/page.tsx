'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, User, Briefcase, Mail, Phone, Globe, Star, Shield, ArrowRight, Loader2, Lock, ArrowUpRight } from 'lucide-react';
import { ClientType } from '@prisma/client';
import { Logo } from '@/components/Logo';

export default function CatalystApplyPage() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1 State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [experienceLevel, setExperienceLevel] = useState<ClientType>('MID_CAREER');
  
  // Step 2 State
  const [selectedPackage, setSelectedPackage] = useState<'CAREER_BOOSTER' | 'PREMIUM_PLUS' | 'CUSTOM'>('CAREER_BOOSTER');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [preferredGateway, setPreferredGateway] = useState<'RAZORPAY' | 'PAYPAL'>('PAYPAL');
  
  // Pricing Result State
  const [pricingDraft, setPricingDraft] = useState<any>(null);
  
  const handleNextStep1 = () => {
    if (!name || !email || !phone) return alert('Please fill in all basic details.');
    setStep(2);
  };
  
  const handleNextStep2 = async () => {
    setLoading(true);
    try {
      let servicesToPass: string[] = [];
      if (selectedPackage === 'PREMIUM_PLUS') {
        servicesToPass = ['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'];
      } else if (selectedPackage === 'CAREER_BOOSTER') {
        servicesToPass = ['RESUME', 'LINKEDIN', 'COVER_LETTER'];
      } else {
        if (customServices.length === 0) {
          setLoading(false);
          return alert('Please select at least one service.');
        }
        servicesToPass = customServices;
      }
      
      const countryMap: Record<string, string> = {
        IN: 'India', US: 'United States', GB: 'United Kingdom',
        AE: 'United Arab Emirates', AU: 'Australia', CA: 'Canada', SA: 'Saudi Arabia'
      };

      const payload = {
        name,
        email,
        phone,
        countryCode,
        countryName: countryMap[countryCode] || 'United States',
        experienceLevel,
        packageSlug: selectedPackage,
        services: servicesToPass,
        preferredGateway: countryCode === 'IN' ? 'RAZORPAY' : preferredGateway
      };
      
      const res = await fetch('/api/public/checkout/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate checkout draft');
      
      setPricingDraft(data);
      setStep(3);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCheckout = () => {
    if (pricingDraft?.paymentUrl) {
      window.location.href = pricingDraft.paymentUrl;
    }
  };
  
  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;
  
  return (
    <div className="min-h-screen bg-[#F4F1EB] text-[#0A0B0D] selection:bg-[#0A0B0D] selection:text-white flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 h-1 bg-[#E6DFD1] w-full z-[60]">
        <div 
          className="h-full bg-[#B8935B] transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {/* Header */}
      <header className="py-6 px-6 sm:px-12 border-b border-[#E6DFD1] sticky top-0 bg-[#F4F1EB]/90 backdrop-blur-md z-50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={32} brandId="catalyst" dark={false} />
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold tracking-[0.1em] text-[#0A0B0D]/40 uppercase">
            <span className={`transition-colors duration-300 ${step >= 1 ? 'text-[#0A0B0D]' : ''}`}>01. Details</span>
            <span className="mx-2 opacity-30">—</span>
            <span className={`transition-colors duration-300 ${step >= 2 ? 'text-[#0A0B0D]' : ''}`}>02. Services</span>
            <span className="mx-2 opacity-30">—</span>
            <span className={`transition-colors duration-300 ${step === 3 ? 'text-[#0A0B0D]' : ''}`}>03. Checkout</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-start py-10 sm:py-20 px-4 sm:px-8 z-10 w-full">
        <div className="w-full max-w-3xl">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-12">
                <h1 className="text-4xl sm:text-5xl font-serif text-[#0A0B0D] mb-4">Application Details</h1>
                <p className="text-base text-[#0A0B0D]/60 max-w-2xl">Enter your professional information to generate your executive portfolio strategy and exact pricing structure.</p>
              </div>
              
              <div className="bg-white p-6 sm:p-12 shadow-sm border border-[#E6DFD1] space-y-10 rounded-sm">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-0 top-3 w-5 h-5 text-[#0A0B0D]/30" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-transparent border-b border-[#E6DFD1] rounded-none py-3 pl-8 pr-0 outline-none focus:border-[#B8935B] transition-colors duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30 text-lg" 
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-0 top-3 w-5 h-5 text-[#0A0B0D]/30" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-transparent border-b border-[#E6DFD1] rounded-none py-3 pl-8 pr-0 outline-none focus:border-[#B8935B] transition-colors duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30 text-lg" 
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-0 top-3 w-5 h-5 text-[#0A0B0D]/30" />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-transparent border-b border-[#E6DFD1] rounded-none py-3 pl-8 pr-0 outline-none focus:border-[#B8935B] transition-colors duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30 text-lg" 
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-0 top-3 w-5 h-5 text-[#0A0B0D]/30" />
                      <select 
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                        className="w-full bg-transparent border-b border-[#E6DFD1] rounded-none py-3 pl-8 pr-4 outline-none focus:border-[#B8935B] transition-colors duration-300 appearance-none text-[#0A0B0D] text-lg"
                      >
                        <option value="IN">India</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AE">UAE</option>
                        <option value="SA">Saudi Arabia</option>
                        <option value="AU">Australia</option>
                        <option value="CA">Canada</option>
                      </select>
                      <div className="absolute right-0 top-4 pointer-events-none text-[#0A0B0D]">
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5 pt-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Career Trajectory</label>
                    <p className="text-sm text-[#0A0B0D]/50">Pricing and strategic depth scales based on your current executive tier.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { id: 'FRESHER', label: '0-2 Years' },
                      { id: 'MID_CAREER', label: '3-7 Years' },
                      { id: 'EXECUTIVE', label: '8-14 Years' },
                      { id: 'EXECUTIVE_PLUS', label: '15+ Years' }
                    ].map(exp => (
                      <button
                        key={exp.id}
                        onClick={() => setExperienceLevel(exp.id as ClientType)}
                        className={`py-4 px-3 rounded-sm border text-sm font-bold transition-all duration-300 ${
                          experienceLevel === exp.id 
                            ? 'bg-[#0A0B0D] text-white border-[#0A0B0D]' 
                            : 'bg-transparent border-[#E6DFD1] text-[#0A0B0D]/70 hover:border-[#0A0B0D] hover:text-[#0A0B0D]'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-10 border-t border-[#E6DFD1]">
                  <button 
                    onClick={handleNextStep1}
                    className="w-full sm:w-auto sm:ml-auto group relative overflow-hidden bg-[#B8935B] text-[#0A0B0D] font-bold text-[13px] uppercase tracking-widest px-10 py-5 hover:bg-[#A37E47] transition-all duration-300 flex items-center justify-center gap-3 rounded-sm"
                  >
                    Continue to Services
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {step === 2 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-700">
               <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                 <div>
                   <h1 className="text-4xl sm:text-5xl font-serif text-[#0A0B0D] mb-3">Service Selection</h1>
                   <p className="text-base text-[#0A0B0D]/60 max-w-lg">Select the executive strategy package that aligns with your placement objectives.</p>
                 </div>
                 <div className="bg-white border border-[#E6DFD1] px-4 py-2 rounded-sm text-xs font-bold text-[#0A0B0D]/60 tracking-wider flex items-center gap-2">
                   <Star className="w-3.5 h-3.5 text-[#B8935B] fill-[#B8935B]" /> JOIN 500+ PLACED LEADERS
                 </div>
               </div>
               
               <div className="space-y-6">
                 {/* Premium Plus */}
                 <div 
                   onClick={() => setSelectedPackage('PREMIUM_PLUS')}
                   className={`group relative cursor-pointer bg-white transition-all duration-300 rounded-sm border ${
                     selectedPackage === 'PREMIUM_PLUS' 
                       ? 'border-[#B8935B] shadow-md' 
                       : 'border-[#E6DFD1] hover:border-[#0A0B0D]/30'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-[#0A0B0D] text-[#F4F1EB] text-[10px] uppercase tracking-widest font-bold px-4 py-2 flex items-center gap-1">
                     <Star className="w-3 h-3 text-[#B8935B]" /> RECOMMENDED
                   </div>

                   <div className="p-6 sm:p-10 flex flex-col sm:flex-row gap-8">
                     <div className="flex-1">
                       <h3 className="text-2xl font-serif text-[#0A0B0D] mb-2">Premium Plus</h3>
                       <p className="text-sm text-[#0A0B0D]/60 mb-8 border-b border-[#E6DFD1] pb-6">The complete, end-to-end executive branding overhaul.</p>
                       
                       <ul className="space-y-5">
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#B8935B]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">Executive Resume</p>
                             <p className="text-[#0A0B0D]/60 text-sm mt-1">ATS-optimized, strategy-driven document meticulously crafted to pass board-level screening and highlight your unique leadership trajectory.</p>
                           </div>
                         </li>
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#B8935B]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">LinkedIn Profile Overhaul</p>
                             <p className="text-[#0A0B0D]/60 text-sm mt-1">Complete profile transformation including headline, summary, experience sections, custom banner design, and professional display photo guidance — engineered to attract elite executive headhunters.</p>
                           </div>
                         </li>
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#B8935B]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">Strategic Cover Letter</p>
                             <p className="text-[#0A0B0D]/60 text-sm mt-1">Highly targeted, persuasive narrative designed to secure interviews for coveted c-suite and director-level roles.</p>
                           </div>
                         </li>
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#B8935B]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">Portfolio Website</p>
                             <p className="text-[#0A0B0D]/60 text-sm mt-1">A bespoke, multi-page digital presence that showcases your career milestones and executive brand. Includes domain integration setup and domain purchase guidance.</p>
                           </div>
                         </li>
                       </ul>
                     </div>
                   </div>
                 </div>
                 
                 {/* Career Booster */}
                 <div 
                   onClick={() => setSelectedPackage('CAREER_BOOSTER')}
                   className={`group relative cursor-pointer bg-white transition-all duration-300 rounded-sm border ${
                     selectedPackage === 'CAREER_BOOSTER' 
                       ? 'border-[#0A0B0D] shadow-md' 
                       : 'border-[#E6DFD1] hover:border-[#0A0B0D]/30'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-[#E6DFD1] text-[#0A0B0D] text-[10px] uppercase tracking-widest font-bold px-4 py-2">
                     POPULAR
                   </div>

                   <div className="p-6 sm:p-10 flex flex-col sm:flex-row gap-8">
                     <div className="flex-1">
                       <h3 className="text-2xl font-serif text-[#0A0B0D] mb-2">Career Booster</h3>
                       <p className="text-sm text-[#0A0B0D]/60 mb-8 border-b border-[#E6DFD1] pb-6">Core essentials for elite market placement.</p>
                       
                       <ul className="space-y-5">
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#0A0B0D]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">Executive Resume</p>
                           </div>
                         </li>
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#0A0B0D]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">LinkedIn Profile Overhaul</p>
                           </div>
                         </li>
                         <li className="flex gap-4">
                           <Check className={`w-5 h-5 shrink-0 mt-0.5 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#0A0B0D]' : 'text-[#E6DFD1]'}`} />
                           <div>
                             <p className="font-bold text-[#0A0B0D] text-sm">Strategic Cover Letter</p>
                           </div>
                         </li>
                       </ul>
                     </div>
                   </div>
                 </div>
                 
                 {/* Build Your Own */}
                 <div 
                   onClick={() => setSelectedPackage('CUSTOM')}
                   className={`group relative cursor-pointer bg-white transition-all duration-300 rounded-sm border ${
                     selectedPackage === 'CUSTOM' 
                       ? 'border-[#0A0B0D] shadow-md' 
                       : 'border-[#E6DFD1] hover:border-[#0A0B0D]/30'
                   }`}
                 >
                   <div className="p-6 sm:p-10">
                     <h3 className="text-2xl font-serif text-[#0A0B0D] mb-2">A La Carte</h3>
                     <p className="text-sm text-[#0A0B0D]/60 mb-6">Select individual components tailored to your needs.</p>
                     
                     {selectedPackage === 'CUSTOM' && (
                       <div className="pt-6 border-t border-[#E6DFD1] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                         {['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'].map(svc => (
                           <button
                             key={svc}
                             onClick={(e) => {
                               e.stopPropagation();
                               setCustomServices(prev => 
                                 prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                               );
                             }}
                             className={`py-4 px-5 border text-[11px] uppercase tracking-widest font-bold transition-all duration-300 flex items-center justify-between rounded-sm ${
                               customServices.includes(svc)
                                 ? 'bg-[#0A0B0D] border-[#0A0B0D] text-white'
                                 : 'bg-transparent border-[#E6DFD1] text-[#0A0B0D]/60 hover:border-[#0A0B0D]/50 hover:text-[#0A0B0D]'
                             }`}
                           >
                             {svc === 'RESUME' ? 'Executive Resume' : svc === 'LINKEDIN' ? 'LinkedIn Overhaul' : svc === 'COVER_LETTER' ? 'Cover Letter' : 'Portfolio Website'}
                             {customServices.includes(svc) && <Check className="w-4 h-4 text-white" />}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
                 
                  <div className="pt-10 flex flex-col gap-6">
                    {countryCode !== 'IN' && (
                      <div className="bg-white border border-[#E6DFD1] rounded-sm p-6 sm:p-8 flex flex-col gap-5">
                        <label className="text-[11px] font-bold text-[#0A0B0D] uppercase tracking-widest">Select Payment Method</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            onClick={() => setPreferredGateway('PAYPAL')}
                            className={`py-5 px-6 rounded-sm border transition-all duration-300 text-left ${
                              preferredGateway === 'PAYPAL'
                                ? 'bg-[#F4F1EB] border-[#B8935B]'
                                : 'bg-transparent border-[#E6DFD1] hover:border-[#0A0B0D]/30'
                            }`}
                          >
                            <div className="font-bold text-[#0A0B0D] text-sm uppercase tracking-wide">PayPal</div>
                            <div className="text-[13px] mt-1 text-[#0A0B0D]/50">Pay securely in USD</div>
                          </button>
                          <button
                            onClick={() => setPreferredGateway('RAZORPAY')}
                            className={`py-5 px-6 rounded-sm border transition-all duration-300 text-left ${
                              preferredGateway === 'RAZORPAY'
                                ? 'bg-[#F4F1EB] border-[#B8935B]'
                                : 'bg-transparent border-[#E6DFD1] hover:border-[#0A0B0D]/30'
                            }`}
                          >
                            <div className="font-bold text-[#0A0B0D] text-sm uppercase tracking-wide">Credit / Debit Card</div>
                            <div className="text-[13px] mt-1 text-[#0A0B0D]/50">Pay natively in Local Currency</div>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-[#E6DFD1]">
                      <button 
                        onClick={() => setStep(1)}
                        className="px-8 py-5 border border-[#E6DFD1] text-[#0A0B0D]/70 font-bold text-[13px] uppercase tracking-widest hover:border-[#0A0B0D] hover:text-[#0A0B0D] transition-all text-center rounded-sm"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleNextStep2}
                        disabled={loading}
                        className="flex-1 sm:flex-none sm:ml-auto group bg-[#B8935B] text-[#0A0B0D] font-bold text-[13px] uppercase tracking-widest px-10 py-5 hover:bg-[#A37E47] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none rounded-sm"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Calculate Pricing'}
                        {!loading && <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />}
                      </button>
                    </div>
                  </div>
                 
               </div>
             </div>
          )}
          
          {step === 3 && pricingDraft && (
             <div className="animate-in fade-in zoom-in-[0.98] duration-700">
               <div className="mb-12 flex flex-col sm:flex-row justify-between items-end gap-6 border-b border-[#E6DFD1] pb-6">
                 <div>
                   <h1 className="text-4xl sm:text-5xl font-serif text-[#0A0B0D] mb-3">Order Finalization</h1>
                   <p className="text-base text-[#0A0B0D]/60 max-w-lg">Review your strategic investment and proceed to secure checkout.</p>
                 </div>
                 <div className="bg-[#E6DFD1]/50 px-4 py-2 rounded-sm text-[10px] font-bold text-[#0A0B0D] tracking-widest uppercase flex items-center gap-2">
                   <Lock className="w-3 h-3" /> SECURE 256-BIT ENCRYPTION
                 </div>
               </div>
               
               <div className="bg-white border border-[#E6DFD1] p-8 sm:p-12 rounded-sm relative">
                 
                 <div className="space-y-6 mb-12">
                   <h3 className="text-[11px] font-bold text-[#0A0B0D]/40 uppercase tracking-widest mb-6">Itemized Breakdown</h3>
                   
                   <div className="flex justify-between items-center pb-4 border-b border-[#E6DFD1]/50">
                     <span className="font-bold text-[#0A0B0D] text-[15px]">Services ({selectedPackage.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})</span>
                     <span className="font-serif text-lg text-[#0A0B0D]">{pricingDraft.currencySymbol}{pricingDraft.subtotal.toLocaleString()}</span>
                   </div>
                   
                   {pricingDraft.discountAmount > 0 && (
                     <div className="flex justify-between items-center text-[#B8935B] pb-4 border-b border-[#E6DFD1]/50">
                       <span className="font-bold text-[15px]">Package Adjustment ({(pricingDraft.discountRate * 100).toFixed(0)}%)</span>
                       <span className="font-serif text-lg">-{pricingDraft.currencySymbol}{pricingDraft.discountAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   {pricingDraft.taxAmount > 0 && (
                     <div className="flex justify-between items-center text-[#0A0B0D]/60 pb-4 border-b border-[#E6DFD1]/50">
                       <span className="font-medium text-[15px]">Taxes & Compliance ({(pricingDraft.taxRate * 100).toFixed(0)}%)</span>
                       <span className="font-serif text-lg">{pricingDraft.currencySymbol}{pricingDraft.taxAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-8 gap-3">
                     <div>
                       <span className="text-5xl sm:text-6xl font-serif text-[#0A0B0D]">{pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}</span>
                       <span className="text-[#0A0B0D]/50 text-sm ml-3 font-bold">{pricingDraft.currency}</span>
                     </div>
                     <span className="text-[11px] uppercase tracking-widest font-bold text-[#0A0B0D]/40 max-w-[200px] sm:text-right">Inclusive of all platform fees.</span>
                   </div>
                 </div>
                 
                 <div className="pt-8 border-t border-[#E6DFD1] flex flex-col-reverse sm:flex-row gap-5">
                   <button 
                     onClick={() => setStep(2)}
                     className="px-8 py-5 border border-[#E6DFD1] text-[#0A0B0D]/70 font-bold text-[13px] uppercase tracking-widest hover:border-[#0A0B0D] hover:text-[#0A0B0D] transition-all text-center rounded-sm"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleCheckout}
                     className="flex-1 group bg-[#0A0B0D] text-[#F4F1EB] font-bold text-[13px] uppercase tracking-widest px-10 py-5 hover:bg-[#1A1C20] transition-all duration-300 flex items-center justify-center gap-3 rounded-sm"
                   >
                     Process Payment
                     <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                   </button>
                 </div>
                 
               </div>
               
               <p className="text-center text-[11px] text-[#0A0B0D]/40 uppercase tracking-widest mt-12 max-w-lg mx-auto leading-relaxed font-bold">
                 Access to the executive portal is granted immediately upon successful completion. An invoice will be dispatched to your email securely.
               </p>
             </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

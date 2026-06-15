'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight, User, Briefcase, Mail, Phone, Globe, Star, Shield, ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
  
  return (
    <div className="min-h-screen bg-[#F4F1EB] text-[#0A0B0D] selection:bg-[#B8935B]/30 selection:text-[#0A0B0D] flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#B8935B] via-[#E3B873] to-[#B8935B] z-10 bg-[length:200%_auto] animate-shimmer" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#E6DFD1] blur-[120px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#B8935B]/15 blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <header className="py-5 px-6 sm:px-12 border-b border-[#E6DFD1]/50 sticky top-0 bg-[#F4F1EB]/70 backdrop-blur-2xl z-50 transition-all duration-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={32} brandId="catalyst" dark={false} />
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium text-[#0A0B0D]/40">
            <span className={`transition-all duration-500 ${step >= 1 ? 'text-[#B8935B] font-bold drop-shadow-sm scale-105' : ''}`}>1. Details</span>
            <ChevronRight className={`w-4 h-4 transition-all duration-500 mx-1 ${step >= 2 ? 'text-[#B8935B] opacity-100' : 'opacity-30'}`} />
            <span className={`transition-all duration-500 ${step >= 2 ? 'text-[#B8935B] font-bold drop-shadow-sm scale-105' : ''}`}>2. Services</span>
            <ChevronRight className={`w-4 h-4 transition-all duration-500 mx-1 ${step >= 3 ? 'text-[#B8935B] opacity-100' : 'opacity-30'}`} />
            <span className={`transition-all duration-500 ${step === 3 ? 'text-[#B8935B] font-bold drop-shadow-sm scale-105' : ''}`}>3. Checkout</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 z-10 w-full">
        <div className="w-full max-w-2xl relative">
          
          {step === 1 && (
            <div className="animate-fade-up">
              <div className="text-center mb-10 sm:mb-14 animate-fade-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }} >
                <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-[#0A0B0D] mb-5">Let&apos;s get started.</h1>
                <p className="text-lg text-[#0A0B0D]/60 max-w-lg mx-auto">Enter your details to generate your customized portfolio and exclusive pricing.</p>
              </div>
              
              <div className="bg-white/60 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/80 space-y-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_25px_70px_-15px_rgba(184,147,91,0.15)] animate-fade-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-[#B8935B]/5 pointer-events-none" />
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest transition-colors group-focus-within:text-[#B8935B]">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-4 w-5 h-5 text-[#0A0B0D]/30 transition-colors duration-300 group-focus-within:text-[#B8935B]" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-white/50 border border-transparent ring-1 ring-[#E6DFD1]/50 rounded-xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#B8935B] focus:bg-white focus:shadow-[0_0_20px_rgba(184,147,91,0.15)] transition-all duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30" 
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest transition-colors group-focus-within:text-[#B8935B]">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-4 w-5 h-5 text-[#0A0B0D]/30 transition-colors duration-300 group-focus-within:text-[#B8935B]" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-white/50 border border-transparent ring-1 ring-[#E6DFD1]/50 rounded-xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#B8935B] focus:bg-white focus:shadow-[0_0_20px_rgba(184,147,91,0.15)] transition-all duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30" 
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest transition-colors group-focus-within:text-[#B8935B]">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-4 w-5 h-5 text-[#0A0B0D]/30 transition-colors duration-300 group-focus-within:text-[#B8935B]" />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-white/50 border border-transparent ring-1 ring-[#E6DFD1]/50 rounded-xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#B8935B] focus:bg-white focus:shadow-[0_0_20px_rgba(184,147,91,0.15)] transition-all duration-300 text-[#0A0B0D] placeholder:text-[#0A0B0D]/30" 
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest transition-colors group-focus-within:text-[#B8935B]">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-4 w-5 h-5 text-[#0A0B0D]/30 transition-colors duration-300 group-focus-within:text-[#B8935B]" />
                      <select 
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                        className="w-full bg-white/50 border border-transparent ring-1 ring-[#E6DFD1]/50 rounded-xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#B8935B] focus:bg-white focus:shadow-[0_0_20px_rgba(184,147,91,0.15)] transition-all duration-300 appearance-none text-[#0A0B0D]"
                      >
                        <option value="IN">India</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AE">UAE</option>
                        <option value="SA">Saudi Arabia</option>
                        <option value="AU">Australia</option>
                        <option value="CA">Canada</option>
                      </select>
                      <div className="absolute right-4 top-5 pointer-events-none text-[#0A0B0D]/40 transition-colors duration-300 group-focus-within:text-[#B8935B]">
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 space-y-4 pt-2">
                  <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest">Experience Level</label>
                  <p className="text-sm text-[#0A0B0D]/50 pb-2">Pricing scales based on the strategic depth and complexity required for your career stage.</p>
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
                        className={`relative overflow-hidden py-4 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-500 ease-out ${
                          experienceLevel === exp.id 
                            ? 'bg-[#0A0B0D] text-[#F4F1EB] border-transparent shadow-[0_10px_20px_rgba(10,11,13,0.3)] scale-[1.03] ring-2 ring-[#B8935B]' 
                            : 'bg-white/50 border border-[#E6DFD1] text-[#0A0B0D]/70 hover:bg-white hover:border-[#B8935B]/50 hover:text-[#0A0B0D] hover:-translate-y-1 hover:shadow-lg'
                        }`}
                      >
                        {experienceLevel === exp.id && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#B8935B]/20 to-transparent opacity-50" />
                        )}
                        <span className="relative z-10">{exp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="relative z-10 pt-8 animate-fade-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                  <button 
                    onClick={handleNextStep1}
                    className="w-full group relative overflow-hidden bg-gradient-to-r from-[#B8935B] via-[#E3B873] to-[#B8935B] bg-[length:200%_auto] animate-shimmer text-[#0A0B0D] font-bold text-lg rounded-xl py-5 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_10px_30px_-5px_rgba(184,147,91,0.6)]"
                  >
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-sm">
                      Continue to Services
                      <ArrowRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {step === 2 && (
             <div className="animate-fade-up">
               <div className="text-center mb-10 sm:mb-14 animate-fade-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }} >
                 <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-[#0A0B0D] mb-5">Choose Your Path</h1>
                 <p className="text-lg text-[#0A0B0D]/60 max-w-lg mx-auto">Select the executive package that aligns with your ultimate career goals.</p>
               </div>
               
               <div className="space-y-6">
                 {/* Premium Plus */}
                 <div 
                   onClick={() => setSelectedPackage('PREMIUM_PLUS')}
                   className={`group relative overflow-hidden cursor-pointer rounded-2xl sm:rounded-3xl border-2 transition-all duration-500 ease-out animate-fade-up ${
                     selectedPackage === 'PREMIUM_PLUS' 
                       ? 'bg-[#0A0B0D] border-[#B8935B] shadow-[0_20px_50px_rgba(184,147,91,0.2)] scale-[1.03] z-10' 
                       : 'bg-white/60 backdrop-blur-xl border-white/80 shadow-lg hover:border-[#B8935B]/50 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]'
                   }`}
                   style={{ animationDelay: '200ms', animationFillMode: 'both' }}
                 >
                   <div className="absolute top-0 right-0 bg-gradient-to-r from-[#B8935B] to-[#E3B873] text-[#0A0B0D] text-xs font-bold px-4 py-2 rounded-bl-2xl shadow-md flex items-center gap-1.5">
                     <Sparkles className="w-3.5 h-3.5" /> RECOMMENDED
                   </div>
                   
                   {/* Ambient internal glow */}
                   {selectedPackage === 'PREMIUM_PLUS' && (
                     <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#B8935B]/20 via-transparent to-transparent pointer-events-none" />
                   )}

                   <div className="relative z-10 p-6 sm:p-10">
                     <div className="flex items-center gap-5 sm:gap-6 mb-8">
                       <div className={`p-4 rounded-2xl transition-colors duration-500 ${selectedPackage === 'PREMIUM_PLUS' ? 'bg-[#B8935B]/20 text-[#B8935B]' : 'bg-[#F4F1EB] text-[#0A0B0D]/50 group-hover:bg-[#B8935B]/10 group-hover:text-[#B8935B]'}`}>
                         <Star className="w-7 h-7 sm:w-9 sm:h-9" />
                       </div>
                       <div>
                         <h3 className={`text-2xl sm:text-3xl font-serif font-bold transition-colors duration-500 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#F4F1EB]' : 'text-[#0A0B0D]'}`}>Premium Plus</h3>
                         <p className={`text-sm mt-1 transition-colors duration-500 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#F4F1EB]/60' : 'text-[#0A0B0D]/50'}`}>The complete personal branding overhaul.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium">
                       {['Resume Writing', 'LinkedIn Optimization', 'Cover Letter', 'Portfolio Website'].map((item, i) => (
                         <li key={item} className={`flex items-center gap-3 transition-colors duration-500 delay-[${i*100}ms] ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#F4F1EB]' : 'text-[#0A0B0D]/80'}`}>
                           <CheckCircle className={`w-5 h-5 transition-colors duration-500 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-[#B8935B]' : 'text-[#0A0B0D]/20 group-hover:text-[#B8935B]/50'}`} /> {item}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
                 
                 {/* Career Booster */}
                 <div 
                   onClick={() => setSelectedPackage('CAREER_BOOSTER')}
                   className={`group relative overflow-hidden cursor-pointer rounded-2xl sm:rounded-3xl border-2 transition-all duration-500 ease-out animate-fade-up ${
                     selectedPackage === 'CAREER_BOOSTER' 
                       ? 'bg-[#0A0B0D] border-[#B8935B] shadow-[0_20px_50px_rgba(184,147,91,0.2)] scale-[1.03] z-10' 
                       : 'bg-white/60 backdrop-blur-xl border-white/80 shadow-lg hover:border-[#B8935B]/50 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]'
                   }`}
                   style={{ animationDelay: '300ms', animationFillMode: 'both' }}
                 >
                   <div className="absolute top-0 right-0 bg-[#0A0B0D]/10 text-[#0A0B0D]/70 text-xs font-bold px-4 py-2 rounded-bl-2xl">
                     MOST POPULAR
                   </div>
                   
                   {selectedPackage === 'CAREER_BOOSTER' && (
                     <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#B8935B]/20 via-transparent to-transparent pointer-events-none" />
                   )}

                   <div className="relative z-10 p-6 sm:p-10">
                     <div className="flex items-center gap-5 sm:gap-6 mb-8">
                       <div className={`p-4 rounded-2xl transition-colors duration-500 ${selectedPackage === 'CAREER_BOOSTER' ? 'bg-[#B8935B]/20 text-[#B8935B]' : 'bg-[#F4F1EB] text-[#0A0B0D]/50 group-hover:bg-[#B8935B]/10 group-hover:text-[#B8935B]'}`}>
                         <Briefcase className="w-7 h-7 sm:w-9 sm:h-9" />
                       </div>
                       <div>
                         <h3 className={`text-2xl sm:text-3xl font-serif font-bold transition-colors duration-500 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#F4F1EB]' : 'text-[#0A0B0D]'}`}>Career Booster</h3>
                         <p className={`text-sm mt-1 transition-colors duration-500 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#F4F1EB]/60' : 'text-[#0A0B0D]/50'}`}>Everything you need to land interviews.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium">
                       {['Resume Writing', 'LinkedIn Optimization', 'Cover Letter'].map((item) => (
                         <li key={item} className={`flex items-center gap-3 transition-colors duration-500 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#F4F1EB]' : 'text-[#0A0B0D]/80'}`}>
                           <CheckCircle className={`w-5 h-5 transition-colors duration-500 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-[#B8935B]' : 'text-[#0A0B0D]/20 group-hover:text-[#B8935B]/50'}`} /> {item}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
                 
                 {/* Build Your Own */}
                 <div 
                   onClick={() => setSelectedPackage('CUSTOM')}
                   className={`group relative overflow-hidden cursor-pointer rounded-2xl sm:rounded-3xl border-2 transition-all duration-500 ease-out animate-fade-up ${
                     selectedPackage === 'CUSTOM' 
                       ? 'bg-[#0A0B0D] border-[#B8935B] shadow-[0_20px_50px_rgba(184,147,91,0.2)] scale-[1.03] z-10' 
                       : 'bg-white/60 backdrop-blur-xl border-white/80 shadow-lg hover:border-[#B8935B]/50 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]'
                   }`}
                   style={{ animationDelay: '400ms', animationFillMode: 'both' }}
                 >
                   {selectedPackage === 'CUSTOM' && (
                     <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#B8935B]/20 via-transparent to-transparent pointer-events-none" />
                   )}
                   
                   <div className="relative z-10 p-6 sm:p-10">
                     <div className="flex items-center gap-5 sm:gap-6 mb-6">
                       <div className={`p-4 rounded-2xl transition-colors duration-500 ${selectedPackage === 'CUSTOM' ? 'bg-[#B8935B]/20 text-[#B8935B]' : 'bg-[#F4F1EB] text-[#0A0B0D]/50 group-hover:bg-[#B8935B]/10 group-hover:text-[#B8935B]'}`}>
                         <Shield className="w-7 h-7 sm:w-9 sm:h-9" />
                       </div>
                       <div>
                         <h3 className={`text-2xl sm:text-3xl font-serif font-bold transition-colors duration-500 ${selectedPackage === 'CUSTOM' ? 'text-[#F4F1EB]' : 'text-[#0A0B0D]'}`}>A La Carte</h3>
                         <p className={`text-sm mt-1 transition-colors duration-500 ${selectedPackage === 'CUSTOM' ? 'text-[#F4F1EB]/60' : 'text-[#0A0B0D]/50'}`}>Select individual services tailored to your needs.</p>
                       </div>
                     </div>
                     
                     {selectedPackage === 'CUSTOM' && (
                       <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                         {['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'].map(svc => (
                           <button
                             key={svc}
                             onClick={(e) => {
                               e.stopPropagation();
                               setCustomServices(prev => 
                                 prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                               );
                             }}
                             className={`py-4 px-5 rounded-xl border text-sm font-bold transition-all duration-300 flex items-center justify-between ${
                               customServices.includes(svc)
                                 ? 'bg-gradient-to-r from-[#B8935B] to-[#E3B873] border-transparent text-[#0A0B0D] shadow-[0_5px_15px_rgba(184,147,91,0.4)] scale-[1.02]'
                                 : 'bg-white/10 border-white/20 text-[#F4F1EB]/80 hover:bg-white/20 hover:text-white'
                             }`}
                           >
                             {svc.replace('_', ' ')}
                             {customServices.includes(svc) && <CheckCircle className="w-5 h-5 text-[#0A0B0D]" />}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
                 
                  <div className="pt-8 flex flex-col gap-6 animate-fade-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
                    {countryCode !== 'IN' && (
                      <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-8 flex flex-col gap-5 shadow-lg">
                        <label className="text-xs font-bold text-[#0A0B0D]/80 uppercase tracking-widest">Select Payment Method</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            onClick={() => setPreferredGateway('PAYPAL')}
                            className={`py-5 px-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                              preferredGateway === 'PAYPAL'
                                ? 'bg-gradient-to-br from-[#B8935B]/10 to-transparent border-[#B8935B] shadow-md scale-[1.02]'
                                : 'bg-white/50 border-white hover:bg-white hover:border-[#B8935B]/40'
                            }`}
                          >
                            <div className={`font-bold text-lg ${preferredGateway === 'PAYPAL' ? 'text-[#0A0B0D]' : 'text-[#0A0B0D]/70'}`}>PayPal</div>
                            <div className={`text-sm mt-1 ${preferredGateway === 'PAYPAL' ? 'text-[#0A0B0D]/70' : 'text-[#0A0B0D]/40'}`}>Pay seamlessly in USD</div>
                          </button>
                          <button
                            onClick={() => setPreferredGateway('RAZORPAY')}
                            className={`py-5 px-6 rounded-2xl border-2 text-left transition-all duration-300 ${
                              preferredGateway === 'RAZORPAY'
                                ? 'bg-gradient-to-br from-[#B8935B]/10 to-transparent border-[#B8935B] shadow-md scale-[1.02]'
                                : 'bg-white/50 border-white hover:bg-white hover:border-[#B8935B]/40'
                            }`}
                          >
                            <div className={`font-bold text-lg ${preferredGateway === 'RAZORPAY' ? 'text-[#0A0B0D]' : 'text-[#0A0B0D]/70'}`}>Credit / Debit Card</div>
                            <div className={`text-sm mt-1 ${preferredGateway === 'RAZORPAY' ? 'text-[#0A0B0D]/70' : 'text-[#0A0B0D]/40'}`}>Pay natively in Local Currency</div>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col-reverse sm:flex-row gap-5">
                      <button 
                        onClick={() => setStep(1)}
                        className="px-8 py-5 rounded-2xl border-2 border-[#0A0B0D]/10 text-[#0A0B0D]/70 font-bold hover:bg-[#0A0B0D]/5 hover:text-[#0A0B0D] transition-all text-center"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleNextStep2}
                        disabled={loading}
                        className="flex-1 group relative overflow-hidden bg-gradient-to-r from-[#B8935B] via-[#E3B873] to-[#B8935B] bg-[length:200%_auto] animate-shimmer text-[#0A0B0D] font-bold text-lg rounded-2xl py-5 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_10px_30px_-5px_rgba(184,147,91,0.6)] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <span className="relative z-10 flex items-center gap-2 drop-shadow-sm">
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Calculate Premium Pricing'}
                          {!loading && <ArrowRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" />}
                        </span>
                      </button>
                    </div>
                  </div>
                 
               </div>
             </div>
          )}
          
          {step === 3 && pricingDraft && (
             <div className="animate-fade-up">
               <div className="text-center mb-10 sm:mb-14 animate-fade-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                 <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-[#0A0B0D] mb-5">Checkout</h1>
                 <p className="text-lg text-[#0A0B0D]/60 max-w-lg mx-auto">Secure your investment. Immediate portal access.</p>
               </div>
               
               <div className="bg-white/70 backdrop-blur-3xl border border-white rounded-3xl p-8 sm:p-12 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden animate-fade-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                 
                 <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-[#B8935B]/5 pointer-events-none" />
                 
                 <div className="relative z-10 space-y-7 mb-12">
                   <h3 className="text-xs font-bold text-[#0A0B0D]/40 uppercase tracking-widest mb-8">Order Summary</h3>
                   
                   <div className="flex justify-between items-center pb-5 border-b border-[#0A0B0D]/10">
                     <span className="font-medium text-[#0A0B0D] text-lg">Services ({selectedPackage.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})</span>
                     <span className="font-bold text-[#0A0B0D] text-lg">{pricingDraft.currencySymbol}{pricingDraft.subtotal.toLocaleString()}</span>
                   </div>
                   
                   {pricingDraft.discountAmount > 0 && (
                     <div className="flex justify-between items-center text-[#B8935B] pb-5 border-b border-[#0A0B0D]/10">
                       <span className="font-medium text-lg">Package Discount ({(pricingDraft.discountRate * 100).toFixed(0)}%)</span>
                       <span className="font-bold text-lg">-{pricingDraft.currencySymbol}{pricingDraft.discountAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   {pricingDraft.taxAmount > 0 && (
                     <div className="flex justify-between items-center text-[#0A0B0D]/60 pb-5 border-b border-[#0A0B0D]/10">
                       <span className="font-medium">Taxes ({(pricingDraft.taxRate * 100).toFixed(0)}%)</span>
                       <span>{pricingDraft.currencySymbol}{pricingDraft.taxAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-6 gap-3">
                     <div>
                       <span className="text-5xl sm:text-7xl font-serif font-bold text-[#0A0B0D] drop-shadow-sm">{pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}</span>
                       <span className="text-[#0A0B0D]/50 text-lg ml-3 font-bold">{pricingDraft.currency}</span>
                     </div>
                     <span className="text-sm text-[#0A0B0D]/40 max-w-[200px] sm:text-right font-medium">Includes all platform and gateway processing fees.</span>
                   </div>
                 </div>
                 
                 <div className="relative z-10 pt-6 flex flex-col-reverse sm:flex-row gap-5">
                   <button 
                     onClick={() => setStep(2)}
                     className="px-8 py-5 rounded-2xl border-2 border-[#0A0B0D]/10 text-[#0A0B0D]/70 font-bold hover:bg-[#0A0B0D]/5 transition-all text-center"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleCheckout}
                     className="flex-1 group relative overflow-hidden bg-gradient-to-r from-[#B8935B] via-[#E3B873] to-[#B8935B] bg-[length:200%_auto] animate-shimmer text-[#0A0B0D] font-bold text-xl rounded-2xl py-5 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_15px_40px_-5px_rgba(184,147,91,0.6)]"
                   >
                     <span className="relative z-10 flex items-center gap-2 drop-shadow-sm">
                       Complete Payment
                       <Shield className="w-6 h-6 ml-1 transition-transform duration-500 group-hover:scale-110" />
                     </span>
                   </button>
                 </div>
                 
               </div>
               
               <p className="text-center text-sm text-[#0A0B0D]/40 mt-10 max-w-md mx-auto leading-relaxed font-medium animate-fade-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }} >
                 By proceeding, you will receive an invoice marked as PENDING_PAYMENT. Full access to the client portal is granted immediately upon successful completion.
               </p>
             </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

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
    <div className="min-h-screen bg-brand-bone text-brand-obsidian selection:bg-brand-gold/30 selection:text-brand-obsidian flex flex-col font-sans relative overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-bone via-brand-gold to-brand-bone z-10" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-parchment blur-[100px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-gold/10 blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="py-4 px-6 sm:px-12 border-b border-brand-parchment sticky top-0 bg-brand-bone/80 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={32} brandId="catalyst" dark={false} />
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-brand-obsidian/40">
            <span className={`transition-colors ${step >= 1 ? 'text-brand-gold font-bold' : ''}`}>1. Details</span>
            <ChevronRight className="w-4 h-4 opacity-30 mx-1" />
            <span className={`transition-colors ${step >= 2 ? 'text-brand-gold font-bold' : ''}`}>2. Services</span>
            <ChevronRight className="w-4 h-4 opacity-30 mx-1" />
            <span className={`transition-colors ${step === 3 ? 'text-brand-gold font-bold' : ''}`}>3. Checkout</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 z-10 w-full">
        <div className="w-full max-w-2xl">
          
          {step === 1 && (
            <div className="animate-fade-up">
              <div className="text-center mb-8 sm:mb-12">
                <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-brand-obsidian mb-4">Let&apos;s get started.</h1>
                <p className="text-lg text-brand-obsidian/60">Enter your details to generate your customized portfolio and pricing.</p>
              </div>
              
              <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-xl border border-white space-y-6 sm:space-y-8 relative overflow-hidden">
                {/* Subtle Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-brand-parchment/30 pointer-events-none" />
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 w-5 h-5 text-brand-obsidian/30" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-brand-bone/50 border-none ring-1 ring-brand-parchment rounded-xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-brand-gold focus:bg-white transition-all text-brand-obsidian placeholder:text-brand-obsidian/30" 
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-5 h-5 text-brand-obsidian/30" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-brand-bone/50 border-none ring-1 ring-brand-parchment rounded-xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-brand-gold focus:bg-white transition-all text-brand-obsidian placeholder:text-brand-obsidian/30" 
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 w-5 h-5 text-brand-obsidian/30" />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-brand-bone/50 border-none ring-1 ring-brand-parchment rounded-xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-brand-gold focus:bg-white transition-all text-brand-obsidian placeholder:text-brand-obsidian/30" 
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-3.5 w-5 h-5 text-brand-obsidian/30" />
                      <select 
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                        className="w-full bg-brand-bone/50 border-none ring-1 ring-brand-parchment rounded-xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-brand-gold focus:bg-white transition-all appearance-none text-brand-obsidian"
                      >
                        <option value="IN">India</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AE">UAE</option>
                        <option value="SA">Saudi Arabia</option>
                        <option value="AU">Australia</option>
                        <option value="CA">Canada</option>
                      </select>
                      {/* Custom select arrow */}
                      <div className="absolute right-4 top-4 pointer-events-none text-brand-obsidian/40">
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 space-y-3 pt-2">
                  <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide flex items-center justify-between">
                    <span>Experience Level</span>
                  </label>
                  <p className="text-xs text-brand-obsidian/50 pb-2">Pricing is tailored to the strategic depth and complexity required for your career stage.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'FRESHER', label: '0-2 Years' },
                      { id: 'MID_CAREER', label: '3-7 Years' },
                      { id: 'EXECUTIVE', label: '8-14 Years' },
                      { id: 'EXECUTIVE_PLUS', label: '15+ Years' }
                    ].map(exp => (
                      <button
                        key={exp.id}
                        onClick={() => setExperienceLevel(exp.id as ClientType)}
                        className={`py-3 px-2 sm:px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-300 ${
                          experienceLevel === exp.id 
                            ? 'bg-brand-gold text-white border-brand-gold shadow-md shadow-brand-gold/20 scale-[1.02]' 
                            : 'bg-white border-brand-parchment text-brand-obsidian/70 hover:bg-brand-bone hover:border-brand-gold/30 hover:text-brand-obsidian'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="relative z-10 pt-8">
                  <button 
                    onClick={handleNextStep1}
                    className="w-full bg-brand-obsidian text-brand-bone font-bold text-lg rounded-xl py-4 hover:bg-brand-graphite hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-obsidian/10"
                  >
                    Continue to Services
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {step === 2 && (
             <div className="animate-fade-up">
               <div className="text-center mb-8 sm:mb-12">
                 <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-brand-obsidian mb-4">Choose Your Path</h1>
                 <p className="text-lg text-brand-obsidian/60">Select the executive package that aligns with your career goals.</p>
               </div>
               
               <div className="space-y-6">
                 {/* Premium Plus */}
                 <div 
                   onClick={() => setSelectedPackage('PREMIUM_PLUS')}
                   className={`relative cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 ${
                     selectedPackage === 'PREMIUM_PLUS' 
                       ? 'bg-brand-obsidian border-brand-gold shadow-2xl shadow-brand-gold/20 scale-[1.02]' 
                       : 'bg-white border-brand-parchment hover:border-brand-gold/50'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-brand-gold text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl flex items-center gap-1">
                     <Sparkles className="w-3 h-3" /> RECOMMENDED
                   </div>
                   <div className="p-6 sm:p-8">
                     <div className="flex items-center gap-4 sm:gap-6 mb-6">
                       <div className={`p-4 rounded-2xl ${selectedPackage === 'PREMIUM_PLUS' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-bone text-brand-obsidian/50'}`}>
                         <Star className="w-6 h-6 sm:w-8 sm:h-8" />
                       </div>
                       <div>
                         <h3 className={`text-2xl font-serif font-bold ${selectedPackage === 'PREMIUM_PLUS' ? 'text-brand-bone' : 'text-brand-obsidian'}`}>Premium Plus</h3>
                         <p className={`text-sm ${selectedPackage === 'PREMIUM_PLUS' ? 'text-brand-bone/60' : 'text-brand-obsidian/50'}`}>The complete personal branding overhaul.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium">
                       {['Resume Writing', 'LinkedIn Optimization', 'Cover Letter', 'Portfolio Website'].map(item => (
                         <li key={item} className={`flex items-center gap-3 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-brand-bone' : 'text-brand-obsidian/80'}`}>
                           <CheckCircle className={`w-5 h-5 ${selectedPackage === 'PREMIUM_PLUS' ? 'text-brand-gold' : 'text-brand-obsidian/30'}`} /> {item}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
                 
                 {/* Career Booster */}
                 <div 
                   onClick={() => setSelectedPackage('CAREER_BOOSTER')}
                   className={`relative cursor-pointer rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 ${
                     selectedPackage === 'CAREER_BOOSTER' 
                       ? 'bg-white border-brand-gold shadow-xl shadow-brand-gold/10 scale-[1.02]' 
                       : 'bg-white border-brand-parchment hover:border-brand-gold/50'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-brand-obsidian/5 text-brand-obsidian/60 text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                     MOST POPULAR
                   </div>
                   <div className="p-6 sm:p-8">
                     <div className="flex items-center gap-4 sm:gap-6 mb-6">
                       <div className={`p-4 rounded-2xl ${selectedPackage === 'CAREER_BOOSTER' ? 'bg-brand-gold/10 text-brand-gold' : 'bg-brand-bone text-brand-obsidian/50'}`}>
                         <Briefcase className="w-6 h-6 sm:w-8 sm:h-8" />
                       </div>
                       <div>
                         <h3 className="text-2xl font-serif font-bold text-brand-obsidian">Career Booster</h3>
                         <p className="text-sm text-brand-obsidian/50">Everything you need to land interviews.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium text-brand-obsidian/80">
                       {['Resume Writing', 'LinkedIn Optimization', 'Cover Letter'].map(item => (
                         <li key={item} className="flex items-center gap-3">
                           <CheckCircle className={`w-5 h-5 ${selectedPackage === 'CAREER_BOOSTER' ? 'text-brand-gold' : 'text-brand-obsidian/30'}`} /> {item}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
                 
                 {/* Build Your Own */}
                 <div 
                   onClick={() => setSelectedPackage('CUSTOM')}
                   className={`relative cursor-pointer rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 ${
                     selectedPackage === 'CUSTOM' 
                       ? 'bg-white border-brand-obsidian shadow-xl scale-[1.02]' 
                       : 'bg-white border-brand-parchment hover:border-brand-obsidian/50'
                   }`}
                 >
                   <div className="p-6 sm:p-8">
                     <div className="flex items-center gap-4 sm:gap-6 mb-4">
                       <div className={`p-4 rounded-2xl ${selectedPackage === 'CUSTOM' ? 'bg-brand-obsidian text-white' : 'bg-brand-bone text-brand-obsidian/50'}`}>
                         <Shield className="w-6 h-6 sm:w-8 sm:h-8" />
                       </div>
                       <div>
                         <h3 className="text-2xl font-serif font-bold text-brand-obsidian">A La Carte</h3>
                         <p className="text-sm text-brand-obsidian/50">Select individual services.</p>
                       </div>
                     </div>
                     
                     {selectedPackage === 'CUSTOM' && (
                       <div className="mt-6 pt-6 border-t border-brand-parchment grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'].map(svc => (
                           <button
                             key={svc}
                             onClick={(e) => {
                               e.stopPropagation();
                               setCustomServices(prev => 
                                 prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                               );
                             }}
                             className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-between ${
                               customServices.includes(svc)
                                 ? 'bg-brand-obsidian border-brand-obsidian text-white shadow-md'
                                 : 'bg-transparent border-brand-parchment text-brand-obsidian/60 hover:bg-brand-bone'
                             }`}
                           >
                             {svc.replace('_', ' ')}
                             {customServices.includes(svc) && <CheckCircle className="w-4 h-4 text-brand-gold" />}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
                 
                  <div className="pt-8 flex flex-col gap-6">
                    {countryCode !== 'IN' && (
                      <div className="bg-white border border-brand-parchment rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-sm">
                        <label className="text-sm font-bold text-brand-obsidian/80 uppercase tracking-wide">Select Payment Method</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            onClick={() => setPreferredGateway('PAYPAL')}
                            className={`py-4 px-5 rounded-xl border-2 text-left transition-all ${
                              preferredGateway === 'PAYPAL'
                                ? 'bg-brand-gold/10 border-brand-gold shadow-md'
                                : 'bg-transparent border-brand-parchment hover:bg-brand-bone hover:border-brand-gold/30'
                            }`}
                          >
                            <div className={`font-bold text-lg ${preferredGateway === 'PAYPAL' ? 'text-brand-obsidian' : 'text-brand-obsidian/70'}`}>PayPal</div>
                            <div className={`text-sm mt-1 ${preferredGateway === 'PAYPAL' ? 'text-brand-obsidian/70' : 'text-brand-obsidian/40'}`}>Pay seamlessly in USD</div>
                          </button>
                          <button
                            onClick={() => setPreferredGateway('RAZORPAY')}
                            className={`py-4 px-5 rounded-xl border-2 text-left transition-all ${
                              preferredGateway === 'RAZORPAY'
                                ? 'bg-brand-gold/10 border-brand-gold shadow-md'
                                : 'bg-transparent border-brand-parchment hover:bg-brand-bone hover:border-brand-gold/30'
                            }`}
                          >
                            <div className={`font-bold text-lg ${preferredGateway === 'RAZORPAY' ? 'text-brand-obsidian' : 'text-brand-obsidian/70'}`}>Credit / Debit Card</div>
                            <div className={`text-sm mt-1 ${preferredGateway === 'RAZORPAY' ? 'text-brand-obsidian/70' : 'text-brand-obsidian/40'}`}>Pay natively in Local Currency</div>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col-reverse sm:flex-row gap-4">
                      <button 
                        onClick={() => setStep(1)}
                        className="px-6 py-4 rounded-xl border-2 border-brand-parchment text-brand-obsidian/70 font-bold hover:bg-brand-bone hover:text-brand-obsidian transition-all text-center"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleNextStep2}
                        disabled={loading}
                        className="flex-1 bg-brand-gold text-white font-bold text-lg rounded-xl py-4 hover:bg-[#a6824a] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-brand-gold/30 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Calculate Pricing'}
                        {!loading && <ArrowRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                 
               </div>
             </div>
          )}
          
          {step === 3 && pricingDraft && (
             <div className="animate-fade-up">
               <div className="text-center mb-8 sm:mb-12">
                 <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-brand-obsidian mb-4">Checkout</h1>
                 <p className="text-lg text-brand-obsidian/60">Secure payment. Immediate portal access.</p>
               </div>
               
               <div className="bg-white border border-brand-parchment rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                 
                 <div className="space-y-6 mb-10">
                   <h3 className="text-xs font-bold text-brand-obsidian/40 uppercase tracking-widest mb-6">Order Summary</h3>
                   
                   <div className="flex justify-between items-center pb-4 border-b border-brand-parchment/50">
                     <span className="font-medium text-brand-obsidian">Services ({selectedPackage.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})</span>
                     <span className="font-bold text-brand-obsidian">{pricingDraft.currencySymbol}{pricingDraft.subtotal.toLocaleString()}</span>
                   </div>
                   
                   {pricingDraft.discountAmount > 0 && (
                     <div className="flex justify-between items-center text-brand-gold pb-4 border-b border-brand-parchment/50">
                       <span className="font-medium">Package Discount ({(pricingDraft.discountRate * 100).toFixed(0)}%)</span>
                       <span className="font-bold">-{pricingDraft.currencySymbol}{pricingDraft.discountAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   {pricingDraft.taxAmount > 0 && (
                     <div className="flex justify-between items-center text-brand-obsidian/60 pb-4 border-b border-brand-parchment/50">
                       <span className="font-medium">Taxes ({(pricingDraft.taxRate * 100).toFixed(0)}%)</span>
                       <span>{pricingDraft.currencySymbol}{pricingDraft.taxAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end pt-4 gap-2">
                     <div>
                       <span className="text-4xl sm:text-5xl font-serif font-bold text-brand-obsidian">{pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}</span>
                       <span className="text-brand-obsidian/50 text-sm ml-2 font-bold">{pricingDraft.currency}</span>
                     </div>
                     <span className="text-xs text-brand-obsidian/40 max-w-[200px] sm:text-right">Includes all platform and gateway processing fees.</span>
                   </div>
                 </div>
                 
                 <div className="pt-6 flex flex-col-reverse sm:flex-row gap-4">
                   <button 
                     onClick={() => setStep(2)}
                     className="px-6 py-4 rounded-xl border-2 border-brand-parchment text-brand-obsidian/70 font-bold hover:bg-brand-bone transition-all text-center"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleCheckout}
                     className="flex-1 bg-brand-obsidian text-brand-bone font-bold text-lg rounded-xl py-4 hover:bg-brand-graphite hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-2xl shadow-brand-obsidian/20"
                   >
                     Complete Payment
                     <Shield className="w-5 h-5 ml-1" />
                   </button>
                 </div>
                 
               </div>
               
               <p className="text-center text-xs text-brand-obsidian/40 mt-8 max-w-md mx-auto leading-relaxed">
                 By proceeding, you will receive an invoice marked as PENDING_PAYMENT. Full access to the client portal is granted immediately upon successful completion of the transaction.
               </p>
             </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

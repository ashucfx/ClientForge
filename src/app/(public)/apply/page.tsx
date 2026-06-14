'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight, User, Briefcase, Mail, Phone, Globe, Star, Shield, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { ClientType } from '@prisma/client';

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
      
      const payload = {
        name,
        email,
        phone,
        countryCode,
        experienceLevel,
        packageSlug: selectedPackage,
        services: servicesToPass
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
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-blue-500/30 flex flex-col font-sans relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-10" />
      <div className="absolute -top-[500px] left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="py-6 px-8 border-b border-white/10 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-xl z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Catalyst Career
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-white/50">
            <span className={step >= 1 ? 'text-blue-400' : ''}>1. Details</span>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className={step >= 2 ? 'text-blue-400' : ''}>2. Services</span>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className={step === 3 ? 'text-blue-400' : ''}>3. Checkout</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 z-10">
        <div className="w-full max-w-2xl">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Let's get started.</h1>
                <p className="text-lg text-white/60">Enter your details to generate your customized portfolio and pricing.</p>
              </div>
              
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all" 
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all" 
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all" 
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 w-5 h-5 text-white/30" />
                      <select 
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                        className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all appearance-none text-white"
                      >
                        <option value="IN">India</option>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AE">UAE</option>
                        <option value="AU">Australia</option>
                        <option value="CA">Canada</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium text-white/70">Experience Level</label>
                  <p className="text-xs text-white/40 pb-2">Pricing scales based on career complexity and strategic positioning required.</p>
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
                        className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                          experienceLevel === exp.id 
                            ? 'bg-blue-500/20 border-blue-500 text-blue-300' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {exp.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="pt-6">
                  <button 
                    onClick={handleNextStep1}
                    className="w-full bg-white text-black font-bold text-lg rounded-xl py-4 hover:bg-white/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                  >
                    Continue to Services
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {step === 2 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500">
               <div className="text-center mb-10">
                 <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Choose Your Services</h1>
                 <p className="text-lg text-white/60">Select the package that fits your career goals.</p>
               </div>
               
               <div className="space-y-4">
                 {/* Premium Plus */}
                 <div 
                   onClick={() => setSelectedPackage('PREMIUM_PLUS')}
                   className={`relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                     selectedPackage === 'PREMIUM_PLUS' 
                       ? 'bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]' 
                       : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                     <Sparkles className="w-3 h-3" /> RECOMMENDED
                   </div>
                   <div className="p-6">
                     <div className="flex items-center gap-4 mb-4">
                       <div className={`p-3 rounded-xl ${selectedPackage === 'PREMIUM_PLUS' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/50'}`}>
                         <Star className="w-6 h-6" />
                       </div>
                       <div>
                         <h3 className="text-xl font-bold">Premium Plus</h3>
                         <p className="text-white/50 text-sm">The complete personal branding overhaul.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-2 gap-2 text-sm text-white/70">
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Resume Writing</li>
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> LinkedIn Optimization</li>
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Cover Letter</li>
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Portfolio Website</li>
                     </ul>
                   </div>
                 </div>
                 
                 {/* Career Booster */}
                 <div 
                   onClick={() => setSelectedPackage('CAREER_BOOSTER')}
                   className={`relative cursor-pointer rounded-2xl border transition-all duration-300 ${
                     selectedPackage === 'CAREER_BOOSTER' 
                       ? 'bg-gradient-to-br from-blue-900/40 to-sky-900/40 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' 
                       : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                   }`}
                 >
                   <div className="absolute top-0 right-0 bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-bl-lg">
                     MOST POPULAR
                   </div>
                   <div className="p-6">
                     <div className="flex items-center gap-4 mb-4">
                       <div className={`p-3 rounded-xl ${selectedPackage === 'CAREER_BOOSTER' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/50'}`}>
                         <Briefcase className="w-6 h-6" />
                       </div>
                       <div>
                         <h3 className="text-xl font-bold">Career Booster</h3>
                         <p className="text-white/50 text-sm">Everything you need to land interviews.</p>
                       </div>
                     </div>
                     <ul className="grid grid-cols-2 gap-2 text-sm text-white/70">
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Resume Writing</li>
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> LinkedIn Optimization</li>
                       <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Cover Letter</li>
                     </ul>
                   </div>
                 </div>
                 
                 {/* Build Your Own */}
                 <div 
                   onClick={() => setSelectedPackage('CUSTOM')}
                   className={`relative cursor-pointer rounded-2xl border transition-all duration-300 ${
                     selectedPackage === 'CUSTOM' 
                       ? 'bg-white/[0.05] border-white/30' 
                       : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                   }`}
                 >
                   <div className="p-6">
                     <div className="flex items-center gap-4 mb-4">
                       <div className={`p-3 rounded-xl ${selectedPackage === 'CUSTOM' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/50'}`}>
                         <Shield className="w-6 h-6" />
                       </div>
                       <div>
                         <h3 className="text-xl font-bold">A La Carte</h3>
                         <p className="text-white/50 text-sm">Select individual services.</p>
                       </div>
                     </div>
                     
                     {selectedPackage === 'CUSTOM' && (
                       <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                         {['RESUME', 'LINKEDIN', 'COVER_LETTER', 'PORTFOLIO'].map(svc => (
                           <button
                             key={svc}
                             onClick={(e) => {
                               e.stopPropagation();
                               setCustomServices(prev => 
                                 prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                               );
                             }}
                             className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all text-left flex items-center justify-between ${
                               customServices.includes(svc)
                                 ? 'bg-white/10 border-white/30 text-white'
                                 : 'bg-transparent border-white/10 text-white/50 hover:bg-white/5'
                             }`}
                           >
                             {svc.replace('_', ' ')}
                             {customServices.includes(svc) && <CheckCircle className="w-4 h-4 text-white" />}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
                 
                 <div className="pt-6 flex gap-4">
                   <button 
                     onClick={() => setStep(1)}
                     className="px-6 py-4 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-all"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleNextStep2}
                     disabled={loading}
                     className="flex-1 bg-white text-black font-bold text-lg rounded-xl py-4 hover:bg-white/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:pointer-events-none"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Calculate Pricing'}
                     {!loading && <ArrowRight className="w-5 h-5" />}
                   </button>
                 </div>
                 
               </div>
             </div>
          )}
          
          {step === 3 && pricingDraft && (
             <div className="animate-in fade-in zoom-in-95 duration-500">
               <div className="text-center mb-10">
                 <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Checkout</h1>
                 <p className="text-lg text-white/60">Secure payment. Immediate portal access.</p>
               </div>
               
               <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl relative overflow-hidden">
                 
                 <div className="space-y-4 mb-8">
                   <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Order Summary</h3>
                   
                   <div className="flex justify-between items-center pb-4 border-b border-white/10">
                     <span className="font-medium">Services ({selectedPackage.replace('_', ' ')})</span>
                     <span>{pricingDraft.currencySymbol}{pricingDraft.subtotal.toLocaleString()}</span>
                   </div>
                   
                   {pricingDraft.discountAmount > 0 && (
                     <div className="flex justify-between items-center text-green-400 pb-4 border-b border-white/10">
                       <span className="font-medium">Package Discount ({(pricingDraft.discountRate * 100).toFixed(0)}%)</span>
                       <span>-{pricingDraft.currencySymbol}{pricingDraft.discountAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   {pricingDraft.taxAmount > 0 && (
                     <div className="flex justify-between items-center text-white/70 pb-4 border-b border-white/10">
                       <span className="font-medium">Taxes ({(pricingDraft.taxRate * 100).toFixed(0)}%)</span>
                       <span>{pricingDraft.currencySymbol}{pricingDraft.taxAmount.toLocaleString()}</span>
                     </div>
                   )}
                   
                   <div className="flex justify-between items-end pt-4">
                     <div>
                       <span className="text-3xl font-bold">{pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}</span>
                       <span className="text-white/50 text-sm ml-2">{pricingDraft.currency}</span>
                     </div>
                     <span className="text-xs text-white/30 max-w-[150px] text-right">Includes all platform and gateway fees.</span>
                   </div>
                 </div>
                 
                 <div className="pt-4 flex gap-4">
                   <button 
                     onClick={() => setStep(2)}
                     className="px-6 py-4 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-all"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleCheckout}
                     className="flex-1 bg-blue-600 text-white font-bold text-lg rounded-xl py-4 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(37,99,235,0.4)]"
                   >
                     Pay {pricingDraft.currencySymbol}{pricingDraft.finalPayable.toLocaleString()}
                     <Shield className="w-5 h-5 ml-1" />
                   </button>
                 </div>
                 
               </div>
               
               <p className="text-center text-xs text-white/30 mt-6 max-w-sm mx-auto">
                 By proceeding, you will receive an invoice marked as PENDING_PAYMENT. Access to the client portal is granted immediately upon successful payment.
               </p>
             </div>
          )}
          
        </div>
      </main>
    </div>
  );
}

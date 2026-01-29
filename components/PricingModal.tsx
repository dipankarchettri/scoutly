import React, { useState } from 'react';
import { X, Check, Zap, Star } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: 'free' | 'paid';
  onSuccess: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ 
  isOpen, 
  onClose, 
  currentTier,
  onSuccess 
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('http://localhost:5000/api/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        throw new Error(data.error || 'Upgrade failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process upgrade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
         
         <button 
           onClick={onClose}
           className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-colors"
         >
           <X size={20} />
         </button>

         {/* Free Tier */}
         <div className="flex-1 p-8 flex flex-col border-b md:border-b-0 md:border-r border-white/10 bg-black/20">
            <h3 className="text-xl font-semibold text-gray-400 mb-2">Starter</h3>
            <div className="text-3xl font-bold text-white mb-6">$0<span className="text-sm font-normal text-gray-500">/mo</span></div>
            
            <ul className="space-y-4 mb-8 flex-1">
               <li className="flex items-center gap-3 text-sm text-gray-300">
                  <Check size={16} className="text-gray-500" />
                  <span>2 Free Search Credits today</span>
               </li>
               <li className="flex items-center gap-3 text-sm text-gray-300">
                  <Check size={16} className="text-gray-500" />
                  <span>Basic Search Sources</span>
               </li>
               <li className="flex items-center gap-3 text-sm text-gray-300">
                  <Check size={16} className="text-gray-500" />
                  <span>Waitlist for Pro Features</span>
               </li>
            </ul>

            <button 
              disabled={true} 
              className="w-full py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-medium cursor-default bg-white/5"
            >
              Current Plan
            </button>
         </div>

         {/* Pro Tier */}
         <div className="flex-1 p-8 flex flex-col bg-gradient-to-br from-purple-900/10 to-blue-900/10 relative overflow-hidden">
            {/* Highlight Glow */}
            <div className="absolute top-0 right-0 p-3">
               <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-lg shadow-purple-500/20">
                 Recommended
               </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
               Pro <Zap size={16} className="text-yellow-400 fill-yellow-400" />
            </h3>
            <div className="text-3xl font-bold text-white mb-6">$20<span className="text-sm font-normal text-gray-500">/mo</span></div>

            <ul className="space-y-4 mb-8 flex-1">
               <li className="flex items-center gap-3 text-sm text-white">
                  <div className="bg-green-500/20 p-1 rounded-full"><Check size={12} className="text-green-400" /></div>
                  <span>50 Search Credits per day</span>
               </li>
               <li className="flex items-center gap-3 text-sm text-white">
                  <div className="bg-green-500/20 p-1 rounded-full"><Check size={12} className="text-green-400" /></div>
                  <span>Premium Sources (Exa, Tavily, Perplexity)</span>
               </li>
               <li className="flex items-center gap-3 text-sm text-white">
                  <div className="bg-green-500/20 p-1 rounded-full"><Check size={12} className="text-green-400" /></div>
                  <span>Deep Research Mode</span>
               </li>
               <li className="flex items-center gap-3 text-sm text-white">
                  <div className="bg-green-500/20 p-1 rounded-full"><Check size={12} className="text-green-400" /></div>
                  <span>Export to CSV/CRM</span>
               </li>
            </ul>

            {error && (
              <div className="mb-4 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                {error}
              </div>
            )}

            <button 
              onClick={handleUpgrade}
              disabled={loading || currentTier === 'paid'}
              className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                 <>Processing...</>
              ) : currentTier === 'paid' ? (
                 <>Active Plan</>
              ) : (
                 <>Upgrade to Pro</>
              )}
            </button>
            <div className="mt-3 text-center">
                <p className="text-[10px] text-gray-500">Secure payment powered by Stripe (Mock)</p>
            </div>
         </div>
      </div>
    </div>
  );
};

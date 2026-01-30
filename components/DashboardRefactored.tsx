/**
 * Refactored Dashboard using Scoutly v2 Search API
 * Replace Dashboard.tsx with this version
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchStartups, searchStartups } from '../src/services/api';
import { Startup, Timeframe, FilterConfig, SearchResponse } from '../types';
import { StartupCard } from './StartupCard';
import { StartupModal } from './StartupModal';
import { PricingModal } from './PricingModal';

// UI Components (Icons)
import {
  ArrowLeft,
  Search as SearchIcon,
  Zap,
  Filter,
  Loader,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity,
  Clock,
  LayoutGrid,
  X,
  Bookmark
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// Credit Display Widget
const CreditWidget = ({ credits, onUpgrade }: { credits?: SearchResponse['credits'], onUpgrade: () => void }) => {
  if (!credits) return null;

  const isLow = credits.remaining <= 1;
  const maxCredits = credits.tier === 'paid' ? 50 : 2;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md ${isLow ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      }`}>
      <Zap className="w-3 h-3" />
      <span>{credits.remaining} / {maxCredits} Credits {credits.tier === 'free' ? 'Free' : 'Pro'}</span>
      {credits.tier === 'free' && (
        <button
          onClick={onUpgrade}
          className="ml-2 hover:underline text-[10px] uppercase font-bold tracking-wider opacity-80 hover:opacity-100"
        >
          Upgrade
        </button>
      )}
    </div>
  );
};

export interface DashboardProps {
  initialDomain?: string | null;
  initialMode?: 'agent' | 'database';
  onBack: () => void;
}

const TIMELINE_STEPS: { id: Timeframe; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '2_days', label: '2 Days' },
  { id: 'week', label: '1 Week' },
  { id: 'month', label: '1 Month' },
  { id: 'quarter', label: 'Quarter' },
];

// Settings Modal for BYOK
const SettingsModal = ({
  isOpen,
  onClose,
  apiKey,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSave: (key: string) => void;
}) => {
  const [key, setKey] = useState(apiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              OpenRouter API Key (BYOK)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Use your own LLM API key for unlimited extraction.
            </p>
            <div className="relative">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-purple-500 text-white placeholder:text-gray-700"
              />
            </div>
          </div>

          <button
            onClick={() => { onSave(key); onClose(); }}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

import { useAuth } from '@clerk/clerk-react';

export const DashboardRefactored: React.FC<DashboardProps> = ({
  initialDomain,
  initialMode = 'agent',
  onBack,
}) => {
  // State
  const { getToken } = useAuth();
  const [query, setQuery] = useState(initialDomain || '');
  const [results, setResults] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ totalCompanies: 0, totalPages: 0, latency: 0 });
  const [credits, setCredits] = useState<SearchResponse['credits']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);

  // Saved / View Mode State
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search');
  const [savedStartups, setSavedStartups] = useState<Startup[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // BYOK State
  const [showSettings, setShowSettings] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('scoutly_llm_key') || '');

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('scoutly_llm_key', key);
  };

  // Refresh User Data
  const refreshUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('http://localhost:5000/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.user) {
        setCredits({
          tier: data.user.tier,
          used: 0,
          remaining: data.user.credits
        });
      }
    } catch (e) {
      console.error("Failed to refresh user", e);
    }
  };

  // Fetch Saved Startups
  const fetchSaved = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('http://localhost:5000/api/me/saved', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Map Mongoose _id to id
        const mappedSaved = data.data.map((s: any) => ({
          ...s,
          id: s._id || s.id
        }));
        setSavedStartups(mappedSaved);
        setSavedIds(new Set(mappedSaved.map((s: Startup) => s.id)));
      }
    } catch (e) {
      console.error("Failed to fetch saved", e);
    }
  };

  // Toggle Save
  const handleToggleSave = async (startup: Startup) => {
    // Optimistic UI Update
    const isSaved = savedIds.has(startup.id);
    const newSet = new Set(savedIds);
    if (isSaved) {
      newSet.delete(startup.id);
      setSavedStartups(prev => prev.filter(s => s.id !== startup.id));
    } else {
      newSet.add(startup.id);
      setSavedStartups(prev => [startup, ...prev]);
    }
    setSavedIds(newSet);

    try {
      const token = await getToken();
      await fetch(`http://localhost:5000/api/startups/${startup.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      // Background refresh to ensure consistency
      fetchSaved();
    } catch (e) {
      console.error("Save failed", e);
      // Revert if needed (omitted for brevity)
    }
  };

  // Initial Load & Mode Handling
  useEffect(() => {
    const initInfo = async () => {
      await refreshUser();
      await fetchSaved();
    };
    initInfo();

    if (initialMode === 'database') {
      // Check for PRO tier (Client-side check via loadRecentStartups logic or separate)
      loadRecentStartups();
      setViewMode('search');

    } else if (initialMode === 'agent') {
      if (initialDomain) {
        handleSearch(initialDomain);
      }
      setViewMode('search');
    }
  }, [initialDomain, initialMode]);

  const loadStartupsByDomain = async (domain: string) => {
    setLoading(true);
    setQuery(domain);
    try {
      const data: any[] = await fetchStartups('quarter', { domain, onlyNew: false });
      const mappedData: Startup[] = data.map(item => ({
        ...item,
        id: item._id || item.id || `startup-${Date.now()}-${Math.random()}`
      }));
      setResults(mappedData);
      setStats({
        totalCompanies: mappedData.length,
        totalPages: 1,
        latency: 0
      });
    } catch (err) {
      setError('Failed to load startups for ' + domain);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentStartups = async () => {
    setLoading(true);
    try {
      // Check Tier (Client-side check for UX)
      const token = await getToken();
      const resUser = await fetch('http://localhost:5000/api/me', { headers: { Authorization: `Bearer ${token}` } });
      const dataUser = await resUser.json();
      if (dataUser.user?.tier !== 'paid') {
        setLoading(false);
        setShowPricing(true); // Forced Upgrade
        return;
      }

      const data: any[] = await fetchStartups('quarter', { onlyNew: false });

      // Map Mongoose _id to id
      const mappedData: Startup[] = data.map(item => ({
        ...item,
        id: item._id || item.id || `startup-${Date.now()}-${Math.random()}`
      }));

      // Sort: Newest First
      mappedData.sort((a, b) =>
        new Date(b.dateAnnounced).getTime() - new Date(a.dateAnnounced).getTime()
      );

      setResults(mappedData);
      setStats({
        totalCompanies: mappedData.length, // Simple count for direct fetch
        totalPages: 1,
        latency: 0
      });
    } catch (err: any) {
      console.error("Failed to load recent:", err);
      setError("Failed to load recent startups");
    } finally {
      setLoading(false);
    }
  };

  // Search Handler
  const handleSearch = async (searchQuery: string, pageNum: number = 1) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Get token for search
      const token = await getToken();

      // PARALLEL EXECUTION: Agent Search + Database Search
      const [agentRes, dbRes] = await Promise.allSettled([
        // 1. Agent Search
        fetch('http://localhost:5000/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(apiKey ? { 'x-llm-api-key': apiKey } : {})
          },
          body: JSON.stringify({
            query: searchQuery,
            page: pageNum,
            tier: 'free'
          })
        }).then(res => res.json()),

        // 2. Database Search (Existing startups)
        fetchStartups('quarter', { domain: searchQuery, onlyNew: false })
      ]);

      // Process Database Results
      let dbStartups: Startup[] = [];
      if (dbRes.status === 'fulfilled') {
        dbStartups = dbRes.value.map((item: any) => ({
          ...item,
          id: item._id || item.id
        }));
      }

      // Process Agent Results
      let agentStartups: Startup[] = [];
      let newCredits = credits;
      let searchStats = { total: 0, pages: 1, latency: 0 };

      if (agentRes.status === 'fulfilled') {
        const response = agentRes.value;

        if (!response.success && response.error === 'Insufficient credits') {
          setError(`Insufficient credits. You have ${response.credits} credits remaining.`);
          setCredits({ tier: 'free', used: 0, remaining: response.credits });
          return;
        }

        if (response.success && response.data) {
          agentStartups = response.data.companies.map((c: any, index: number) => ({
            id: `search-${index}-${Date.now()}`,
            name: c.name,
            fundingAmount: c.fundingAmount || 'Undisclosed',
            roundType: c.roundType || 'Unknown',
            dateAnnounced: c.dateAnnounced || new Date().toISOString(),
            description: c.description,
            investors: c.investors || [],
            founders: c.founders || [],
            industry: c.industry,
            website: c.website,
            location: c.location,
            sources: [c.source],
            tags: c.tags || [],
            confidence: c.confidence,
            sourceUrl: c.sourceUrl,
            socialLinks: {}
          }));
          newCredits = response.credits;
          searchStats = {
            total: response.data.pagination.totalCompanies,
            pages: response.data.pagination.totalPages,
            latency: response.data.meta.totalLatencyMs
          };
        } else if (agentRes.value.error) {
          // If agent fails, we might still want to show DB results?
          // For now let's just log it.
          console.warn("Agent search warning:", agentRes.value.error);
        }
      }

      // MERGE & DEDUP
      // We want to combine them, but prefer DB record if it has better data? 
      // Actually, Agent data is "live", DB data is "historical".
      // Let's stack Agent results ON TOP of DB results.
      // Dedup by Name (fuzzy or exact).

      const combined = [...agentStartups];
      const agentNames = new Set(agentStartups.map(s => s.name.toLowerCase()));

      dbStartups.forEach(s => {
        if (!agentNames.has(s.name.toLowerCase())) {
          combined.push(s);
        }
      });

      if (combined.length === 0) {
        setError('No results found in Database or Live Search.');
      } else {
        setResults(combined);
        setStats({
          totalCompanies: combined.length,
          totalPages: Math.max(searchStats.pages, 1),
          latency: searchStats.latency
        });
        if (newCredits) setCredits(newCredits);
        setPage(pageNum);
      }

    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        onSave={handleSaveKey}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Scoutly <span className="text-xs font-mono text-gray-500 ml-1">v2.0</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors relative"
              title="Settings (BYOK)"
            >
              <Database className={`w-5 h-5 ${apiKey ? 'text-purple-400' : 'text-gray-400'}`} />
              {apiKey && <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></span>}
            </button>
            <CreditWidget credits={credits} onUpgrade={() => setShowPricing(true)} />
            <div className="h-8 w-[1px] bg-white/10" />

            {/* View Icons */}
            <div className="flex bg-white/5 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('search')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'search' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                title="Search Results"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('saved')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'saved' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Saved Startups"
              >
                <Bookmark size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(query, 1); }}
              className="relative group"
            >
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Agent Search (1 credit)..."
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm w-64 focus:w-80 transition-all focus:outline-none focus:border-purple-500/50 focus:bg-white/10 placeholder:text-gray-600"
              />
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {viewMode === 'saved' ? (
          <>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Bookmark className="text-purple-400" /> Saved Discovery
              <span className="text-sm font-normal text-gray-500 ml-2">{savedStartups.length} items</span>
            </h2>
            {savedStartups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Bookmark size={48} className="mb-4 opacity-20" />
                <p>No saved startups yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedStartups.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    onClick={() => setSelectedStartup(startup)}
                    isSaved={true}
                    onSave={() => handleToggleSave(startup)}
                  />
                ))}
              </div>
            )}
          </>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
              <Loader className="w-8 h-8 text-purple-400 animate-spin relative z-10" />
            </div>
            <p className="text-gray-400 text-sm animate-pulse">Scouting the web for startups...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-red-400 mb-2">Search failed</p>
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={() => handleSearch(query, page)}
              className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-400">
                Found <span className="text-white font-medium">{stats.totalCompanies}</span> startups
                <span className="mx-2 text-gray-700">•</span>
                <span className="text-xs text-gray-600">{(stats.latency / 1000).toFixed(2)}s</span>
              </div>
              {/* Pagination Controls */}
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => handleSearch(query, page - 1)}
                  className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-md transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 py-1">Page {page} of {stats.totalPages}</span>
                <button
                  disabled={page >= stats.totalPages}
                  onClick={() => handleSearch(query, page + 1)}
                  className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-md transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((startup) => (
                <StartupCard
                  key={startup.id}
                  startup={startup}
                  onClick={(s) => setSelectedStartup(s)}
                  isSaved={savedIds.has(startup.id)}
                  onSave={() => handleToggleSave(startup)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500">
            <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>No startups found. Try a different query.</p>
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedStartup && (
        <StartupModal
          startup={selectedStartup}
          onClose={() => setSelectedStartup(null)}
        />
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentTier={credits?.tier || 'free'}
        onSuccess={() => {
          refreshUser();
          // Optional: Show success toast
        }}
      />
    </div>
  );
};

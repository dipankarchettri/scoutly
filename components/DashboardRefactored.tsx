/**
 * Refactored Dashboard using Scoutly v2 Search API
 * Replace Dashboard.tsx with this version
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchStartups, searchStartups } from '../src/services/api';
import { Startup, Timeframe, FilterConfig, SearchResponse } from '../types';
import { StartupCard } from './StartupCard';
import { StartupModal } from './StartupModal';

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
  X
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// Credit Display Widget
const CreditWidget = ({ credits }: { credits?: SearchResponse['credits'] }) => {
  if (!credits) return null;

  const isLow = credits.remaining <= 1;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md ${isLow ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      }`}>
      <Zap className="w-3 h-3" />
      <span>{credits.remaining} / 2 Credits Free</span>
      {credits.tier === 'free' && (
        <button className="ml-2 hover:underline text-[10px] uppercase font-bold tracking-wider opacity-80 hover:opacity-100">
          Upgrade
        </button>
      )}
    </div>
  );
};

export interface DashboardProps {
  initialDomain?: string | null;
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

export const DashboardRefactored: React.FC<DashboardProps> = ({
  initialDomain,
  onBack,
}) => {
  // State
  const [query, setQuery] = useState(initialDomain || '');
  const [results, setResults] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ totalCompanies: 0, totalPages: 0, latency: 0 });
  const [credits, setCredits] = useState<SearchResponse['credits']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);

  // BYOK State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('scoutly_llm_key') || '');

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('scoutly_llm_key', key);
  };

  // Initial Load
  useEffect(() => {
    if (initialDomain) {
      // Use fetchStartups with domain filter for tag clicks from LandingPage
      loadStartupsByDomain(initialDomain);
    } else {
      loadRecentStartups();
    }
  }, [initialDomain]);

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
      // Default to quarter to capture recent data
      const data: any[] = await fetchStartups('quarter', { onlyNew: false });

      // Map Mongoose _id to id
      const mappedData: Startup[] = data.map(item => ({
        ...item,
        id: item._id || item.id || `startup-${Date.now()}-${Math.random()}`
      }));

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
      const response = await searchStartups(searchQuery, pageNum, 'free', apiKey);

      if (response.success && response.data) {
        // Map API data to Startup type
        const mappedStartups: Startup[] = response.data.companies.map((c, index) => ({
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

        setResults(mappedStartups);
        setStats({
          totalCompanies: response.data.pagination.totalCompanies,
          totalPages: response.data.pagination.totalPages,
          latency: response.data.meta.totalLatencyMs
        });
        setCredits(response.credits);
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
            <CreditWidget credits={credits} />
            <div className="h-8 w-[1px] bg-white/10" />
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(query, 1); }}
              className="relative group"
            >
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. AI startups seed funding..."
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm w-64 focus:w-80 transition-all focus:outline-none focus:border-purple-500/50 focus:bg-white/10 placeholder:text-gray-600"
              />
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
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
                  onClick={() => setSelectedStartup(startup)}
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
    </div>
  );
};

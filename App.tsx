import React, { useState } from 'react';
import { ClerkProvider, SignIn, useUser } from '@clerk/clerk-react';
import { DashboardRefactored as Dashboard } from './components/DashboardRefactored';
import { LandingPage } from './components/LandingPage';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'landing' | 'dashboard' | 'chat'>('landing');
  const [searchIntent, setSearchIntent] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'agent' | 'database'>('agent');
  const { isSignedIn } = useUser();

  // Redirect to dashboard if signed in and on landing page (optional, but good UX)
  // For now, let's keep the user's flow: Landing -> Search -> Dashboard (if auth)
  
  // Handle navigation based on auth state and user intent
  if (activeTab === 'dashboard' && isSignedIn) {
    return (
      <Dashboard
        initialDomain={searchIntent}
        initialMode={searchMode}
        onBack={() => {
          setActiveTab('landing');
          setSearchIntent(null);
        }}
      />
    );
  }

  return (
    <>
      <LandingPage
        onSearch={(domain, mode) => {
          setSearchIntent(domain);
          setSearchMode(mode);
          if (isSignedIn) {
            setActiveTab('dashboard');
          }
        }}
      />

      {/* Show Sign In Modal ONLY if not signed in and trying to search */}
      {!isSignedIn && searchIntent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl relative">
             <button 
                onClick={() => setSearchIntent(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Sign in to Search</h2>
            <SignIn afterSignInUrl="/" />
          </div>
        </div>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <AppContent />
      </ClerkProvider>
  );
};

export default App;
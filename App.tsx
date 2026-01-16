import React, { useState } from 'react';
import { DashboardRefactored as Dashboard } from './components/DashboardRefactored';
import { LandingPage } from './components/LandingPage';


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'landing' | 'dashboard' | 'chat'>('landing');

  const [searchIntent, setSearchIntent] = useState<string | null>(null);

  return (
    <>
      {activeTab === 'landing' && (
        <LandingPage 
          onSearch={(domain) => {
            setSearchIntent(domain);
            setActiveTab('dashboard');
          }} 
        />
      )}

      {activeTab === 'dashboard' && (
        <Dashboard 
          initialDomain={searchIntent}
          onBack={() => {
            setActiveTab('landing');
            setSearchIntent(null);
          }} 
        />
      )}


    </>
  );
};

export default App;
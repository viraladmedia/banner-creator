import React, { useState } from 'react';
import { CopyGenerator } from './components/CopyGenerator';
import { ImageStudio } from './components/ImageStudio';
import { LayoutDashboard, Image as ImageIcon, Sparkles } from 'lucide-react';

type Tab = 'copy' | 'studio';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('copy');

  return (
    <div className="min-h-screen font-sans selection:bg-primary/30">
      {/* Glass Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-indigo-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-200"></div>
                <div className="relative w-9 h-9 rounded-lg bg-surface flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">
                Social<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Studio</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:block text-[10px] font-mono text-muted bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                v2.0 • Powered by Gemini 2.5
             </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24">
        
        {/* Navigation Tabs - Centered & Floating */}
        <div className="flex justify-center mb-10">
            <div className="p-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex gap-1 relative">
                <button
                    onClick={() => setActiveTab('copy')}
                    className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeTab === 'copy' 
                        ? 'text-white bg-surface shadow-lg border border-white/10' 
                        : 'text-muted hover:text-white hover:bg-white/5'
                    }`}
                >
                    <LayoutDashboard className={`w-4 h-4 ${activeTab === 'copy' ? 'text-primary' : ''}`} />
                    Banner Generator
                </button>
                <button
                    onClick={() => setActiveTab('studio')}
                    className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeTab === 'studio' 
                        ? 'text-white bg-surface shadow-lg border border-white/10' 
                        : 'text-muted hover:text-white hover:bg-white/5'
                    }`}
                >
                    <ImageIcon className={`w-4 h-4 ${activeTab === 'studio' ? 'text-primary' : ''}`} />
                    Image Studio
                </button>
            </div>
        </div>

        {/* Content Area with smooth fade */}
        <div key={activeTab} className="animate-slide-up">
            {activeTab === 'copy' ? <CopyGenerator /> : <ImageStudio />}
        </div>
      </main>
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';

// Get backend API URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PRESET_QUERIES = [
  { id: 'fire', label: '🔥 Kitchen / House Fire', query: 'What should I do immediately if a fire breaks out in my house?' },
  { id: 'earthquake', label: '🌋 Earthquake Indoor', query: 'What are the exact steps to stay safe during an indoor earthquake?' },
  { id: 'flood', label: '🌊 Rising Flood Water', query: 'What should I do if floodwater starts rising near my building?' },
  { id: 'cpr', label: '🫀 Unconscious / CPR', query: 'How do I perform CPR on an unconscious adult person who is not breathing?' },
  { id: 'bleeding', label: '🩸 Severe Bleeding', query: 'How do I stop severe bleeding from a deep wound?' },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState({ status: 'checking', message: 'Connecting to API...' });
  const [showSnippets, setShowSnippets] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('assistant');

  // Check Backend Health on Mount
  useEffect(() => {
    checkHealth();
    fetchHistory();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ status: 'offline', message: 'Backend unreachable' });
      }
    } catch (err) {
      setHealth({ status: 'offline', message: 'Cannot connect to backend server' });
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/history?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.logs || []);
      }
    } catch (err) {
      console.warn("Could not fetch history:", err);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Failed to process request.' }));
        throw new Error(errData.detail || `Server returned error status ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
      fetchHistory(); // Refresh recent log history
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (presetQuery) => {
    setQuery(presetQuery);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied emergency guidance to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Urgent Emergency Alert Banner */}
      <div className="bg-red-600 text-white text-xs md:text-sm font-bold py-2 px-4 text-center shadow-md flex items-center justify-center space-x-2">
        <span className="text-base">🚨</span>
        <span>IMMEDIATE LIFE-THREATENING EMERGENCY? Call 911, 112, or local emergency services immediately!</span>
      </div>

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-xl font-black shadow-lg shadow-red-900/40">
              🆘
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                AI Emergency Response Assistant
                <span className="text-xs font-semibold bg-red-950 border border-red-700 text-red-400 px-2 py-0.5 rounded-full">
                  RAG + Gemini
                </span>
              </h1>
              <p className="text-xs text-slate-400">Trusted emergency guidance grounded in verified manuals</p>
            </div>
          </div>

          {/* Backend Status Indicator */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'assistant' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Assistant
            </button>
            <button
              onClick={() => { setActiveTab('history'); fetchHistory(); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'history' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Recent Logs ({history.length})
            </button>

            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${
                health.status === 'healthy' ? 'bg-emerald-500 animate-pulse' :
                health.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <span className="text-slate-300 font-medium">
                {health.status === 'healthy' ? 'Backend Ready' : health.status === 'degraded' ? 'Degraded' : 'Backend Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-grow w-full">
        {activeTab === 'assistant' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Input Form & Presets */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Emergency Query Input Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <h2 className="text-base font-bold text-slate-200 mb-2 flex items-center justify-between">
                  <span>Describe the Situation</span>
                  <span className="text-xs text-slate-400 font-normal">Step 1 of 2</span>
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <textarea
                      rows={5}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g., A grease fire started on the stove, what do I do? Or someone is unconscious and not breathing..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition custom-scrollbar"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Press Shift+Enter for new line</span>
                    <span>{query.length} chars</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center space-x-2 transition ${
                      loading || !query.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50 active:scale-[0.99]'
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Retrieving & Generating...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Emergency Plan</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Quick Emergency Presets */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <span>Quick Presets</span>
                  <span className="text-xs text-slate-500">Tap to populate</span>
                </h3>
                <div className="flex flex-col space-y-2">
                  {PRESET_QUERIES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.query)}
                      className="text-left text-xs bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-2.5 rounded-lg transition flex items-center justify-between group"
                    >
                      <span className="font-medium group-hover:text-white">{preset.label}</span>
                      <span className="text-slate-500 text-[10px] group-hover:translate-x-0.5 transition">Select ➔</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: AI Output & RAG Sources */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Error Alert */}
              {error && (
                <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 text-red-200 text-sm flex items-start space-x-3 shadow-lg">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-grow">
                    <p className="font-bold">Execution Error</p>
                    <p className="text-xs text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Default Placeholder State */}
              {!response && !loading && !error && (
                <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[380px]">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-3xl mb-4 text-slate-400">
                    🛡️
                  </div>
                  <h3 className="text-lg font-bold text-slate-200">Ready for Emergency Assessment</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                    Type an emergency situation on the left or select a preset. The system will retrieve relevant chunks from verified manuals using RAG and output prioritized steps.
                  </p>
                </div>
              )}

              {/* Loading Skeleton */}
              {loading && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-6 bg-slate-800 rounded w-3/4"></div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-800 rounded w-full"></div>
                    <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-800 rounded w-4/6"></div>
                  </div>
                </div>
              )}

              {/* AI Guidance Result Card */}
              {response && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
                  
                  {/* Header Actions */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <h2 className="text-base font-bold text-emerald-400">AI Action Plan Generated</h2>
                    </div>
                    <button
                      onClick={() => copyToClipboard(response.answer)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition"
                    >
                      📋 Copy Plan
                    </button>
                  </div>

                  {/* Formatted Answer Output */}
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                    {response.answer}
                  </div>

                  {/* Sources Used Section */}
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>📚 Verified Document Sources ({response.sources.length})</span>
                      </h3>
                      {response.snippets && response.snippets.length > 0 && (
                        <button
                          onClick={() => setShowSnippets(!showSnippets)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium underline"
                        >
                          {showSnippets ? 'Hide Context Snippets' : 'View RAG Context Snippets'}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {response.sources.map((src, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300"
                        >
                          📄 {src}
                        </span>
                      ))}
                    </div>

                    {/* Context Snippets Dropdown */}
                    {showSnippets && response.snippets && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-slate-800/60">
                        <h4 className="text-xs font-semibold text-slate-400">Retrieved Chunks from Vector Store:</h4>
                        {response.snippets.map((item, idx) => (
                          <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-850 text-xs text-slate-400 font-mono">
                            <div className="text-red-400 font-bold mb-1">[Chunk {idx + 1}] Source: {item.source}</div>
                            <div className="text-slate-300">{item.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

          </div>
        ) : (
          /* History Log Tab */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center justify-between">
              <span>Emergency Log History</span>
              <button onClick={fetchHistory} className="text-xs text-red-400 hover:text-red-300 font-semibold">
                🔄 Refresh Logs
              </button>
            </h2>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No logs recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {history.map((log) => (
                  <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                      <span className="font-semibold text-slate-200">Log #{log.id}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-400">Query:</p>
                      <p className="text-xs text-slate-300">{log.query}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Sources:</p>
                      <p className="text-xs text-slate-400">{log.sources.join(', ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500 bg-slate-900/40">
        <p>AI Emergency Response Assistant &bull; Powered by LangChain, ChromaDB, FastAPI & Google Gemini API</p>
      </footer>
    </div>
  );
}

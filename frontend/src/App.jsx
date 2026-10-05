import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const EMERGENCY_CONTACTS = [
  { id: 'police', name: 'Police', number: '100', icon: '👮', tel: 'tel:100' },
  { id: 'fire', name: 'Fire & Rescue', number: '101', icon: '🔥', tel: 'tel:101' },
  { id: 'ambulance', name: 'Ambulance', number: '102', icon: '🚑', tel: 'tel:102' },
  { id: 'cyber', name: 'Cyber Crime', number: '1930', icon: '💻', tel: 'tel:1930' },
  { id: 'child', name: 'Child Helpline', number: '1098', icon: '👶', tel: 'tel:1098' },
  { id: 'women', name: 'Women Helpline', number: '181', icon: '👩', tel: 'tel:181' },
];

const PRESET_QUERIES = [
  { id: 'fire', label: '🔥 Fire', query: 'What should I do immediately if a grease fire breaks out in my kitchen?' },
  { id: 'earthquake', label: '🌎 Earthquake', query: 'What are the exact steps to stay safe during an indoor earthquake?' },
  { id: 'flood', label: '🌊 Flood', query: 'What should I do if floodwater starts rising near my building?' },
  { id: 'cpr', label: '🩹 CPR', query: 'How do I perform CPR on an unconscious adult person who is not breathing?' },
  { id: 'gobag', label: '🎒 Go-Bag', query: 'What essential items should I pack in an emergency go-bag?' },
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
      fetchHistory();
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied emergency guidance plan to clipboard!');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans antialiased">
      
      {/* 1. PROFESSIONAL HEADER */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Title & Subtitle */}
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center text-2xl shadow-md shadow-red-950/60 ring-1 ring-red-500/40">
              🚨
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start space-x-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  AI Emergency Response
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                  🇮🇳 India
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                AI-powered guidance when every second matters
              </p>
            </div>
          </div>

          {/* Right Status Indicators */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'assistant'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => { setActiveTab('history'); fetchHistory(); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'history'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Recent Logs ({history.length})
            </button>

            {/* Status Pills */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
              <span className={`w-2 h-2 rounded-full status-dot ${
                health.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span className="text-slate-300 font-semibold">
                {health.status === 'healthy' ? 'System Operational' : 'Backend Degraded'}
              </span>
            </div>

            <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-400">
              <span>●</span>
              <span>RAG Pipeline Active</span>
            </div>
          </div>

        </div>
      </header>

      {/* 2. PROMINENT INDIA EMERGENCY CONTACTS SECTION */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
            
            {/* Primary Hero Card: 112 National Emergency */}
            <div className="md:col-span-4 bg-gradient-to-r from-red-700 via-red-600 to-rose-700 rounded-xl p-4 text-white shadow-lg flex items-center justify-between ring-2 ring-red-500/50">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🚨</span>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-red-100">National Emergency</span>
                </div>
                <div className="text-2xl font-black tracking-tight">Dial 112</div>
                <p className="text-[11px] text-red-100 font-medium">All Emergency Services (Police, Fire, Ambulance)</p>
              </div>

              <a
                href="tel:112"
                className="bg-white hover:bg-slate-100 text-red-700 font-black text-xs px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center space-x-1 whitespace-nowrap"
              >
                <span>📞 CALL NOW</span>
              </a>
            </div>

            {/* Quick Contacts Grid: 100, 101, 102, 1930, 1098, 181 */}
            <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {EMERGENCY_CONTACTS.map((contact) => (
                <a
                  key={contact.id}
                  href={contact.tel}
                  className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 transition flex flex-col justify-between group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{contact.icon}</span>
                    <span className="text-xs font-black text-red-400 group-hover:text-red-300">{contact.number}</span>
                  </div>
                  <div className="mt-1">
                    <div className="text-[11px] font-bold text-slate-200 group-hover:text-white truncate">{contact.name}</div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-400">Tap to call</div>
                  </div>
                </a>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* 3. MAIN WORKSPACE LAYOUT */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {activeTab === 'assistant' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Input Form & Quick Presets */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* Emergency Query Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🆘</span>
                    <h2 className="text-base font-bold text-white">Describe Emergency</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Tell us what happened</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <textarea
                      rows={5}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Describe the situation... (e.g., A kitchen grease fire started on the stove, or indoor earthquake shaking occurring...)"
                      className="emergency-textarea w-full rounded-lg p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition custom-scrollbar shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm shadow-lg flex items-center justify-center space-x-2 transition ${
                      loading || !query.trim()
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-950/60 active:scale-[0.99] border border-red-500/50'
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Searching Official RAG Docs...</span>
                      </>
                    ) : (
                      <>
                        <span>Get Emergency Guidance</span>
                        <span>➔</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Quick Emergency Cards */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Quick Emergency Presets
                  </h3>
                  <span className="text-[11px] text-slate-500">Tap to load query</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {PRESET_QUERIES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setQuery(preset.query)}
                      className="bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 p-2.5 rounded-lg text-center transition flex flex-col items-center justify-center space-y-1 group"
                    >
                      <span className="text-base group-hover:scale-110 transition transform">{preset.label.split(' ')[0]}</span>
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white truncate">{preset.label.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: AI Emergency Guidance */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Error Box */}
              {error && (
                <div className="bg-red-950/80 border border-red-700 rounded-xl p-4 text-red-100 text-sm flex items-start space-x-3 shadow-xl">
                  <span className="text-xl">⚠️</span>
                  <div className="flex-grow">
                    <p className="font-extrabold text-white">System Notice</p>
                    <p className="text-xs text-red-200 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Initial Placeholder State */}
              {!response && !loading && !error && (
                <div className="bg-slate-900/80 border border-slate-800 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[380px] shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-900/40 border border-red-500/30 flex items-center justify-center text-3xl mb-4 shadow-inner">
                    🤖
                  </div>
                  <h3 className="text-lg font-bold text-white">AI Emergency Guidance Center</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                    Select a quick preset on the left or describe any fire, earthquake, flood, CPR, or disaster situation. Grounded guidance will be retrieved from official emergency documents.
                  </p>
                  <div className="mt-6 flex items-center space-x-2 text-xs font-bold text-slate-500">
                    <span>🛡️ Verified Grounded Context</span>
                    <span>&bull;</span>
                    <span>🇮🇳 112 Ready</span>
                  </div>
                </div>
              )}

              {/* Loading Skeleton */}
              {loading && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 animate-pulse shadow-xl">
                  <div className="h-5 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-8 bg-slate-800 rounded w-3/4"></div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-800 rounded w-full"></div>
                    <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-800 rounded w-4/6"></div>
                  </div>
                </div>
              )}

              {/* AI Guidance Response Card */}
              {response && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
                  
                  {/* Response Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 status-dot"></span>
                      <h2 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                        🤖 AI Emergency Guidance Plan
                      </h2>
                    </div>
                    <button
                      onClick={() => copyToClipboard(response.answer)}
                      className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center space-x-1"
                    >
                      <span>📋 Copy Plan</span>
                    </button>
                  </div>

                  {/* Formatted Markdown Output */}
                  <div className="text-sm text-slate-100 font-sans bg-slate-950/80 p-5 rounded-xl border border-slate-800/80 leading-relaxed overflow-x-auto shadow-inner">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-lg font-black text-white mt-4 mb-2 border-b border-slate-800 pb-1" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-bold text-red-400 mt-4 mb-2 flex items-center gap-1.5" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-100 mt-3 mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-3 text-slate-200 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-3 text-slate-200 pl-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-2 mb-4 text-slate-100 pl-2 font-semibold" {...props} />,
                        li: ({node, ...props}) => <li className="text-slate-200 my-1 leading-relaxed" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-black text-white bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60" {...props} />,
                        code: ({node, ...props}) => <code className="bg-slate-900 text-red-400 px-1 py-0.5 rounded text-xs font-mono border border-slate-800" {...props} />
                      }}
                    >
                      {response.answer}
                    </ReactMarkdown>
                  </div>

                  {/* Sources List */}
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <span>📚 Verified Document Sources ({response.sources?.length || 0})</span>
                      </h3>
                      {response.sources && response.sources.length > 0 && (
                        <button
                          onClick={() => setShowSnippets(!showSnippets)}
                          className="text-xs text-red-400 hover:text-red-300 font-bold underline"
                        >
                          {showSnippets ? 'Hide Snippets' : 'View Retrieved RAG Context Snippets'}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {response.sources && response.sources.map((src, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-slate-950 border border-slate-800 text-slate-300"
                        >
                          📄 {src.document || src}
                        </span>
                      ))}
                    </div>

                    {showSnippets && response.sources && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-slate-800/60">
                        <h4 className="text-xs font-bold text-slate-400">Retrieved Chunks & Context Relevance:</h4>
                        {response.sources.map((src, idx) => (
                          <div key={idx} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-400 font-mono">
                            <div className="text-red-400 font-bold mb-1">Source {idx + 1}: {src.document}</div>
                            <div className="text-slate-300 leading-relaxed">{src.relevance}</div>
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
          /* Recent History Log View */
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📜 Recent Emergency Query Logs
              </h2>
              <button
                onClick={fetchHistory}
                className="text-xs font-bold text-red-400 hover:text-red-300 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition"
              >
                🔄 Refresh Logs
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No emergency queries recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((log) => (
                  <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                      <span className="font-bold text-slate-200">Log Entry #{log.id}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-400">Query:</p>
                      <p className="text-xs text-slate-300">{log.query}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Sources Cited:</p>
                      <p className="text-xs text-slate-400">{Array.isArray(log.sources) ? log.sources.join(', ') : log.sources}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500 bg-slate-950/80">
        <p>
          AI Emergency Response Assistant &bull; Grounded RAG Guidance (ChromaDB + Gemini 3.8 Flash) &bull; 🇮🇳 Emergency Helpline 112
        </p>
      </footer>
    </div>
  );
}

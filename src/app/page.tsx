'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Settings, FileText, CheckCircle2, AlertTriangle, XCircle, Clock, 
  ArrowRight, ArrowLeft, ChevronsRight, ChevronsLeft, Download, RefreshCw, Trash2, ShieldAlert
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
}

interface ReportSummary {
  id: string;
  timestamp: string;
  lowerSitemap: string;
  compareSitemap: string;
  pagesChecked: number;
  durationMs: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  summary: { passed: number; failed: number; warnings: number; total: number };
}

interface CategoryBreakdown {
  passed: number;
  failed: number;
  warnings: number;
  total: number;
}

interface DetailedReport extends ReportSummary {
  categoryBreakdown: Record<string, CategoryBreakdown>;
  results: {
    pageUrl: string;
    category: string;
    subTest: string;
    expectedValue: string;
    actualValue: string;
    differenceDescription: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'PASS' | 'WARNING' | 'FAIL';
    timestamp: string;
    elementSelector?: string;
    elementId?: string;
    elementClass?: string;
    elementTag?: string;
    viewportName?: string;
    viewportWidth?: number;
    screenWidth?: number;
  }[];
  logs: {
    execution: string[];
    browser: { timestamp: string; type: string; text: string; url: string }[];
    network: { timestamp: string; url: string; status: number; statusText: string; error?: string }[];
    error: string[];
  };
}


export default function DashboardPage() {
  // Config state
  const [lowerSitemap, setLowerSitemap] = useState('https://uat.example.com/sitemap.xml');
  const [compareSitemap, setCompareSitemap] = useState('https://www.example.com/sitemap.xml');
  const [limitedPages, setLimitedPages] = useState(true);
  const [pagesCount, setPagesCount] = useState('5');
  const [resultFormat, setResultFormat] = useState('excel');

  type RunMode = 'sitemap' | 'webpage' | 'file-upload';
  const [runMode, setRunMode] = useState<RunMode>('sitemap');

  const [lowerWebpage, setLowerWebpage] = useState('https://uat.example.com');
  const [compareWebpage, setCompareWebpage] = useState('https://www.example.com');

  const [lowerEnvFile, setLowerEnvFile] = useState<File | null>(null);
  const [productionEnvFile, setProductionEnvFile] = useState<File | null>(null);


  // Categories lists (dual list)
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([
    { id: 'functional', name: 'Functional Testing' },
    { id: 'links', name: 'Link Validation' },
    { id: 'responsive', name: 'Responsive Testing' },
    { id: 'browser', name: 'Browser Compatibility Testing' },
    { id: 'accessibility', name: 'Accessibility Testing' },
    { id: 'security', name: 'Security Validation' },
    { id: 'analytics', name: 'Analytics & Tracking Validation' },
    { id: 'errorMonitoring', name: 'Error Monitoring' }
  ]);
  
  const [selectedCategories, setSelectedCategories] = useState<CategoryItem[]>([
    { id: 'content', name: 'Content Validation' },
    { id: 'seo', name: 'SEO Validation' },
    { id: 'migration', name: 'Migration & Regression Validation' },
    { id: 'ui', name: 'UI Testing' },
    { id: 'visual-comprehensive', name: '🎬 VISUAL COMPREHENSIVE (BackstopJS + Applitools + Percy + Chromatic)' }
  ]);

  const [activeAvailableSelected, setActiveAvailableSelected] = useState<string[]>([]);
  const [activeSelectedSelected, setActiveSelectedSelected] = useState<string[]>([]);

  // Screen size selection
  const [testDesktop, setTestDesktop] = useState(true);
  const [testTablet, setTestTablet] = useState(true);
  const [testMobile, setTestMobile] = useState(true);
  const [hiddenComponentOption, setHiddenComponentOption] = useState<'avoid' | 'with'>('avoid');
  const [checkLevel, setCheckLevel] = useState<'highlevel' | 'micro'>('micro');
  const [isPaused, setIsPaused] = useState(false);

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentCheckingUrl, setCurrentCheckingUrl] = useState('');
  const [liveDuration, setLiveDuration] = useState(0);
  const [liveResultsCount, setLiveResultsCount] = useState(0);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  
  // Results view states
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [history, setHistory] = useState<ReportSummary[]>([]);
  
  // Terminal log box scrolling ref
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Poll timer hook
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (isRunning) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/validation/status');
          const data = await res.json();
          
          setRunProgress(data.progress || 0);
          setTotalSteps(data.total || 0);
          setCurrentCheckingUrl(data.currentUrl || '');
          setLiveDuration(data.durationMs || 0);
          setLiveResultsCount(data.resultsCount || 0);

          if (data.status !== 'running') {
            setIsRunning(false);
            clearInterval(pollInterval);
            // Load the completed report
            if (data.id) {
              loadReport(data.id);
            }
            refreshHistory();
          }
        } catch (err) {
          console.error('Failed to poll run status:', err);
        }
      }, 900);
    }
    return () => clearInterval(pollInterval);
  }, [isRunning]);

  // Load history index on mount
  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [report?.logs.execution]);

  const refreshHistory = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const loadReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setActiveReportId(id);
      }
    } catch (err) {
      console.error('Error loading detailed report:', err);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this validation run record?')) return;
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeReportId === id) {
          setReport(null);
          setActiveReportId(null);
        }
        refreshHistory();
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  // Dual List Move Handlers
  const moveRight = () => {
    const toMove = availableCategories.filter(c => activeAvailableSelected.includes(c.id));
    setSelectedCategories(prev => [...prev, ...toMove]);
    setAvailableCategories(prev => prev.filter(c => !activeAvailableSelected.includes(c.id)));
    setActiveAvailableSelected([]);
  };

  const moveLeft = () => {
    const toMove = selectedCategories.filter(c => activeSelectedSelected.includes(c.id));
    setAvailableCategories(prev => [...prev, ...toMove]);
    setSelectedCategories(prev => prev.filter(c => !activeSelectedSelected.includes(c.id)));
    setActiveSelectedSelected([]);
  };

  const moveAllRight = () => {
    setSelectedCategories(prev => [...prev, ...availableCategories]);
    setAvailableCategories([]);
    setActiveAvailableSelected([]);
  };

  const moveAllLeft = () => {
    setAvailableCategories(prev => [...prev, ...selectedCategories]);
    setSelectedCategories([]);
    setActiveSelectedSelected([]);
  };

  const toggleAvailableSelected = (id: string) => {
    setActiveAvailableSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectedSelected = (id: string) => {
    setActiveSelectedSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleStartValidation = async () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one Test Category to run.');
      return;
    }

    // Mode-specific validation
    if (runMode === 'sitemap') {
      if (!lowerSitemap || !compareSitemap) {
        alert('Please enter both Lower Environment and Production Sitemaps.');
        return;
      }
    } else if (runMode === 'webpage') {
      if (!lowerWebpage || !compareWebpage) {
        alert('Please enter both Lower Environment and Production Webpage Links.');
        return;
      }
      // Validate same path but different domain
      try {
        const lowerUrl = new URL(lowerWebpage);
        const compareUrl = new URL(compareWebpage);
        if (lowerUrl.pathname !== compareUrl.pathname) {
          alert('Webpage paths must be identical. Only the domain should differ.');
          return;
        }
      } catch (e) {
        alert('Please enter valid URLs for both webpages.');
        return;
      }
    } else if (runMode === 'file-upload') {
      if (!lowerEnvFile || !productionEnvFile) {
        alert('Please upload both Lower Environment and Production Environment files.');
        return;
      }
    }

    try {
      setIsRunning(true);
      setRunProgress(0);
      setLiveDuration(0);
      setReport(null);

      if (runMode === 'file-upload') {
        const formData = new FormData();
        formData.append('runMode', runMode);
        formData.append('lowerEnvFile', lowerEnvFile!);
        formData.append('productionEnvFile', productionEnvFile!);
        formData.append('limitedPages', String(limitedPages));
        formData.append('pagesCount', pagesCount);
        formData.append('selectedCategoryIds', JSON.stringify(selectedCategories.map(c => c.id)));
        formData.append('testDesktop', String(testDesktop));
        formData.append('testTablet', String(testTablet));
        formData.append('testMobile', String(testMobile));
        formData.append('hiddenComponentOption', hiddenComponentOption);
        formData.append('checkLevel', checkLevel);

        const res = await fetch('/api/validation/start', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to start run');
        }
      } else {
        const res = await fetch('/api/validation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runMode,
            lowerSitemap,
            compareSitemap,
            lowerWebpage,
            compareWebpage,
            limitedPages,
            pagesCount,
            selectedCategoryIds: selectedCategories.map(c => c.id),
            testDesktop,
            testTablet,
            testMobile,
            hiddenComponentOption,
            checkLevel
          })
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to start run');
        }
      }
    } catch (err: any) {
      alert(`Validation trigger failed: ${err.message}`);
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS': return <CheckCircle2 size={16} color="var(--color-pass)" />;
      case 'WARNING': return <AlertTriangle size={16} color="var(--color-warning)" />;
      case 'FAIL': return <XCircle size={16} color="var(--color-fail)" />;
      default: return null;
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return { color: 'var(--color-critical)', fontWeight: 'bold' };
      case 'HIGH': return { color: 'var(--color-high)', fontWeight: 'bold' };
      case 'MEDIUM': return { color: 'var(--color-medium)' };
      case 'LOW': return { color: 'var(--color-low)' };
      default: return {};
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '24px', padding: '24px', minHeight: '100vh' }}>

      {/* Sidebar - Run history & execution configs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
        
        {/* Run configs */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--accent-primary)" />
            Run Setup
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', userSelect: 'none' }}>
                  <input
                    type="radio"
                    name="run-mode"
                    value="sitemap"
                    checked={runMode === 'sitemap'}
                    onChange={() => setRunMode('sitemap')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  With Sitemap
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', userSelect: 'none' }}>
                  <input
                    type="radio"
                    name="run-mode"
                    value="webpage"
                    checked={runMode === 'webpage'}
                    onChange={() => setRunMode('webpage')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  With Webpage
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', userSelect: 'none' }}>
                  <input
                    type="radio"
                    name="run-mode"
                    value="file-upload"
                    checked={runMode === 'file-upload'}
                    onChange={() => setRunMode('file-upload')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  With File Upload
                </label>
              </div>

              {runMode === 'sitemap' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Lower Environment Sitemap
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={lowerSitemap}
                      onChange={e => setLowerSitemap(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Production (Compare) Sitemap
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={compareSitemap}
                      onChange={e => setCompareSitemap(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>
                </>
              )}

              {runMode === 'webpage' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Lower Environment Webpage Link
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={lowerWebpage}
                      onChange={e => setLowerWebpage(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Production (Compare) Webpage Link
                    </label>
                    <input
                      type="text"
                      className="input-text"
                      value={compareWebpage}
                      onChange={e => setCompareWebpage(e.target.value)}
                      disabled={isRunning}
                    />
                  </div>
                </>
              )}

              {runMode === 'file-upload' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Lower Environment Links (TXT/CSV)
                    </label>
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={e => setLowerEnvFile(e.target.files?.[0] || null)}
                      disabled={isRunning}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    />
                    {lowerEnvFile && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-pass)', marginTop: '4px' }}>
                        ✓ {lowerEnvFile.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Production Environment Links (TXT/CSV)
                    </label>
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={e => setProductionEnvFile(e.target.files?.[0] || null)}
                      disabled={isRunning}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    />
                    {productionEnvFile && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-pass)', marginTop: '4px' }}>
                        ✓ {productionEnvFile.name}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>


            {(runMode === 'sitemap' || runMode === 'file-upload') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <input
                  type="checkbox"
                  id="limit-checkbox"
                  checked={limitedPages}
                  onChange={e => setLimitedPages(e.target.checked)}
                  disabled={isRunning}
                  style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                />
                <label htmlFor="limit-checkbox" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Limit scanned pages
                </label>
              </div>
            )}

            {(runMode === 'sitemap' || runMode === 'file-upload') && limitedPages && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Number of Pages
                </label>
                <input
                  type="number"
                  className="input-text"
                  value={pagesCount}
                  onChange={e => setPagesCount(e.target.value)}
                  disabled={isRunning}
                  min="1"
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                🖥️ Test Screen Sizes
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={testDesktop}
                    onChange={e => setTestDesktop(e.target.checked)}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>📱 Desktop (1440px)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={testTablet}
                    onChange={e => setTestTablet(e.target.checked)}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>📑 Tablet (768px)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={testMobile}
                    onChange={e => setTestMobile(e.target.checked)}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span>📱 Mobile (375px)</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                🎯 Component Visibility
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="hidden-comp"
                    value="avoid"
                    checked={hiddenComponentOption === 'avoid'}
                    onChange={() => setHiddenComponentOption('avoid')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Avoid Hidden Components
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="hidden-comp"
                    value="with"
                    checked={hiddenComponentOption === 'with'}
                    onChange={() => setHiddenComponentOption('with')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  With Hidden Components
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                🔍 Check Level
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="check-level"
                    value="highlevel"
                    checked={checkLevel === 'highlevel'}
                    onChange={() => setCheckLevel('highlevel')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Highlevel (Critical/High Issues Only)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="check-level"
                    value="micro"
                    checked={checkLevel === 'micro'}
                    onChange={() => setCheckLevel('micro')}
                    disabled={isRunning}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Micro (All Issues)
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Export Result Format
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {['excel', 'csv', 'xml', 'json'].map(fmt => (
                  <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <input 
                      type="radio" 
                      name="fmt" 
                      value={fmt}
                      checked={resultFormat === fmt}
                      onChange={() => setResultFormat(fmt)}
                      disabled={isRunning}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    {fmt === 'excel' ? 'Excel' : fmt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Historic runs list */}
        <div className="glass-panel" style={{ padding: '20px', flex: 1, maxHeight: '500px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-primary)" />
              Recent Runs
            </span>
            <button 
              onClick={refreshHistory} 
              disabled={isRunning}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={14} />
            </button>
          </h2>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                No runs recorded yet.
              </p>
            ) : (
              history.map(item => (
                <div 
                  key={item.id}
                  onClick={() => loadReport(item.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: activeReportId === item.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${activeReportId === item.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                    position: 'relative'
                  }}
                  className="history-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {new Date(Number(item.id)).toLocaleDateString()} {new Date(Number(item.id)).toLocaleTimeString()}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {getStatusIcon(item.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.lowerSitemap.split('//')[1]?.split('/')[0] || 'Sitemap Run'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{item.pagesChecked} pages checked</span>
                    <span>{((item.durationMs || 0) / 1000).toFixed(1)}s</span>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteReport(item.id);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      bottom: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(239, 68, 68, 0.3)',
                      transition: '0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-fail)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.3)'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
        
        {/* Validation Category Dual List Selection Dashboard */}
        {!isRunning && !report && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Test Categories Selection</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Drag/move category plugins to include them in the automated comparison.
            </p>

            <div className="dual-list-container">
              {/* Left Pane: Available */}
              <div className="dual-list-pane">
                <div className="dual-list-header">Available Tests ({availableCategories.length})</div>
                <div className="dual-list-body">
                  {availableCategories.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => toggleAvailableSelected(cat.id)}
                      className={`dual-list-item ${activeAvailableSelected.includes(cat.id) ? 'selected' : ''}`}
                    >
                      {cat.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="dual-list-controls">
                <button className="dual-list-ctrl-btn" onClick={moveRight} title="Move Selected Right">
                  <ArrowRight size={16} />
                </button>
                <button className="dual-list-ctrl-btn" onClick={moveLeft} title="Move Selected Left">
                  <ArrowLeft size={16} />
                </button>
                <button className="dual-list-ctrl-btn" onClick={moveAllRight} title="Move All Right">
                  <ChevronsRight size={16} />
                </button>
                <button className="dual-list-ctrl-btn" onClick={moveAllLeft} title="Move All Left">
                  <ChevronsLeft size={16} />
                </button>
              </div>

              {/* Right Pane: Selected */}
              <div className="dual-list-pane">
                <div className="dual-list-header" style={{ color: 'var(--accent-primary)' }}>Selected Tests ({selectedCategories.length})</div>
                <div className="dual-list-body">
                  {selectedCategories.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => toggleSelectedSelected(cat.id)}
                      className={`dual-list-item ${activeSelectedSelected.includes(cat.id) ? 'selected' : ''}`}
                    >
                      {cat.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleStartValidation}
                className="btn-primary pulse-glow"
              >
                <Play size={18} fill="white" />
                Start Validation Run
              </button>
            </div>
          </div>
        )}

        {/* Live progress view */}
        {isRunning && (
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Validating Migration Environment</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to stop? Current progress will be saved.')) {
                      setIsRunning(false);
                    }
                  }}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.85rem', color: 'var(--color-fail)' }}
                >
                  ⏹️ Stop
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {isPaused ? '⏸️ Paused - Click Resume to continue' : 'Crawl and regression checks in progress. Do not navigate away.'}
            </p>

            {/* Circular Progress Display */}
            <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ transform: 'rotate(-90deg)', width: '140px', height: '140px' }}>
                <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="transparent" />
                <circle 
                  cx="70" 
                  cy="70" 
                  r="60" 
                  stroke="var(--accent-primary)" 
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={2 * Math.PI * 60 * (1 - runProgress / 100)}
                  style={{ transition: 'stroke-dashoffset 0.3s ease-in-out' }}
                />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{runProgress}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{liveResultsCount} assertions</span>
              </div>
            </div>

            {/* Core Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', maxWidth: '600px', margin: '0 auto 24px auto' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>Crawling...</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{(liveDuration / 1000).toFixed(1)}s</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Checked</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{Math.round(runProgress * totalSteps / 100)} / {totalSteps} urls</div>
              </div>
            </div>

            {/* Current URL bar */}
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '10px 16px', 
              borderRadius: '8px', 
              fontSize: '0.85rem', 
              fontFamily: 'monospace', 
              color: 'var(--accent-primary)',
              maxWidth: '600px',
              margin: '0 auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              Active page: {currentCheckingUrl || 'Initializing...'}
            </div>
          </div>
        )}

        {/* Detailed Report View */}
        {report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflow: 'visible' }}>
            
            {/* Header / Metric Blocks */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    Validation Summary
                    <span className={`badge ${
                      report.status === 'PASS' ? 'badge-pass' : report.status === 'WARNING' ? 'badge-warning' : 'badge-fail'
                    }`}>
                      {report.status}
                    </span>
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Execution ID: #{report.id} • Checked at: {new Date(report.timestamp).toLocaleString()}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <a 
                    href={`/api/reports/export?id=${report.id}&format=${resultFormat}`}
                    download
                    className="btn-primary"
                    style={{ textDecoration: 'none', padding: '10px 18px', fontSize: '0.9rem' }}
                  >
                    <Download size={16} />
                    Export Report ({resultFormat.toUpperCase()})
                  </a>
                  <button 
                    onClick={() => {
                      setReport(null);
                      setActiveReportId(null);
                    }}
                    className="btn-secondary"
                    style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                  >
                    Configure New Check
                  </button>
                </div>
              </div>

              {/* Main metric panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Pages</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>{report.pagesChecked}</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Assertions</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px' }}>{report.summary.total}</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-pass)' }}>Passed</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-pass)', marginTop: '4px' }}>{report.summary.passed}</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-fail)' }}>Failed</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-fail)', marginTop: '4px' }}>{report.summary.failed}</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)' }}>Warnings</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>{report.summary.warnings}</div>
                </div>
              </div>

              {/* Category-wise Breakdown */}
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>Category Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {Object.entries(report.categoryBreakdown).map(([catId, stats]) => (
                  <div key={catId} style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      {catId.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Pass: {stats.passed}</span>
                      <span style={{ color: stats.failed > 0 ? 'var(--color-fail)' : 'var(--text-muted)' }}>Fail: {stats.failed}</span>
                      <span style={{ color: stats.warnings > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>Warn: {stats.warnings}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Results Grid Table */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.3rem' }}>Validation Assertions</h3>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Status filter tabs */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {['ALL', 'PASS', 'WARNING', 'FAIL'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        style={{
                          background: statusFilter === st ? 'var(--accent-primary)' : 'none',
                          border: 'none',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          transition: '0.2s'
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search page url or category..."
                    className="input-text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    style={{ width: '240px', padding: '8px 12px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Table with fixed height and scrolling */}
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: '600px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  flex: 1
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: '1200px',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.85rem'
                  }}
                >
                  <thead style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.02)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Page URL</th>
                      <th style={{ padding: '12px 16px' }}>Element</th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Sub-Test</th>
                      <th style={{ padding: '12px 16px' }}>Assertion Description</th>
                      <th style={{ padding: '12px 16px' }}>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.results
                      .filter(r => r.status !== 'PASS')
                      .filter(r => statusFilter === 'ALL' || r.status === statusFilter)
                      .filter(r =>
                        r.pageUrl.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        r.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        r.subTest.toLowerCase().includes(searchFilter.toLowerCase())
                      )
                      .map((res, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: '0.1s' }} className="table-row-hover">
                          <td style={{ padding: '12px 16px' }}>{getStatusIcon(res.status)}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{res.pageUrl}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '200px', wordBreak: 'break-word' }}>
                            {res.elementId && <div style={{ fontWeight: 600, color: 'var(--color-info)' }}>#{res.elementId}</div>}
                            {res.elementClass && <div style={{ fontSize: '0.7rem', color: 'var(--color-pass)' }}>.{res.elementClass}</div>}
                            {res.elementTag && <div style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>&lt;{res.elementTag}&gt;</div>}
                            {res.elementSelector && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{res.elementSelector}</div>}
                            {!res.elementId && !res.elementClass && !res.elementTag && <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{res.category}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{res.subTest}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.differenceDescription}</div>
                            <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-muted)' }}>
                              Expected: {res.expectedValue} | Actual: {res.actualValue}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={getSeverityStyle(res.severity)}>{res.severity}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Execution logs terminal box */}
            <div className="glass-panel" style={{ padding: '24px', background: '#090d16', borderColor: '#1f293d' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Clock size={16} />
                Execution Logging Console
              </h3>
              
              <div style={{ 
                height: '240px', 
                overflowY: 'auto', 
                background: '#020617', 
                border: '1px solid #1e293b', 
                borderRadius: '8px', 
                padding: '16px', 
                fontFamily: 'monospace', 
                fontSize: '0.8rem', 
                color: 'rgba(255,255,255,0.85)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                lineHeight: '1.4'
              }}>
                {report.logs.execution.map((log, index) => (
                  <div key={index} style={{
                    color: log.includes('Failed') || log.includes('Error') ? 'var(--color-fail)' : 
                           log.includes('warning') || log.includes('discrepancy') ? 'var(--color-warning)' : 
                           log.includes('completed') || log.includes('successfully') ? 'var(--color-pass)' : 'inherit'
                  }}>
                    {log}
                  </div>
                ))}
                {/* Browser & Network Logs inside console */}
                {report.logs.browser.map((log, idx) => (
                  <div key={`b-${idx}`} style={{ color: 'var(--color-warning)' }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] [Browser-Console] {log.type.toUpperCase()}: {log.text} ({log.url})
                  </div>
                ))}
                {report.logs.network.map((log, idx) => (
                  <div key={`n-${idx}`} style={{ color: 'var(--color-fail)' }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] [Network-Error] {log.url} - {log.error || log.statusText}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}

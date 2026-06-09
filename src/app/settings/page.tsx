'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Shield, ToggleLeft, ToggleRight, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface SubTestCase {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

interface TestCategoryConfig {
  id: string;
  name: string;
  enabled: boolean;
  subTests: SubTestCase[];
}

interface AppConfig {
  categories: TestCategoryConfig[];
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to load configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubTest = async (categoryId: string, subTestId: string, currentVal: boolean) => {
    const key = `${categoryId}-${subTestId}`;
    setSavingId(key);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleSubTest',
          categoryId,
          subTestId,
          enabled: !currentVal
        })
      });
      const updatedConfig = await res.json();
      setConfig(updatedConfig);
    } catch (err) {
      console.error('Failed to toggle subtest:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleCategory = async (categoryId: string, currentVal: boolean) => {
    setSavingId(categoryId);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleCategory',
          categoryId,
          enabled: !currentVal
        })
      });
      const updatedConfig = await res.json();
      setConfig(updatedConfig);
    } catch (err) {
      console.error('Failed to toggle category:', err);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw size={28} className="pulse-glow" style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading Test Configurations...</p>
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Title block */}
      <div>
        <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Settings size={28} color="var(--accent-primary)" />
          Test Configuration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Configure which assertions are executed under each test category. Enabled sub-tests are verified during validation runs. Settings persist on disk.
        </p>
      </div>

      {/* Configuration Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {config?.categories.map(cat => (
          <div 
            key={cat.id} 
            className="glass-panel" 
            style={{ 
              padding: '24px',
              borderLeft: `4px solid ${cat.enabled ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
              opacity: cat.enabled ? 1 : 0.8,
              transition: 'var(--transition-smooth)'
            }}
          >
            {/* Category header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {cat.name}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Plugin ID: {cat.id} • {cat.subTests.length} tests available
                </span>
              </div>

              {/* Master toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {cat.enabled ? 'Category Enabled' : 'Category Disabled'}
                </span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={cat.enabled} 
                    onChange={() => handleToggleCategory(cat.id, cat.enabled)}
                    disabled={savingId === cat.id}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Sub-tests checklist grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {cat.subTests.map(sub => {
                const subKey = `${cat.id}-${sub.id}`;
                const isDisabled = !cat.enabled || savingId === subKey;
                return (
                  <div 
                    key={sub.id} 
                    onClick={() => !isDisabled && handleToggleSubTest(cat.id, sub.id, sub.enabled)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '12px', 
                      padding: '8px', 
                      borderRadius: '6px', 
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      background: sub.enabled && cat.enabled ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      transition: '0.2s',
                      opacity: cat.enabled ? 1 : 0.5
                    }}
                    className={!isDisabled ? 'table-row-hover' : ''}
                  >
                    <div style={{ marginTop: '2px', color: sub.enabled && cat.enabled ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {sub.enabled && cat.enabled ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 600, 
                        color: sub.enabled && cat.enabled ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}>
                        {sub.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {sub.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

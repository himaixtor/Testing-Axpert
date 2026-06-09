import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Migration Validation Platform',
  description: 'Enterprise-grade automated website migration testing and visual regression dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body id="app-root">
        {/* Header Bar */}
        <header className="glass-panel" style={{
          margin: '20px auto 0 auto',
          maxWidth: '1280px',
          width: '95%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 32px',
          borderRadius: '16px',
          zIndex: 100
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.4rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.03em'
            }}>
              AXPERT VALIDATOR
            </span>
            <span className="badge badge-pass" style={{ fontSize: '0.65rem' }}>ENTERPRISE</span>
          </Link>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', gap: '24px' }}>
            <Link href="/" style={{
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              transition: 'var(--transition-smooth)'
            }} className="nav-link">
              Dashboard
            </Link>
            <Link href="/settings" style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              transition: 'var(--transition-smooth)'
            }} className="nav-link">
              Test Configuration
            </Link>
          </nav>
        </header>

        {/* Main Content Pane */}
        <main style={{
          maxWidth: '1280px',
          width: '95%',
          margin: '32px auto 60px auto'
        }}>
          {children}
        </main>
      </body>
    </html>
  );
}

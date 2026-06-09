# 🧪 TestingAxpert - Comprehensive Web Testing Platform

**Enterprise-grade automated testing solution for comparing websites across environments with visual regression, functional validation, SEO analysis, and comprehensive visual testing.**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [How It Works](#how-it-works)
4. [Installation & Setup](#installation--setup)
5. [How to Run](#how-to-run)
6. [Test Categories](#test-categories)
7. [Results & Reports](#results--reports)
8. [Advanced Features](#advanced-features)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

TestingAxpert is a comprehensive web testing platform that compares two versions of websites (UAT/Lower Environment vs Production) across multiple dimensions with maximum precision.

**Core Capabilities:**
- Visual Regression Testing - Pixel-perfect comparisons using 5 professional tools
- Functional Testing - Form submissions, navigation, interactions
- Content Validation - Text, headers, meta information comparison
- SEO Analysis - Meta tags, canonical links, structured data validation
- Performance Metrics - Core Web Vitals and load time analysis
- Accessibility Compliance - WCAG standards and keyboard navigation testing
- Security Validation - SSL, security headers, and form security checks
- 9+ additional specialized test categories

---

## ✨ Features

### 🎬 Visual Comprehensive Testing - 5 Professional Tools

1. **BackstopJS** - Pixel-Perfect Screenshot Comparison
   - Detects pixel-level differences between environments
   - Compares layouts across multiple viewports (desktop, tablet, mobile)
   - Generates interactive HTML diff reports

2. **Applitools Eyes** - AI-Powered Visual Testing
   - Intelligent difference detection that ignores cosmetic noise
   - Font rendering and typography analysis
   - Color space and gradient mismatch detection

3. **Percy** - Cloud-Based Visual Regression
   - Historical visual regression tracking
   - Pull request integration
   - Baseline management and snapshot storage

4. **Chromatic** - Component Visual Testing
   - Component-level visual changes detection
   - Design system validation
   - Theme and style variations testing

5. **Playwright** - Element-Level DOM Analysis
   - Computed style variations detection
   - Typography details extraction and comparison
   - Color properties and spacing metrics measurement

### 📁 Multiple Input Modes

1. **Sitemap Mode** - Automatically crawl entire sitemaps
2. **Webpage Mode** - Single URL comparison
3. **File Upload Mode** - Upload CSV/TXT files with custom URL lists

### 📊 Test Categories (14+)

UI Testing, SEO Validation, Content Validation, Functional Testing, Link Validation, Performance Testing, Responsive Testing, Browser Compatibility, Accessibility Testing, Security Validation, Analytics Validation, Migration Validation, Error Monitoring, Visual Comprehensive Testing

### 📈 Smart Features

- ✅ Automatic Element Tracking (ID, Class, Tag, Selector)
- ✅ Intelligent Color Normalization
- ✅ Responsive Result Tables with Auto-scroll
- ✅ Multi-Format Export (Excel, CSV, JSON, XML)
- ✅ Real-Time Progress Tracking
- ✅ Detailed Execution Logging
- ✅ Report History

---

## 🔧 How It Works

### Architecture Overview

The validation flow consists of 5 main phases:

**Phase 1: Input Processing**
- Parse URLs from sitemap, webpage, or file upload
- Validate matching relative paths
- Apply page limits if configured

**Phase 2: Browser Automation**
- Launch Playwright Chromium instances
- Navigate to both environments
- Capture DOM, styles, and screenshots

**Phase 3: Plugin Execution**
- Load selected test category plugins
- Each plugin compares styles, content, functionality
- Generate test results

**Phase 4: Visual Testing Pipeline**
- BackstopJS: Pixel-level comparison
- Applitools: AI-powered analysis
- Percy: Cloud regression storage
- Chromatic: Component testing
- Playwright: CSS/DOM analysis

**Phase 5: Results Aggregation**
- Compile all plugin results
- Generate summary statistics
- Create category breakdown
- Store complete report

---

## 🚀 Installation & Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Modern web browser
- (Optional) API keys for cloud tools

### Installation Steps

```bash
# Clone repository
git clone <repository-url>
cd TestingAxpert

# Install dependencies
npm install

# Install visual testing tools
npm install backstopjs @applitools/eyes-playwright @percy/cli chromatic

# Create environment file
cp .env.example .env.local
```

### Environment Configuration

Create `.env.local` file:

```env
APPLITOOLS_API_KEY=your_key_here
PERCY_TOKEN=your_token_here
CHROMATIC_PROJECT_TOKEN=your_token_here
```

---

## 🎮 How to Run

### Start Application

```bash
npm run dev
```

Access at: http://localhost:3000

### Running Tests

**Option 1: Sitemap Mode**
- Select "With Sitemap"
- Enter both sitemap URLs
- Select test categories
- Click "Start Validation Run"

**Option 2: Webpage Mode**
- Select "With Webpage"
- Enter both webpage URLs
- Select test categories
- Click "Start Validation Run"

**Option 3: File Upload Mode**
- Select "With File Upload"
- Upload lower environment URL file
- Upload production environment URL file
- (Optional) Set page limit
- Select test categories
- Click "Start Validation Run"

### Category Selection

- Available Categories: Left list
- Selected Categories: Right list
- Use arrow buttons to move categories between lists
- Recommended: UI Testing + Visual Comprehensive

---

## 📊 Test Categories

| Category | Purpose |
|----------|---------|
| UI Testing | Typography, colors, spacing, buttons |
| SEO Validation | Meta tags, canonical, schema |
| Content Validation | Page availability, content accuracy |
| Functional Testing | Forms, navigation, interactions |
| Link Validation | Internal, external, anchor links |
| Performance Testing | Core Web Vitals, optimization |
| Responsive Testing | Desktop, tablet, mobile layouts |
| Browser Compatibility | Chrome, Firefox, Edge, Safari |
| Accessibility Testing | WCAG, keyboard, screen readers |
| Security Validation | SSL, headers, form security |
| Analytics Validation | GA4, GTM, tracking |
| Migration Validation | URL, content, DOM changes |
| Error Monitoring | Negative scenarios, errors |
| Visual Comprehensive | All 5 visual tools combined |

---

## 📊 Results & Reports

### Dashboard Display

**Validation Summary:**
- Execution ID and timestamp
- Total pages and assertions
- Passed/Failed/Warnings count
- Category breakdown

**Validation Assertions Table:**
- Page URL
- Element ID, Class, Tag, Selector
- Test Category and Sub-Test
- Expected vs Actual values
- Difference description
- Severity and Status
- Timestamp

**Execution Logging Console:**
- Real-time logs of every step
- Network requests
- Test execution progress
- Final summary

### Export Formats

- **Excel** - Multi-sheet workbook with summary, results, raw data
- **CSV** - Comma-separated format for spreadsheets
- **JSON** - Structured format for APIs and automation
- **XML** - Enterprise format for integrations

### Visual Reports

- **BackstopJS** - HTML report with before/after diff images
- **Cloud Tools** - Percy, Applitools, Chromatic dashboards

---

## 🔬 Advanced Features

### Element Tracking

Automatically captures for every test result:
- Element ID (if present)
- CSS Classes
- HTML Tag Type
- CSS Selector for targeting

### Color Normalization

Intelligent comparison handling:
- Multiple color formats (rgb, rgba, hex, hsl)
- Transparent color detection
- Format-independent comparison
- No false positives

### Responsive UI

- Auto-scrolling tables (20 rows visible)
- Fixed execution console
- Mobile-friendly layout
- Works at any zoom level

### Parallel Execution

All 5 visual tools run simultaneously for maximum coverage in minimal time.

---

## 🐛 Troubleshooting

### Validation doesn't start
- Hard refresh browser (Ctrl+F5)
- Restart dev server
- Check console for errors

### URLs don't match
- Ensure relative paths are identical
- Example: `/about` must match on both domains

### Element ID showing "N/A"
- Element doesn't have an ID attribute
- Check Element Selector column instead

### CORS/Network errors
- Expected for third-party scripts
- Does not affect test results

### BackstopJS report not generating
- Verify backstopjs is installed: `npm list backstopjs`
- Restart server: `npm run dev`

### Cloud tools not working
- Check .env.local has API keys
- Verify keys are valid
- Restart dev server after setting env vars

### Plugin not executing
- Hard refresh browser
- Verify category exists in ConfigRepository
- Check category ID matches plugin ID

### Slow performance
- Use "Limit scanned pages" option
- Select fewer test categories
- Use Webpage mode instead of Sitemap

---

## 🔐 Security

- No credentials stored - Only URLs are processed
- Local execution - Playwright runs on your machine
- HTTPS validation - SSL certificate checking built-in
- Input sanitization - All URLs validated before use
- Environment variables - API keys never committed to repo

---

## 📈 Performance Guidelines

**Recommended Configuration:**
- Pages: 5-10 for quick validation
- Timeout: 30 seconds per page
- Parallel browsers: 2-3 instances
- Categories: 3-4 most relevant

**Expected Times:**
- 1 page: 10-15 seconds
- 5 pages: 1-2 minutes
- 10 pages: 2-4 minutes
- 50+ pages: 10-20 minutes

---

## 📝 Example Results

**UI Testing:**
```
Page: /home-loan-on-whatsapp
Element: h2 (portlet-title-text)
Test: Typography: Heading Size
Status: ⚠️ WARNING

Expected: 24px (Production)
Actual: 20px (UAT)

Description: Heading font size changed by 4px
```

**Visual Comprehensive:**
```
Page: /about
Tool: BackstopJS

Status: ✅ PASS
Result: Pixel-perfect match detected
```

---

## 🤝 Contributing

To add new test categories:

1. Create plugin in `src/lib/validation/plugins/`
2. Implement ValidationPlugin interface
3. Register in ValidationEngine.plugins array
4. Add category config in ConfigRepository
5. Add UI category in page.tsx

---

## 📞 Support

For issues:
1. Check Troubleshooting section
2. Review execution logs
3. Check browser console (F12)
4. Verify URLs are accessible

API Keys:
- Applitools: https://applitools.com
- Percy: https://percy.io
- Chromatic: https://chromatic.com

---

**Last Updated:** June 9, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready

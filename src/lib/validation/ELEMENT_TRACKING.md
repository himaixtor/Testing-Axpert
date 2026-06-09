# Element Tracking Guide

## Overview

The TestingAxpert validation framework now supports tracking which HTML elements are being tested. This information appears in:
- **Validation Assertions Table** (UI)
- **Excel Reports**
- **CSV Exports**

## How to Use (EASY WAY - Recommended!)

### 1. Import the Helper

```typescript
import { createTestResultWithElement } from '../../utils/elementSelector';
```

### 2. Create Result with Element Info (EASIEST!)

Use `createTestResultWithElement()` - it automatically extracts element info:

```typescript
// Automatic! Element info is extracted automatically
results.push(await createTestResultWithElement(lowerPage, {
  pageUrl: relativeUrl,
  category: this.name,
  subTest: 'H1 Header Check',
  expectedValue: 'Exactly 1 H1',
  actualValue: '2 H1s found',
  differenceDescription: 'Multiple H1 tags detected',
  severity: 'MEDIUM',
  status: 'WARNING',
  elementSelector: 'h1'  // ← Just specify this!
}));
```

### 3. Available Element Information

The `elementInfo` object contains:

```typescript
{
  elementId?: string;        // HTML id attribute (e.g., "main-header")
  elementClass?: string;     // HTML class attribute (e.g., "btn btn-primary")
  elementTag?: string;       // HTML tag name (e.g., "button", "div")
  elementSelector?: string;  // CSS selector used (e.g., "h1", ".hero > h1")
}
```

## Examples

### Example 1: Header Element Testing

```typescript
const h1Info = await getElementInfo(page, 'h1');

results.push({
  pageUrl: relativeUrl,
  category: 'Content Validation',
  subTest: 'H1 Header',
  expectedValue: '1 H1 element',
  actualValue: '0 H1 elements',
  differenceDescription: 'Page is missing main heading',
  severity: 'HIGH',
  status: 'FAIL',
  timestamp: new Date().toISOString(),
  ...h1Info
});
```

**Result in Excel:**
| Element ID | Element Class | Element Tag | Element Selector |
|-----------|---------------|------------|-----------------|
| main-title | hero-heading | H1 | h1 |

### Example 2: Form Element Testing

```typescript
const submitInfo = await getElementInfo(page, 'button[type="submit"]');

results.push({
  pageUrl: relativeUrl,
  category: 'Functional Testing',
  subTest: 'Submit Button Present',
  expectedValue: 'Submit button visible',
  actualValue: 'Submit button found',
  differenceDescription: 'Submit button is present and functional',
  severity: 'LOW',
  status: 'PASS',
  timestamp: new Date().toISOString(),
  ...submitInfo
});
```

### Example 3: Navigation Testing

```typescript
const navInfo = await getElementInfo(page, 'nav');

results.push({
  pageUrl: relativeUrl,
  category: 'UI Testing',
  subTest: 'Navigation Present',
  expectedValue: 'Navigation bar present',
  actualValue: 'Navigation bar found',
  differenceDescription: 'Navigation structure is correct',
  severity: 'MEDIUM',
  status: 'PASS',
  timestamp: new Date().toISOString(),
  ...navInfo
});
```

## Advanced Usage

### Get Element Info from Multiple Selectors

```typescript
import { getElementInfoFromQuery } from '../../utils/elementSelector';

// Tries selectors in order, uses first match
const elementInfo = await getElementInfoFromQuery(
  page,
  'Primary Navigation',
  'nav.primary-nav',
  'nav#main-nav',
  'nav'
);
```

### Generate Complex Selectors

```typescript
import { generateElementSelector } from '../../utils/elementSelector';

// Generates a CSS selector path to the element
const selector = await generateElementSelector(page, '.card .header h2');
// Result: "div > .card > .header > h2"
```

## Quick Reference - Copy & Paste Template

```typescript
import { createTestResultWithElement } from '../../utils/elementSelector';

// In your plugin's execute method:
results.push(await createTestResultWithElement(lowerPage, {
  pageUrl: relativeUrl,
  category: this.name,
  subTest: 'Your Test Name',
  expectedValue: 'Expected behavior',
  actualValue: 'Actual result',
  differenceDescription: 'What went wrong or what passed',
  severity: 'LOW',  // or MEDIUM, HIGH, CRITICAL
  status: 'PASS',   // or WARNING, FAIL
  elementSelector: 'css-selector'  // The element you're testing
}));
```

That's it! Element info is automatically captured! ✅

## Best Practices

1. **Use Specific Selectors**: More specific selectors help identify exact elements
   ```typescript
   // Good
   await getElementInfo(page, 'button.btn-submit');
   
   // Less helpful
   await getElementInfo(page, 'button');
   ```

2. **Document What You're Testing**: Make the element selector meaningful
   ```typescript
   // Good - clear purpose
   await getElementInfo(page, '#user-profile-avatar');
   
   // Less clear
   await getElementInfo(page, '.img-5');
   ```

3. **Handle Missing Elements**: Always provide fallback descriptions
   ```typescript
   const elementInfo = await getElementInfo(page, '.hero-section');
   
   results.push({
     pageUrl: relativeUrl,
     // ... other fields ...
     differenceDescription: elementInfo.elementId 
       ? `Hero section with ID: ${elementInfo.elementId}`
       : 'Hero section found but lacks ID attribute',
     ...elementInfo
   });
   ```

## Output in Reports

### Validation Assertions Table (UI)
Shows element information in a dedicated column:
- **#elementId** (in blue)
- **.elementClass** (in green)
- **<elementTag>** (in orange)
- CSS Selector (in gray, italicized)

### Excel Report
Adds columns:
- Element ID
- Element Class
- Element Tag
- Element Selector

### CSV Export
Same columns as Excel for easy import into other tools.

## Implementation in Plugins

All validation plugins should follow this pattern:

```typescript
import { createTestResultWithElement } from '../../utils/elementSelector';

export class MyValidationPlugin implements ValidationPlugin {
  id = 'myPlugin';
  name = 'My Validation';

  async execute(context: ValidationContext): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const { lowerPage, relativeUrl, enabledSubTests, logExecution } = context;

    if (enabledSubTests.has('myTest')) {
      // Automatically captures element info!
      results.push(await createTestResultWithElement(lowerPage, {
        pageUrl: relativeUrl,
        category: this.name,
        subTest: 'My Test',
        expectedValue: '...',
        actualValue: '...',
        differenceDescription: '...',
        severity: 'LOW',
        status: 'PASS',
        elementSelector: '.my-element'  // ← Just add this line!
      }));
    }

    return results;
  }
}
```

**That's all! Element ID, Class, Tag are captured automatically!**

## Troubleshooting

**Issue:** Element info showing "N/A" in reports
- **Cause:** Selector didn't match any element
- **Fix:** Verify the CSS selector is correct and element exists on page

**Issue:** Element ID not appearing
- **Cause:** HTML element doesn't have an id attribute
- **Fix:** This is normal - not all elements have IDs. Use class name or tag name instead

**Issue:** Selector is very long
- **Cause:** Using `generateElementSelector()` on deeply nested elements
- **Fix:** Use a more specific CSS selector directly

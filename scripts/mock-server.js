const http = require('http');

// Helper to write HTML response
function sendHtml(res, html, status = 200, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    ...headers
  });
  res.end(html);
}

// -------------------------------------------------------------
// PORT 3001: PRODUCTION SITE (SOURCE OF TRUTH)
// -------------------------------------------------------------
const prodServer = http.createServer((req, res) => {
  const url = req.url;
  
  // Production Security Headers
  const prodHeaders = {
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff'
  };

  if (url === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:3001/</loc></url>
  <url><loc>http://localhost:3001/about</loc></url>
  <url><loc>http://localhost:3001/services</loc></url>
  <url><loc>http://localhost:3001/contact</loc></url>
  <url><loc>http://localhost:3001/login</loc></url>
</urlset>`);
    return;
  }

  if (url === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nAllow: /');
    return;
  }

  // Home Page
  if (url === '/') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Home - Axpert Production</title>
        <meta name="description" content="This is the production home page of Axpert platform.">
        <link rel="canonical" href="http://localhost:3001/">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Axpert Prod"}</script>
        <!-- Google Tag Manager -->
        <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});})(window,document,'script','dataLayer','GTM-XXXX');</script>
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/about">About</a> | <a href="/services">Services</a> | <a href="/contact">Contact</a></nav>
        <main>
          <h1>Welcome to Axpert Production</h1>
          <p>This is the source of truth website container. We are running high-performance CMS systems here.</p>
          <div class="hero">
            <h2>Special Enterprise Solution</h2>
            <button class="btn-primary" style="background-color: rgb(15, 23, 42); color: rgb(255, 255, 255); border-radius: 4px; padding: 10px; font-family: sans-serif; font-size: 14px;">Get Started</button>
          </div>
        </main>
        <footer><p>&copy; 2026 Axpert Production Corp.</p></footer>
      </body>
      </html>
    `, 200, prodHeaders);
    return;
  }

  // About Page
  if (url === '/about') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>About Us - Axpert Production</title>
        <meta name="description" content="Read about our core business philosophy and mission statements.">
        <link rel="canonical" href="http://localhost:3001/about">
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/about">About</a></nav>
        <main>
          <h1>About Us</h1>
          <p>We are a world leading enterprise service provider specializing in migration tools.</p>
          <img src="https://via.placeholder.com/150" alt="Company Executive Team" />
        </main>
        <footer><p>&copy; 2026 Axpert Production Corp.</p></footer>
      </body>
      </html>
    `, 200, prodHeaders);
    return;
  }

  // Services Page
  if (url === '/services') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Our Services - Axpert Production</title>
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/services">Services</a></nav>
        <main>
          <h1>Our High Quality Services</h1>
          <ul>
            <li>Cloud Migrations</li>
            <li>QA Automation</li>
          </ul>
        </main>
      </body>
      </html>
    `, 200, prodHeaders);
    return;
  }

  // Contact Page
  if (url === '/contact') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contact Us - Axpert Production</title>
      </head>
      <body>
        <main>
          <h1>Contact Sales</h1>
          <form method="post" action="/submit-form">
            <input type="hidden" name="csrf_token" value="abc123xyz_securetoken" />
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" />
            <button type="submit">Submit Form</button>
          </form>
        </main>
      </body>
      </html>
    `, 200, prodHeaders);
    return;
  }

  // Login Page
  if (url === '/login') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head><title>Login - Secure Portal</title></head>
      <body>
        <form method="post" action="/auth">
          <label for="pwd">Password:</label>
          <input type="password" id="pwd" name="password" />
          <button type="submit">Login</button>
        </form>
      </body>
      </html>
    `, 200, prodHeaders);
    return;
  }

  sendHtml(res, '<h1>404 Not Found</h1>', 404);
});

// -------------------------------------------------------------
// PORT 3002: UAT / LOWER ENVIRONMENT (WITH INTENTIONAL ERRORS)
// -------------------------------------------------------------
const uatServer = http.createServer((req, res) => {
  const url = req.url;

  // UAT (missing security headers)
  const uatHeaders = {};

  if (url === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://localhost:3002/</loc></url>
  <url><loc>http://localhost:3002/about</loc></url>
  <url><loc>http://localhost:3002/services</loc></url>
  <url><loc>http://localhost:3002/contact</loc></url>
  <url><loc>http://localhost:3002/login</loc></url>
</urlset>`);
    return;
  }

  // Home Page (Changes: Title, Heading, Button styles, no GTM)
  if (url === '/') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Home - UAT Staging Portal</title> <!-- SEO Title Diff -->
        <meta name="description" content="This is the production home page of Axpert platform.">
        <link rel="canonical" href="http://localhost:3002/">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Axpert UAT"}</script>
        <!-- GTM Script is missing here -->
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/about">About</a> | <a href="/services">Services</a> | <a href="/contact">Contact</a></nav>
        <main>
          <h1>Welcome to Axpert UAT</h1> <!-- H1 Content Diff -->
          <p>This is the source of truth website container. We are running high-performance CMS systems here.</p>
          <div class="hero">
            <h2>Special Enterprise Solution</h2>
            <!-- Button Background Color regression: blue instead of slate black, and border radius diff -->
            <button class="btn-primary" style="background-color: rgb(37, 99, 235); color: rgb(255, 255, 255); border-radius: 12px; padding: 10px; font-family: sans-serif; font-size: 14px;">Get Started</button>
          </div>
        </main>
        <footer><p>&copy; 2026 Axpert Production Corp.</p></footer>
      </body>
      </html>
    `, 200, uatHeaders);
    return;
  }

  // About Page (Changes: Missing Alt attribute on Image, H1 heading text)
  if (url === '/about') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>About Us - Axpert Production</title>
        <meta name="description" content="Read about our core business philosophy and mission statements.">
        <link rel="canonical" href="http://localhost:3002/about">
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/about">About</a></nav>
        <main>
          <h1>About Axpert Platform</h1> <!-- H1 Content Diff -->
          <p>We are a world leading enterprise service provider specializing in migration tools.</p>
          <!-- Missing alt attribute regression -->
          <img src="https://via.placeholder.com/150" />
        </main>
        <footer><p>&copy; 2026 Axpert Production Corp.</p></footer>
      </body>
      </html>
    `, 200, uatHeaders);
    return;
  }

  // Services Page (Changes: Link to broken page returning 404 on UAT)
  if (url === '/services') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Our Services - Axpert Production</title>
      </head>
      <body>
        <nav><a href="/">Home</a> | <a href="/services">Services</a></nav>
        <main>
          <h1>Our High Quality Services</h1>
          <ul>
            <li>Cloud Migrations</li>
            <li>QA Automation</li>
          </ul>
          <!-- Broken link regression -->
          <a href="/broken-link-target">Click here for details</a>
        </main>
      </body>
      </html>
    `, 200, uatHeaders);
    return;
  }

  // Contact Page (Changes: Form missing anti-CSRF token)
  if (url === '/contact') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contact Us - Axpert Production</title>
      </head>
      <body>
        <main>
          <h1>Contact Sales</h1>
          <form method="post" action="/submit-form">
            <!-- Missing CSRF token field regression -->
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" />
            <button type="submit">Submit Form</button>
          </form>
        </main>
      </body>
      </html>
    `, 200, uatHeaders);
    return;
  }

  // Login Page (Changes: Input type is text instead of password!)
  if (url === '/login') {
    sendHtml(res, `
      <!DOCTYPE html>
      <html>
      <head><title>Login - Secure Portal</title></head>
      <body>
        <form method="post" action="/auth">
          <label for="pwd">Password:</label>
          <!-- Input type="text" instead of password regression! -->
          <input type="text" id="pwd" name="password" />
          <button type="submit">Login</button>
        </form>
      </body>
      </html>
    `, 200, uatHeaders);
    return;
  }

  // 404 response for the broken link target
  if (url === '/broken-link-target') {
    sendHtml(res, '<h1>UAT Error: 404 Page Not Found</h1>', 404);
    return;
  }

  sendHtml(res, '<h1>404 Not Found</h1>', 404);
});

// Start listening
prodServer.listen(3001, () => {
  console.log('Production Environment Mock Server running at http://localhost:3001/');
});

uatServer.listen(3002, () => {
  console.log('UAT (Lower) Environment Mock Server running at http://localhost:3002/');
});

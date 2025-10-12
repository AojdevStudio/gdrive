---
url: https://frontendchecklist.io/
scraped_date: 2025-08-25T15:52:30-05:00
domain: frontendchecklist.io
title: "Frontend Checklist"
source: "Frontend Checklist"
section: "Frontend Development Best Practices"
---

# Frontend Checklist

_A comprehensive checklist for frontend development best practices_

## Head

### Meta Tags

- **Doctype**: The Doctype is HTML5 and is at the top of all your HTML pages.

```html
<!doctype html>
```

- **Charset**: The charset declared (UTF-8) is declared correctly.

```html
<meta charset="utf-8">
```

- **Viewport**: The viewport is declared correctly.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- **Title**: A title is used on all pages
  - SEO: Google calculates the pixel width of the characters used in the title and cuts off between 472 and 482 pixels. Average character limit would be around 55 characters

```html
<title>Page Title less than 65 characters</title>
```

- **Description**: A meta description is provided, it is unique and doesn't possess more than 150 characters.

```html
<meta name="description" content="Description of the page less than 150 characters">
```

### Favicons

- **Favicons**: Each favicon has been created and displays correctly.
  - If you have only a favicon.ico, put it at the root of your site. Normally you won't need to use any markup. However, it's still good practice to link to it using the example below. Today, PNG format is recommended over .ico format (dimensions: 32x32px).

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
```

### Apple & Windows Integration

- **Apple Web App Meta**: Apple meta-tags are present.

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
```

- **Windows Tiles**: Windows tiles are present and linked.

```html
<meta name="msapplication-TileColor" content="#da532c">
<meta name="msapplication-TileImage" content="/mstile-144x144.png">
```

### SEO & Language

- **Canonical**: Use rel="canonical" to avoid duplicate content.

```html
<link rel="canonical" href="http://example.com/2017/09/a-new-article-to-read.html">
```

- **Language attribute**: The `lang` attribute of your website is specified and related to the language of the current page.

```html
<html lang="en">
```

- **Direction attribute**: The direction of lecture is specified on the html tag (It can be used on another HTML tag).

```html
<html dir="rtl" lang="he">
```

- **Alternate language**: The language tag of your website is specified and related to the language of the current page.

```html
<link rel="alternate" href="https://es.example.com/" hreflang="es">
```

### CSS & JavaScript Loading

- **Inline critical CSS**: The inline critical CSS is correctly injected in the HEAD.
  - The CSS critical (or above the fold) collects all the CSS used to render the visible portion of the page. It is embedded before your principal CSS call and between `<style></style>` in a single line (minified).

- **CSS order**: All CSS files are loaded before any JavaScript files in the HEAD

### Social Media

- **Facebook Open Graph**: All Facebook Open Graph (OG) are tested and no one is missing or with a false information. Images need to be at least 600 x 315 pixels, although 1200 x 630 pixels is recommended.

```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/page.html">
<meta property="og:title" content="Content Title">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:description" content="Description Here">
<meta property="og:site_name" content="Site Name">
<meta property="og:locale" content="en_US">
```

- **Twitter Card**: Twitter Card tags are properly configured

```html
<meta name="twitter:card" content="summary">
<meta name="twitter:site" content="@site_account">
<meta name="twitter:creator" content="@individual_account">
<meta name="twitter:url" content="https://example.com/page.html">
<meta name="twitter:title" content="Content Title">
<meta name="twitter:description" content="Content description less than 200 characters">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

## HTML

### Best Practices

- **HTML5 Semantic Elements**: HTML5 Semantic Elements are used appropriately (header, section, footer, main...)

- **Error pages**: Error 404 page and 5xx exist

- **Noopener**: In case you are using external links with target="\_blank", your link should have a rel="noopener" attribute to prevent tab nabbing.

```html
<a href="http://example.com" target="_blank" rel="noopener noreferrer">
```

- **Clean up comments**: Unnecessary code needs to be removed before sending the page to production.

### Testing

- **W3C compliant**: All pages need to be tested with the W3C validator to identify possible issues in the HTML code.

- **HTML Lint**: Use tools to help analyze any issues in HTML code.

- **Link checker**: There are no broken links in your page, verify that you don't have any 404 error.

- **Adblockers test**: Your website shows your content correctly with adblockers enabled

## Webfonts

- **Webfont format**: WOFF, WOFF2 and TTF are supported by all modern browsers.

- **Webfont size**: Webfont sizes don't exceed 100 KB (all variants included).

- **Webfont loader**: Control loading behavior with a webfont loader.

## CSS

### Structure & Organization

- **Responsive Web Design**: The website is using responsive web design.

- **CSS Print**: A print stylesheet is provided and is correct on each page.

- **Unique ID**: If IDs are used, they are unique to a page.

- **Reset CSS**: A CSS reset (reset, normalize or reboot) is used and up to date.

- **JS prefix**: All classes (or id- used in JavaScript files) begin with js- and are not styled into the CSS files.

```css
.js-slider-home /* Class used in JavaScript files */
.slider-home    /* Class used in CSS files */
```

### Performance

- **Embedded or inline CSS**: Avoid at all cost embeding CSS in `<style>` tags or using inline CSS

- **Vendor prefixes**: CSS vendor prefixes are used and are generated accordingly with your browser support compatibility.

- **Concatenation**: CSS files are concatenated in a single file (Not for HTTP/2).

- **Minification**: All CSS files are minified.

- **Non-blocking**: CSS files need to be non-blocking to prevent the DOM from taking time to load.

### Testing

- **Stylelint**: All CSS or SCSS files are without any errors.

- **Responsive web design**: All pages were tested with the correct breakpoints.

- **CSS Validator**: The CSS was tested and pertinent errors were corrected.

- **Desktop Browsers**: All pages were tested on all current desktop browsers (Safari, Firefox, Chrome, Internet Explorer, EDGE...)

- **Mobile Browsers**: All pages were tested on all current mobile browsers (Native browser, Chrome, Safari...)

- **OS**: All pages were tested on all current OS (Windows, Android, iOS, Mac...)

- **Reading direction**: All pages need to be tested for LTR and RTL languages if they need to be supported.

## JavaScript

### Best Practices

- **JavaScript Inline**: You don't have any JavaScript code inline (mixed with your HTML code).

- **Concatenation**: JavaScript files are concatenated.

- **Minification**: JavaScript files are minified (you can add the .min suffix).

- **JavaScript security**: No sensitive information should be exposed in JavaScript files.

- **noscript tag**: Use `<noscript>` tag in the HTML body if a script type on the page is unsupported or if scripting is currently turned off in the browser.

```html
<noscript>
  <a href="http://www.enable-javascript.com/" target="_blank">
    Please enable JavaScript to view this website.
  </a>
</noscript>
```

### Performance

- **Non-blocking**: JavaScript files are loaded asynchronously using async or deferred using defer attribute.

```html
<!-- Defer is recommended for scripts that need DOM ready -->
<script defer src="foo.js"></script>
<!-- Async for scripts that can run independently -->
<script async src="foo.js"></script>
```

- **Modernizr**: If you need to target some specific features you can use a custom Modernizr to add classes in your `<html>` tag.

### Testing

- **ESLint**: No errors are flagged by ESLint (based on your configuration or standards rules).

## Images

### Optimization

- **Optimization**: All images are optimized to be rendered in the browser. WebP format could be used for critical pages (like Homepage)

- **Picture/Srcset**: You use picture/srcset to provide the most appropriate image for the current viewport of the user.

```html
<img srcset="elva-fairy-320w.jpg 320w, elva-fairy-480w.jpg 480w, elva-fairy-800w.jpg 800w"
     sizes="(max-width: 320px) 280px, (max-width: 480px) 440px, 800px"
     src="elva-fairy-800w.jpg" alt="Elva dressed as a fairy">
```

- **Retina**: You provide layout images 2x or 3x, support retina display.

- **Sprite**: Small images are in a sprite file (in the case of icons, they can be in an SVG sprite image).

- **Width and Height**: Set width and height attributes on `<img>` if the final rendered image size is known.

- **Alternative text**: All `<img>` have an alternative text which describe the image visually.

```html
<img src="puppy.jpg" alt="Puppy playing fetch in the park">
```

- **Lazy loading**: Images are lazyloaded (A noscript fallback is always provided).

## Accessibility

### Progressive Enhancement

- **Progressive enhancement**: Major functionality like main navigation and search should work without JavaScript enabled.

- **Color contrast**: Color contrast should at least pass WCAG AA (AAA for mobile).

- **H1**: All pages have an H1 which is not the title of the website.

- **Headings**: Headings should be used properly and in the right order (H1 to H6).

- **Specific HTML5 input types**: This is especially important for mobile devices that show customized keypads and widgets for different types.

```html
<input type="email" />
<input type="tel" />
<input type="calendar" />
```

- **Label**: A label is associated with each input form element. In case a label can't be displayed, use aria-label instead.

```html
<label for="email">Email</label>
<input type="email" id="email" />
<!-- Or -->
<input type="email" aria-label="Email" />
```

### Testing

- **Accessibility standards testing**: Use the WAVE tool to test if your page respects the accessibility standards.

- **Keyboard navigation**: Test your website using only your keyboard in a previsible order. All interactive elements are reachable and usable.

- **Screen reader**: All pages were tested in two or more screen readers (such as JAWS, VoiceOver, and NVDA).

- **Focus style**: If the focus is disabled, it is replaced by visible state in CSS.

## Performance

### Page Optimization

- **Page weight**: The weight of each page is between 0 and 500 KB.

- **Minified HTML**: Your HTML is minified.

- **Lazy loading**: Images, scripts and CSS need to be lazy loaded to improve the response time of the current page

- **Cookie size**: If you are using cookies be sure each cookie doesn't exceed 4096 bytes and your domain name doesn't have more than 20 cookies.

- **Third party components**: Third party iframes or components relying on external JS are replaced by static components when possible.

### Resource Loading

- **DNS resolution**: DNS of third-party services that may be needed are resolved in advance during idle time using dns-prefetch.

```html
<link rel="dns-prefetch" href="//example.com">
```

- **Preconnection**: DNS lookup, TCP handshake and TLS negotiation with services that will be needed soon is done in advance during idle time using preconnect.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
```

- **Prefetching**: Resources that will be needed soon are requested in advance during idle time using prefetch.

```html
<link rel="prefetch" href="image.png">
```

- **Preloading**: Resources needed in the current page in advance using preload.

```html
<link rel="preload" href="app.js" as="script">
```

### Testing

- **Google PageSpeed**: All your pages were tested (not only the homepage) and have a score of at least 90/100.

## SEO

### Analytics & Tracking

- **Google Analytics**: Google Analytics is installed and correctly configured.

- **Headings logic**: Heading text helps to understand the content in the current page.

- **sitemap.xml**: A sitemap.xml exists and was submitted to Google Search Console.

- **robots.txt**: The robots.txt is not blocking webpages.

### Structured Data

- **Structured Data**: Pages using structured data are tested and are without errors. Structured data helps crawlers understand the content in the current page.

```html
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "Organization",
  "name": "Your Organization Name",
  "url": "http://www.example.com",
  "sameAs": ["http://www.facebook.com/your-profile", "http://instagram.com/yourProfile"]
}
</script>
```

- **Sitemap HTML**: An HTML sitemap is provided and is accessible via a link in the footer of your website.

- **Pagination link tags**: Provide rel="prev" and rel="next" to indicate paginated content.

```html
<link rel="prev" href="http://www.example.com/article/?page=1">
<link rel="next" href="http://www.example.com/article/?page=3">
```

---

## Tools & Resources

### Validators & Testing

- [W3C Markup Validator](https://validator.w3.org/)
- [W3C CSS Validator](https://jigsaw.w3.org/css-validator/)
- [WAVE Accessibility Tester](http://wave.webaim.org/)
- [Google PageSpeed Insights](https://developers.google.com/speed/pagespeed/insights/)

### Performance

- [WebPagetest](https://www.webpagetest.org/)
- [GTmetrix](https://gtmetrix.com/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse/)

### SEO

- [Google Search Console](https://search.google.com/search-console/)
- [Structured Data Testing Tool](https://developers.google.com/structured-data/testing-tool/)

---

**Source:** Frontend Checklist (frontendchecklist.io)  
**Last Updated:** 2025-08-25  
**Note:** This checklist should be used as a comprehensive guide for frontend development best practices.

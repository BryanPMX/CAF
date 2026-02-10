# CAF Marketing Site - Public Web Presence

This directory contains the SvelteKit-based marketing website for Centro de Apoyo para la Familia (CAF), providing public information, service descriptions, and contact functionality.

## Marketing Architecture Overview

The marketing site follows modern SvelteKit patterns with server-side rendering and static generation:

- **SvelteKit Framework**: Full-stack web framework with SSR/SSG
- **Component-Based Architecture**: Reusable UI components
- **Server-Side Rendering**: SEO-optimized page delivery
- **Static Site Generation**: Fast loading and hosting flexibility
- **API Integration**: Backend connectivity for dynamic content

## Directory Structure

```
marketing/
├── src/
│   ├── app.css                     # Global styles and Tailwind imports
│   ├── app.html                    # HTML template with meta tags
│   ├── lib/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── Header.svelte      # Navigation header
│   │   │   ├── Footer.svelte      # Site footer
│   │   │   └── ContactInfo.svelte # Contact information display
│   │   ├── config.js              # Application configuration
│   │   └── utils/                 # Utility functions
│   │       ├── apiClient.js       # HTTP client for backend integration
│   │       ├── errorHandler.js    # Centralized error handling
│   │       └── formValidator.js   # Form validation utilities
│   └── routes/                    # SvelteKit routes (file-based routing)
│       ├── +layout.svelte         # Root layout component
│       ├── +page.svelte           # Homepage
│       ├── contacto/
│       │   └── +page.svelte       # Contact page
│       ├── eventos/
│       │   ├── +page.server.js    # Server-side data loading
│       │   └── +page.svelte       # Events page
│       └── servicios/
│           ├── +page.server.js    # Server-side service data
│           └── +page.svelte       # Services page
├── static/                        # Static assets
│   ├── logo.png                   # CAF logo
│   └── patterns/                  # Background patterns
├── package.json                   # Dependencies and scripts
├── svelte.config.js              # SvelteKit configuration
├── tailwind.config.cjs           # Tailwind CSS configuration
├── vite.config.js                # Vite bundler configuration
└── README.md                     # This documentation
```

## Key Components

### 1. Application Configuration (`src/lib/config.js`)

**Centralized Configuration** (see `src/lib/config.js`; values can be overridden via `VITE_*` env vars):

- `config.api.baseUrl` – API base URL (e.g. `https://api.caf-mexico.com/api/v1`); set `VITE_API_URL` in production.
- `config.site`, `config.contact`, `config.social` – site name, contact info, social links.
- Google Maps: `VITE_GOOGLE_MAPS_API_KEY` (required for contact page map).

### 2. Utility Functions

**API Client (`src/lib/utils/apiClient.js`):**
- HTTP client for backend integration
- Request/response interceptors
- Error handling and retry logic
- JSON data serialization

**Error Handler (`src/lib/utils/errorHandler.js`):**
- Centralized error management
- User-friendly error messages
- Logging and reporting
- Graceful error recovery

**Form Validator (`src/lib/utils/formValidator.js`):**
- Input validation and sanitization
- Schema-based validation
- Real-time validation feedback
- Security-focused input cleaning

### 3. UI Components

**Header Component (`src/lib/components/Header.svelte`):**
- Responsive navigation menu
- Logo and branding
- Mobile-friendly hamburger menu
- Active page highlighting

**Footer Component (`src/lib/components/Footer.svelte`):**
- Contact information display
- Social media links
- Legal disclaimers
- Multi-language support ready

**Contact Info Component (`src/lib/components/ContactInfo.svelte`):**
- Address and phone display
- Business hours information
- Map integration ready
- Accessibility compliant

## Routing Architecture

### SvelteKit File-Based Routing

**Route Structure:**
- `+page.svelte` - Page components
- `+page.server.js` - Server-side data loading
- `+layout.svelte` - Layout components
- `+error.svelte` - Error boundaries

**Route Examples:**
- `/` - Homepage (+page.svelte)
- `/contacto` - Contact page (contacto/+page.svelte)
- `/servicios` - Services page (servicios/+page.server.js + servicios/+page.svelte)
- `/eventos` - Events page (eventos/+page.server.js + eventos/+page.svelte)

### Server-Side Data Loading

**Services Page (`routes/servicios/+page.server.js`):**
```javascript
export async function load({ fetch }) {
  try {
    const response = await fetch(`${config.API_BASE_URL}/services`);
    const services = await response.json();

    return {
      services,
      meta: {
        title: 'Nuestros Servicios',
        description: 'Conoce los servicios legales que ofrecemos'
      }
    };
  } catch (error) {
    console.error('Failed to load services:', error);
    return {
      services: [],
      error: 'Unable to load services at this time'
    };
  }
}
```

## Styling and Design

### Tailwind CSS Integration

**Global Styles (`src/app.css`):**
```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Custom styles */
@layer components {
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
  }

  .hero-section {
    @apply bg-gradient-to-r from-blue-600 to-purple-600 text-white;
  }
}
```

**Responsive Design:**
- Mobile-first approach
- Breakpoint-based layouts
- Accessible color schemes
- Fast loading optimizations

## API Integration

### Backend Connectivity

**Public API Endpoints:**
- Service information retrieval
- Event calendar data
- Contact form submission
- Newsletter subscription

**Data Fetching Patterns:**
```javascript
// Client-side data fetching
import { apiClient } from '$lib/utils/apiClient';

export async function loadServices() {
  return await apiClient.get('/services');
}

// Server-side data fetching (SSR)
export async function load({ fetch }) {
  const response = await fetch(`${config.API_BASE_URL}/services`);
  return await response.json();
}
```

## SEO and Performance

### Search Engine Optimization

**Meta Tags Configuration:**
```html
<!-- src/app.html -->
<meta name="description" content="Centro de Apoyo para la Familia - Servicios legales accesibles" />
<meta name="keywords" content="apoyo legal, derechos humanos, asistencia jurídica" />
<meta property="og:title" content="CAF - Centro de Apoyo para la Familia" />
<meta property="og:description" content="Servicios legales gratuitos y accesibles" />
```

**Structured Data:**
- JSON-LD schema markup
- Organization information
- Service descriptions
- Event information

### Performance Optimizations

**Static Site Generation:**
```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: null
    })
  }
};
```

**Image Optimization:**
- Responsive images
- WebP format support
- Lazy loading implementation
- CDN integration ready

## Development Workflow

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Configuration

**Development vs Production:**
- API endpoint switching
- Analytics integration
- Error tracking setup
- Performance monitoring

## Build and Deployment

### Vercel Deployment

**Vercel Configuration:**
```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter()
  }
};
```

**Build Commands:**
```bash
# Development build
npm run dev

# Production build
npm run build

# Static export (optional)
npm run export
```

### Static Site Generation

**Benefits:**
- Fast loading times
- SEO optimization
- Low hosting costs
- CDN compatibility
- Offline functionality

## Content Management

### Dynamic Content Loading

**Service Information:**
- Legal service descriptions
- Eligibility requirements
- Application processes
- Success stories

**Event Calendar:**
- Upcoming workshops
- Community events
- Training sessions
- Awareness campaigns

**Contact Forms:**
- Service inquiries
- Volunteer applications
- Partnership requests
- General feedback

## Accessibility Features

### WCAG Compliance

**Accessibility Implementation:**
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus management

**Inclusive Design:**
- Multi-language support ready
- Font size scalability
- High contrast mode support
- Reduced motion preferences

## Analytics and Monitoring

### Performance Monitoring

**Web Vitals Tracking:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

### User Analytics

**Privacy-Focused Analytics:**
- Anonymous usage statistics
- Conversion tracking
- Popular content identification
- User journey analysis

## Future Enhancements

### Planned Features

**Content Management System:**
- Admin interface for content updates
- Dynamic service information
- Event management system
- Newsletter integration

**Multi-Language Support:**
- Spanish/English toggle
- Localized content management
- Cultural adaptation
- Accessibility translations

**Interactive Features:**
- Appointment booking widget
- Service eligibility checker
- Virtual assistant integration
- Live chat support

### Technical Improvements

**Progressive Web App:**
- Service worker implementation
- Offline functionality
- App-like experience
- Push notification support

**Advanced SEO:**
- Dynamic meta tags
- Structured data automation
- Performance optimization
- Core Web Vitals monitoring

This marketing website serves as the public face of CAF, providing comprehensive information about legal services, building community trust, and facilitating access to support services through an accessible, performant, and user-friendly web presence.

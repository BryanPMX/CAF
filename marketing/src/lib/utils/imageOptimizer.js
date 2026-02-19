// marketing/src/lib/utils/imageOptimizer.js
// Lightweight URL optimizer for known image CDNs.

const UNSPLASH_HOST = 'images.unsplash.com';
const URL_PARAM_CDNS = [
  'images.ctfassets.net',
  'cdn.sanity.io',
  'images.prismic.io',
  'ik.imagekit.io',
  'res.cloudinary.com',
  'imgix.net',
  'cloudfront.net',
];

function isAbsoluteHttpUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function withQueryParams(urlObj, params) {
  const nextUrl = new URL(urlObj.toString());
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      nextUrl.searchParams.set(key, String(value));
    }
  }
  return nextUrl.toString();
}

function optimizeCloudinary(urlObj, width, quality) {
  const marker = '/upload/';
  if (!urlObj.pathname.includes(marker)) return urlObj.toString();

  const [prefix, suffix] = urlObj.pathname.split(marker);
  const cleanSuffix = suffix.replace(/^\/+/, '');
  const transformedPath = `${prefix}${marker}f_auto,q_${quality},w_${width},c_limit/${cleanSuffix}`;
  const optimized = new URL(urlObj.toString());
  optimized.pathname = transformedPath;
  return optimized.toString();
}

function optimizeUnsplash(urlObj, width, quality) {
  return withQueryParams(urlObj, {
    auto: 'format',
    fit: 'max',
    q: quality,
    w: width,
    dpr: 1,
  });
}

function optimizeQueryParamCdn(urlObj, width, quality) {
  return withQueryParams(urlObj, {
    w: width,
    q: quality,
    auto: 'format',
    fm: 'webp',
  });
}

export function getOptimizedImageUrl(src, width = 1200, { quality = 70 } = {}) {
  if (!src || typeof src !== 'string') return '';
  const value = src.trim();
  if (!value || value.startsWith('data:') || !isAbsoluteHttpUrl(value)) return value;

  try {
    const urlObj = new URL(value);
    const host = urlObj.hostname.toLowerCase();

    if (host === UNSPLASH_HOST) return optimizeUnsplash(urlObj, width, quality);
    if (host.includes('res.cloudinary.com')) return optimizeCloudinary(urlObj, width, quality);
    if (URL_PARAM_CDNS.some((cdnHost) => host.includes(cdnHost))) {
      return optimizeQueryParamCdn(urlObj, width, quality);
    }

    return value;
  } catch {
    return value;
  }
}

export function buildResponsiveSrcSet(src, widths = [], options = {}) {
  if (!src || !Array.isArray(widths) || widths.length === 0) return '';

  const urlToWidth = new Map();
  for (const width of widths) {
    const optimized = getOptimizedImageUrl(src, width, options);
    if (!optimized) continue;
    const current = urlToWidth.get(optimized);
    if (!current || width > current) urlToWidth.set(optimized, width);
  }

  if (urlToWidth.size <= 1) return '';

  return [...urlToWidth.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([url, width]) => `${url} ${width}w`)
    .join(', ');
}

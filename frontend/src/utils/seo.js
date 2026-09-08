import { useEffect } from 'react';

const SITE_NAME = 'jion';
const DEFAULT_TITLE = 'jion — 오늘 놓치면 안 될 AI';
const DEFAULT_DESCRIPTION = '오늘 놓치면 안 될 AI 정보와 활용법을 발견하고 사람들과 경험을 나누세요.';
const DEFAULT_OG_IMAGE_PATH = '/api/v1/seo/og/default.png';

const MAX_DESCRIPTION_LENGTH = 170;

const collapseWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();

const toAbsoluteUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (typeof window === 'undefined') return value;
  return new URL(value, window.location.origin).toString();
};

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    element.setAttribute(key, val);
  });
};

const upsertCanonical = (href) => {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
};

export const createMetaDescription = (rawText, maxLength = MAX_DESCRIPTION_LENGTH) => {
  const collapsed = collapseWhitespace(rawText || '');
  if (!collapsed) return DEFAULT_DESCRIPTION;
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 3).trimEnd()}...`;
};

export function useSeo({
  title,
  description,
  url,
  image,
  type = 'website',
  noindex = false,
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const finalTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const finalDescription = createMetaDescription(description);
    const finalUrl = toAbsoluteUrl(url || window.location.href);
    const finalImage = toAbsoluteUrl(image || DEFAULT_OG_IMAGE_PATH);

    document.title = finalTitle;

    upsertMeta('meta[name="description"]', { name: 'description', content: finalDescription });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: finalTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: finalDescription });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: finalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: finalImage });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: finalTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: finalDescription });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: finalImage });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' });
    upsertCanonical(finalUrl);
  }, [title, description, url, image, type, noindex]);
}

export const seoDefaults = {
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_PATH,
};

import React from 'react';
import { Globe, Mail, ExternalLink, Link2 } from 'lucide-react';

// Regex patterns for URLs and emails
const URL_REGEX = /(https?:\/\/[^\s<>"'{}|\\^`]+|(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'{}|\\^`]*)?|(?:github\.com|linkedin\.com\/(?:in|company)|gitlab\.com|behance\.net|dribbble\.com)\/[a-zA-Z0-9_./-]+)/gi;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

function cleanUrlPunctuation(str) {
  if (!str) return '';
  return str.replace(/[.,;:)'"\]]+$/, '').trim();
}

/**
 * Extract, sanitize, categorize, and deduplicate all hyperlinks and contact links from CV text & PDF annotations
 */
export function extractLinksFromDocument(text = '', annotations = []) {
  const seenUrls = new Set();
  const rawLinks = [];

  // 1. Collect PDF link annotations
  if (Array.isArray(annotations)) {
    for (const ann of annotations) {
      if (typeof ann === 'string' && ann.trim()) {
        rawLinks.push(ann.trim());
      } else if (ann && typeof ann.url === 'string') {
        rawLinks.push(ann.url.trim());
      }
    }
  }

  // 2. Extract URLs and emails from document text
  if (typeof text === 'string') {
    const urlMatches = text.match(URL_REGEX) || [];
    for (const match of urlMatches) {
      rawLinks.push(match);
    }

    const emailMatches = text.match(EMAIL_REGEX) || [];
    for (const match of emailMatches) {
      rawLinks.push(match);
    }
  }

  const results = [];

  for (const raw of rawLinks) {
    const cleaned = cleanUrlPunctuation(raw);
    if (!cleaned || cleaned.length < 4) continue;

    const isEmail = cleaned.includes('@') && !cleaned.startsWith('http');
    let finalUrl = cleaned;
    let type = 'other';
    let label = cleaned;

    if (isEmail) {
      type = 'email';
      finalUrl = cleaned.startsWith('mailto:') ? cleaned : `mailto:${cleaned}`;
      label = cleaned.replace(/^mailto:/i, '');
    } else {
      if (!/^https?:\/\//i.test(cleaned)) {
        finalUrl = `https://${cleaned}`;
      }

      const lower = finalUrl.toLowerCase();
      if (lower.includes('linkedin.com')) {
        type = 'linkedin';
        const match = finalUrl.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
        label = match ? `LinkedIn: /${match[1]}` : 'LinkedIn';
      } else if (lower.includes('github.com')) {
        type = 'github';
        const match = finalUrl.match(/github\.com\/([^/?#]+)/i);
        label = match ? `GitHub: /${match[1]}` : 'GitHub';
      } else if (lower.includes('gitlab.com')) {
        type = 'github';
        const match = finalUrl.match(/gitlab\.com\/([^/?#]+)/i);
        label = match ? `GitLab: /${match[1]}` : 'GitLab';
      } else if (lower.includes('behance.net') || lower.includes('dribbble.com')) {
        type = 'portfolio';
        label = 'Portfolio';
      } else if (/portfolio|personal|resume|dev|vercel|netlify|github\.io/i.test(lower)) {
        type = 'portfolio';
        try {
          const u = new URL(finalUrl);
          label = `Portfolio (${u.hostname})`;
        } catch {
          label = 'Portfolio';
        }
      } else {
        type = 'website';
        try {
          const u = new URL(finalUrl);
          label = u.hostname.replace(/^www\./, '');
        } catch {
          label = cleaned;
        }
      }
    }

    const dedupeKey = finalUrl.toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(dedupeKey)) continue;
    seenUrls.add(dedupeKey);

    results.push({
      id: `${type}-${results.length}`,
      type,
      label,
      url: finalUrl,
      raw: cleaned
    });
  }

  // Prioritize order: LinkedIn -> GitHub -> Portfolio -> Website -> Email
  const typePriority = { linkedin: 1, github: 2, portfolio: 3, website: 4, email: 5, other: 6 };
  results.sort((a, b) => (typePriority[a.type] || 99) - (typePriority[b.type] || 99));

  return results;
}

/**
 * Convert plain text with URLs or emails into JSX elements with target="_blank" links
 */
export function linkifyContent(text, linkClassName = 'text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors') {
  if (!text || typeof text !== 'string') return text;

  // Split on URLs and emails
  const tokenRegex = /(https?:\/\/[^\s<>"'{}|\\^`]+|(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'{}|\\^`]*)?|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    const trimmed = cleanUrlPunctuation(part);
    if (trimmed.includes('@') && !trimmed.startsWith('http')) {
      const mailtoUrl = trimmed.startsWith('mailto:') ? trimmed : `mailto:${trimmed}`;
      return (
        <a
          key={idx}
          href={mailtoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
          title={`Send email to ${trimmed} (opens in new tab/client)`}
        >
          {part}
        </a>
      );
    }

    if (/^https?:\/\//i.test(trimmed) || /^(?:www\.)/i.test(trimmed) || /^(?:github\.com|linkedin\.com)/i.test(trimmed)) {
      const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      return (
        <a
          key={idx}
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
          title={`Open ${fullUrl} in new tab`}
        >
          {part}
        </a>
      );
    }

    return part;
  });
}

/**
 * Returns an appropriate icon component for a link type
 */
export function renderLinkIcon(type, className = 'w-3.5 h-3.5 shrink-0') {
  switch (type) {
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28Z" />
        </svg>
      );
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
        </svg>
      );
    case 'email':
      return <Mail className={className} />;
    case 'portfolio':
    case 'website':
      return <Globe className={className} />;
    default:
      return <Link2 className={className} />;
  }
}

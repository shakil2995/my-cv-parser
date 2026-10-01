import { createTokenRegex } from './scoring';

// Same URL/email pattern linkifyContent splits on; skill hits inside a link are skipped so links stay clickable.
const LINK_REGEX = /(https?:\/\/[^\s<>"'{}|\\^`]+|(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'{}|\\^`]*)?|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/gi;

/**
 * Find non-overlapping highlight ranges for matched positive skills and negative keywords.
 * Uses the scorer's own token regex so highlights line up exactly with what was counted.
 *
 * @param {string} text
 * @param {Array<{ keyword: string, mustHave?: boolean }>} positives - matched skills (foundKeywords)
 * @param {Array<{ keyword: string, type?: string }>} negatives - matched negatives (foundNegatives)
 * @returns {Array<{ start: number, end: number, kind: 'accept' | 'reject', keyword: string, mustHave?: boolean, type?: string }>}
 */
export function findHighlightRanges(text, positives = [], negatives = []) {
  if (!text || typeof text !== 'string') return [];

  const linkRanges = [];
  for (const m of text.matchAll(LINK_REGEX)) {
    linkRanges.push([m.index, m.index + m[0].length]);
  }
  const insideLink = (start, end) => linkRanges.some(([ls, le]) => start < le && end > ls);

  const candidates = [];
  const collect = (items, kind) => {
    items.forEach((item) => {
      const keyword = typeof item === 'string' ? item : item?.keyword;
      const regex = keyword ? createTokenRegex(keyword) : null;
      if (!regex) return;
      for (const m of text.matchAll(regex)) {
        if (!m[0]) continue;
        const start = m.index;
        const end = start + m[0].length;
        if (insideLink(start, end)) continue;
        candidates.push({
          start,
          end,
          kind,
          keyword,
          mustHave: Boolean(item?.mustHave),
          type: item?.type,
        });
      }
    });
  };

  collect(negatives, 'reject');
  collect(positives, 'accept');

  // Earliest first, then longest ("React Native" beats "React"); on exact ties reject wins (collected first, stable sort).
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const ranges = [];
  let cursor = 0;
  for (const c of candidates) {
    if (c.start < cursor) continue;
    ranges.push(c);
    cursor = c.end;
  }
  return ranges;
}

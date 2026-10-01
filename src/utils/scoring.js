/**
 * Utility functions for CV scoring, keyword matching, and candidate ranking.
 */

export const CATEGORY_MULTIPLIERS = {
  technical: 1.2,
  soft: 1.0,
  cert: 1.1,
};

export const CATEGORY_LABELS = {
  technical: 'Technical',
  soft: 'Soft Skill',
  cert: 'Certification',
};

/**
 * Safely escape regex special characters
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a regular expression that accurately matches tokens
 * with proper word and symbol boundaries (supporting C++, C#, .NET, Node.js, etc.)
 */
export function createTokenRegex(token) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const escaped = escapeRegex(trimmed);

  // Boundary at start: preceded by start of string, or non-alphanumeric / non-special programming token character
  const prefix = /^[a-zA-Z0-9]/.test(trimmed) ? '(?<=^|[^a-zA-Z0-9_#+])' : '';

  // Boundary at end: if token ends with alphanumeric, ensure it's not followed by another word char or #/+
  let suffix = '';
  if (/[a-zA-Z0-9]$/.test(trimmed)) {
    suffix = '(?=$|[^a-zA-Z0-9_#+])';
  } else {
    // If token ends with non-word character (e.g. C++), allow trailing whitespace, punctuation, or string end
    suffix = '(?=$|\\s|[.,;!?])';
  }

  try {
    return new RegExp(`${prefix}${escaped}${suffix}`, 'gi');
  } catch (err) {
    console.error(`Invalid regex for token "${token}":`, err);
    // Fallback to literal case-insensitive match
    return new RegExp(escaped, 'gi');
  }
}

/**
 * Calculate the score and evaluate criteria/dealbreakers for a candidate's CV text:
 * 1. Skill Coverage %: (Weighted breadth of matched skills / Total possible weight) * 100
 * 2. Depth Score: Logarithmic frequency of matched skills with category multiplier
 * 3. Combined Match Score %: 70% Coverage + 30% Normalized Depth Score
 * 4. Must-Have Skills Validation: Candidate must match all positive keywords marked as must-have
 * 5. Dealbreaker & Location Validation: Handles standard disqualifiers and Bangladeshi-only enforcement
 *
 * @param {string} text - Raw extracted CV text
 * @param {Array<{ id?: string, keyword: string, weight: number, category?: string, mustHave?: boolean }>} positiveKeywords
 * @param {Array<string | { id?: string, keyword: string, type: 'disqualifier' | 'penalty', penalty?: number }>} negativeKeywords
 * @param {{ bangladeshiOnly?: boolean, contact?: object, location?: object }} options
 */
export function calculateCandidateScore(
  text,
  positiveKeywords = [],
  negativeKeywords = [],
  options = {}
) {
  const { bangladeshiOnly = false, contact = null, location = null } = options;

  if (!text) {
    const missingMustHaves = positiveKeywords.filter((k) => k.mustHave);
    return {
      score: 0,
      scorePercent: 0,
      coveragePercent: 0,
      matchedCount: 0,
      totalPositive: positiveKeywords.length,
      mustHaveCount: missingMustHaves.length,
      matchedMustHaveCount: 0,
      missingMustHaves,
      hasMissingMustHave: missingMustHaves.length > 0,
      depthScore: 0,
      foundKeywords: [],
      foundNegatives: [],
      hasDisqualifier: false,
      disqualifiers: [],
      snippets: [],
    };
  }

  const foundKeywords = [];
  const foundNegatives = [];
  const disqualifiers = [];
  const snippets = [];
  const missingMustHaves = [];

  let totalPossibleWeight = 0;
  let matchedWeight = 0;
  let rawDepthScore = 0;
  let maxPossibleDepthScore = 0;
  let mustHaveCount = 0;
  let matchedMustHaveCount = 0;

  // 1. Process Positive Keywords & Must-Haves
  positiveKeywords.forEach((posItem) => {
    if (!posItem) return;
    const keyword = typeof posItem === 'string' ? posItem : posItem.keyword;
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) return;

    const weight = typeof posItem === 'object' && posItem.weight !== undefined ? posItem.weight : 5;
    const category = typeof posItem === 'object' && posItem.category ? posItem.category : 'soft';
    const mustHave = typeof posItem === 'object' && posItem.mustHave ? posItem.mustHave : false;

    const isMustHave = Boolean(mustHave);
    if (isMustHave) mustHaveCount++;

    const numWeight = Number(weight) || 5;
    const catMultiplier = CATEGORY_MULTIPLIERS[category] || 1.0;
    totalPossibleWeight += numWeight;

    // Baseline depth score assumes 1 solid occurrence
    maxPossibleDepthScore += numWeight * catMultiplier;

    // Build regex and check matches
    const regex = createTokenRegex(keyword);
    if (!regex) return;

    const matches = text.match(regex) || [];
    const count = matches.length;

    if (count > 0) {
      matchedWeight += numWeight;
      if (isMustHave) matchedMustHaveCount++;

      // Diminishing returns formula
      const frequencyMultiplier = 1 + 0.35 * Math.log2(count);
      const points = Math.round(numWeight * frequencyMultiplier * catMultiplier * 10) / 10;
      rawDepthScore += points;

      foundKeywords.push({
        id: typeof posItem === 'object' ? posItem.id : keyword,
        keyword,
        matches: count,
        points,
        weight: numWeight,
        category,
        mustHave: isMustHave,
      });

      // Extract representative snippet
      const firstIdx = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (firstIdx !== -1) {
        const start = Math.max(0, firstIdx - 40);
        const end = Math.min(text.length, firstIdx + keyword.length + 40);
        const snippetText = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
        snippets.push({ keyword, snippet: snippetText });
      }
    } else if (isMustHave) {
      missingMustHaves.push({
        id: typeof posItem === 'object' ? posItem.id : keyword,
        keyword,
        weight: numWeight,
        category,
        mustHave: true,
      });
    }
  });

  // 2. Process Negative Keywords / Disqualifiers
  let penaltyPoints = 0;

  negativeKeywords.forEach((negItem) => {
    if (!negItem) return;
    const keyword = typeof negItem === 'string' ? negItem : negItem.keyword;
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) return;

    const type = typeof negItem === 'object' && negItem.type ? negItem.type : 'penalty';
    const penaltyValue = typeof negItem === 'object' && negItem.penalty ? negItem.penalty : 5;

    const regex = createTokenRegex(keyword);
    if (!regex) return;

    const matches = text.match(regex) || [];
    const count = matches.length;

    if (count > 0) {
      if (type === 'disqualifier') {
        disqualifiers.push({ keyword, matches: count, type: 'disqualifier' });
      } else {
        penaltyPoints += penaltyValue * count;
      }

      foundNegatives.push({
        keyword,
        matches: count,
        type,
        penalty: penaltyValue * count,
      });
    }
  });

  // 3. Process Bangladeshi Only Dealbreaker (if active)
  if (bangladeshiOnly) {
    // Check 1: Foreign Country detected (and not Bangladesh, empty is ok)
    if (location && location.isForeign && location.country && location.country.toLowerCase() !== 'bangladesh') {
      disqualifiers.push({
        keyword: `Non-Bangladeshi Country (${location.country})`,
        matches: 1,
        type: 'dealbreaker',
        reason: 'non-bd-country',
        detail: location.displayLocation || location.country,
      });
    }

    // Check 2: Phone number check (if phone exists and has foreign phone with no BD phone)
    if (contact && contact.hasForeignPhone && !contact.hasBdPhone) {
      const foreignPhone = contact.primaryPhone?.display || 'Foreign';
      disqualifiers.push({
        keyword: `Non-BD Phone (${foreignPhone})`,
        matches: 1,
        type: 'dealbreaker',
        reason: 'non-bd-phone',
        detail: foreignPhone,
      });
    }
  }

  // 4. Compute Metrics
  const matchedCount = foundKeywords.length;
  const totalPositive = positiveKeywords.length;

  const coveragePercent = totalPossibleWeight > 0
    ? Math.round((matchedWeight / totalPossibleWeight) * 100)
    : 0;

  // Normalized Depth (capped smoothly at 100%)
  const normalizedDepth = maxPossibleDepthScore > 0
    ? Math.min(100, Math.round((rawDepthScore / maxPossibleDepthScore) * 100))
    : 0;

  // Combined score: 70% Skill Coverage Breadth + 30% Depth / Experience
  let combinedScore = totalPositive > 0
    ? Math.round(coveragePercent * 0.7 + normalizedDepth * 0.3)
    : 0;

  // Apply soft penalties
  combinedScore = Math.max(0, combinedScore - penaltyPoints);

  const hasDisqualifier = disqualifiers.length > 0;
  const hasMissingMustHave = missingMustHaves.length > 0;

  return {
    score: combinedScore,
    scorePercent: combinedScore,
    coveragePercent,
    matchedCount,
    totalPositive,
    mustHaveCount,
    matchedMustHaveCount,
    missingMustHaves,
    hasMissingMustHave,
    depthScore: Math.round(rawDepthScore * 10) / 10,
    foundKeywords,
    foundNegatives,
    hasDisqualifier,
    disqualifiers,
    snippets: snippets.slice(0, 5),
  };
}

/**
 * Smart candidate name extractor: tries the first few lines of extracted text,
 * otherwise cleans and formats the filename cleanly.
 */
export function extractCandidateName(fileName, text) {
  if (text) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length < 50);

    for (const line of lines.slice(0, 6)) {
      const lower = line.toLowerCase();
      if (
        lower.includes('@') ||
        lower.includes('http') ||
        lower.includes('github') ||
        lower.includes('linkedin') ||
        lower.includes('curriculum') ||
        lower.includes('resume') ||
        lower.includes('page ') ||
        lower.includes('phone') ||
        lower.includes('tel:') ||
        /^\+?[0-9\s-()]{7,}$/.test(line)
      ) {
        continue;
      }
      const words = line.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        words.every((w) => /^[A-Za-z][a-zA-Z.'-]*$/.test(w))
      ) {
        return line;
      }
    }
  }

  // Fallback: format filename nicely
  let clean = fileName.replace(/\.(pdf|docx|zip)$/i, '');
  clean = clean.replace(/^(cv[\s_-]+of[\s_-]+|resume[\s_-]+of[\s_-]+|cv[\s_-]+|resume[\s_-]+)/i, '');
  clean = clean.replace(/[\s_-]+(cv|resume|curriculum|vitae|developer|flutter|mobile|engineer|fullstack|frontend|backend)[\s_-]*/gi, ' ');
  clean = clean.replace(/[_-]+/g, ' ').trim();
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

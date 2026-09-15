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
 * Calculate the dual-score for a candidate's CV text:
 * 1. Skill Coverage %: (Weighted breadth of matched skills / Total possible weight) * 100
 * 2. Depth Score: Logarithmic frequency of matched skills with category multiplier
 * 3. Combined Match Score %: 70% Coverage + 30% Normalized Depth Score
 *
 * @param {string} text - Raw extracted CV text
 * @param {Array<{ keyword: string, weight: number, category?: string }>} positiveKeywords
 * @param {Array<string | { keyword: string, type: 'disqualifier' | 'penalty', penalty?: number }>} negativeKeywords
 */
export function calculateCandidateScore(text, positiveKeywords = [], negativeKeywords = []) {
  if (!text) {
    return {
      score: 0,
      scorePercent: 0,
      coveragePercent: 0,
      matchedCount: 0,
      totalPositive: positiveKeywords.length,
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

  let totalPossibleWeight = 0;
  let matchedWeight = 0;
  let rawDepthScore = 0;
  let maxPossibleDepthScore = 0;

  // 1. Process Positive Keywords
  positiveKeywords.forEach(({ keyword, weight = 5, category = 'soft' }) => {
    const numWeight = Number(weight) || 5;
    const catMultiplier = CATEGORY_MULTIPLIERS[category] || 1.0;
    totalPossibleWeight += numWeight;

    // Baseline depth score assumes 1 solid occurrence
    maxPossibleDepthScore += numWeight * catMultiplier;

    const regex = createTokenRegex(keyword);
    if (!regex) return;

    const matches = text.match(regex) || [];
    const count = matches.length;

    if (count > 0) {
      matchedWeight += numWeight;

      // Diminishing returns formula:
      // 1 match = 100% weight * multiplier
      // 2 matches = 135%
      // 4 matches = 170%
      // 8 matches = 205%
      const frequencyMultiplier = 1 + 0.35 * Math.log2(count);
      const points = Math.round(numWeight * frequencyMultiplier * catMultiplier * 10) / 10;
      rawDepthScore += points;

      foundKeywords.push({
        keyword,
        matches: count,
        points,
        weight: numWeight,
        category,
      });

      // Extract a representative snippet around the first match
      const firstIdx = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (firstIdx !== -1) {
        const start = Math.max(0, firstIdx - 40);
        const end = Math.min(text.length, firstIdx + keyword.length + 40);
        const snippetText = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
        snippets.push({ keyword, snippet: snippetText });
      }
    }
  });

  // 2. Process Negative Keywords / Disqualifiers
  let penaltyPoints = 0;

  negativeKeywords.forEach((negItem) => {
    const keyword = typeof negItem === 'string' ? negItem : negItem.keyword;
    const type = typeof negItem === 'object' && negItem.type ? negItem.type : 'penalty';
    const penaltyValue = typeof negItem === 'object' && negItem.penalty ? negItem.penalty : 5;

    const regex = createTokenRegex(keyword);
    if (!regex) return;

    const matches = text.match(regex) || [];
    const count = matches.length;

    if (count > 0) {
      if (type === 'disqualifier') {
        disqualifiers.push({ keyword, matches: count });
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

  // 3. Compute Metrics
  const matchedCount = foundKeywords.length;
  const totalPositive = positiveKeywords.length;

  const coveragePercent = totalPossibleWeight > 0
    ? Math.round((matchedWeight / totalPossibleWeight) * 100)
    : (totalPositive === 0 ? 100 : 0);

  // Normalized Depth (capped smoothly at 100% to avoid single-keyword ballooning)
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

  return {
    score: combinedScore,
    scorePercent: combinedScore,
    coveragePercent,
    matchedCount,
    totalPositive,
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
  clean = clean.replace(/[_-]+/g, ' ').trim();
  return clean
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

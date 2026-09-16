/**
 * Experience Level & Years Detector
 * Section-aware & academic-filtered engine that strictly ignores university,
 * college, degree, and study years when calculating professional experience.
 */

// Seniority title definitions (evaluated with contextual awareness)
const LEAD_TITLE_REGEX = /\b(?:lead|principal|staff\s+engineer|architect|head\s+of|engineering\s+manager|cto|vp\s+of\s+engineering|tech\s+lead)\b/i;
const SENIOR_TITLE_REGEX = /\b(?:senior|sr\.?|module\s+lead|expert)\b/i;
const JUNIOR_TITLE_REGEX = /\b(?:junior|jr\.?|associate|entry[- ]level|graduate\s+engineer|fresher|trainee|intern|internship)\b/i;
const MID_TITLE_REGEX = /\b(?:mid[- ]level|intermediate|software\s+engineer|developer|mobile\s+developer|frontend\s+engineer|backend\s+engineer|full[- ]stack\s+engineer)\b/i;

// Regex for explicit professional experience statements: e.g. "6+ years of professional experience", "over 4.5 yrs exp in software industry"
const EXPLICIT_EXP_REGEX = /(?:over|more\s+than|around|approx(?:\.|\s+)?|nearly)?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:experience|exp|working|industry|professional|hands-on|development|commercial|software\s+engineering))?/gi;

// Regex for calendar year ranges: "2018 - 2022", "2020 to Present", "Jan 2019 – Current", "05/2021 - Now"
const YEAR_SPAN_REGEX = /\b((?:19|20)\d{2})\b\s*(?:[-–—to/]|until)\s*\b((?:19|20)\d{2}|present|current|now)\b/gi;

// Academic / Study context markers to strictly ignore
const ACADEMIC_KEYWORDS_REGEX = /\b(?:education|academic|b\.?sc|m\.?sc|bachelor|master|ph\.?d|hsc|ssc|diploma|o[- ]level|a[- ]level|university|college|school|institute|cgpa|gpa|major|faculty|semester|undergraduate|postgraduate|curriculum|matriculation|alumnus|degree|varsity|dept\.?|department\s+of|curriculum\s+vitae|syllabus)\b/i;

// Employment section headers
const EMPLOYMENT_SECTION_HEADER_REGEX = /^(?:experience|work\s+experience|employment\s+history|professional\s+experience|work\s+history|career\s+history|job\s+experience|employment|work)/i;
const EDUCATION_SECTION_HEADER_REGEX = /^(?:education|academic\s+background|academic\s+qualifications|educational\s+qualifications|academics|educational\s+background|degrees|academic\s+history)/i;

/**
 * Split text into semantic sections: 'work', 'education', 'summary', 'other'
 */
function splitCvSections(text) {
  const lines = text.split('\n');
  const sections = {
    work: '',
    education: '',
    summary: '',
    other: '',
  };

  let currentSection = 'summary';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headers
    if (EMPLOYMENT_SECTION_HEADER_REGEX.test(trimmed)) {
      currentSection = 'work';
      continue;
    }
    if (EDUCATION_SECTION_HEADER_REGEX.test(trimmed)) {
      currentSection = 'education';
      continue;
    }
    if (/^(?:skills|technical\s+skills|projects|achievements|certifications|languages|references)/i.test(trimmed)) {
      currentSection = 'other';
      continue;
    }

    sections[currentSection] += line + '\n';
  }

  return sections;
}

/**
 * Checks if a context snippet around a date match is purely educational / academic
 */
function isAcademicContext(lineContext) {
  if (!lineContext) return false;
  return ACADEMIC_KEYWORDS_REGEX.test(lineContext);
}

/**
 * Merges overlapping or contiguous year intervals to accurately count unique career duration
 */
function calculateIntervalsTotalYears(intervals, currentYear) {
  if (!intervals || intervals.length === 0) return 0;

  // Sort intervals by start year ascending
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];

  let current = { start: sorted[0].start, end: sorted[0].end };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { start: next.start, end: next.end };
    }
  }
  merged.push(current);

  // Sum up unique years
  let total = 0;
  for (const span of merged) {
    const diff = Math.max(0.5, span.end - span.start);
    total += diff;
  }

  return Math.round(total * 10) / 10;
}

/**
 * Detects professional experience years, seniority level, and extracts verified proof snippets.
 * Strictly ignores university and academic years.
 */
export function detectExperienceLevel(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      level: 'Not Specified',
      badgeLabel: 'Exp: N/A',
      years: null,
      yearsDisplay: 'N/A',
      confidence: 'low',
      sourceSnippet: null,
      method: 'none',
      color: 'slate',
    };
  }

  const currentYear = new Date().getFullYear();
  const sections = splitCvSections(text);

  let detectedYears = null;
  let detectedSource = null;
  let method = 'none';
  let confidence = 'low';

  // 1. Check for Explicit Work Experience Statements in Summary & Work sections (Avoid Education section)
  const nonAcademicText = `${sections.summary}\n${sections.work}`;
  let expMatch;
  const expRegex = new RegExp(EXPLICIT_EXP_REGEX.source, 'gi');
  let highestExplicitYears = 0;
  let bestExplicitSnippet = null;

  while ((expMatch = expRegex.exec(nonAcademicText)) !== null) {
    const start = Math.max(0, expMatch.index - 35);
    const end = Math.min(nonAcademicText.length, expMatch.index + expMatch[0].length + 45);
    const snippet = nonAcademicText.substring(start, end).replace(/\s+/g, ' ').trim();

    // Ensure statement is not referring to academic degrees (e.g. "4 years of B.Sc" or "3 years in University")
    if (!isAcademicContext(snippet)) {
      const val = parseFloat(expMatch[1]);
      if (val >= 0.5 && val <= 35) {
        if (val > highestExplicitYears) {
          highestExplicitYears = val;
          bestExplicitSnippet = (start > 0 ? '...' : '') + snippet + (end < nonAcademicText.length ? '...' : '');
        }
      }
    }
  }

  if (highestExplicitYears > 0) {
    detectedYears = highestExplicitYears;
    detectedSource = bestExplicitSnippet;
    method = 'explicit_statement';
    confidence = 'high';
  }

  // 2. Fallback: Parse Employment Year Spans ONLY from Work History (strictly excluding Education section & academic lines)
  if (!detectedYears) {
    const lines = text.split('\n');
    let insideEducationSection = false;
    const validIntervals = [];
    let firstSpanSnippet = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      if (EDUCATION_SECTION_HEADER_REGEX.test(trimmed)) {
        insideEducationSection = true;
        continue;
      }
      if (EMPLOYMENT_SECTION_HEADER_REGEX.test(trimmed)) {
        insideEducationSection = false;
        continue;
      }
      if (/^(?:skills|projects|achievements|certifications|languages|references|personal|summary)/i.test(trimmed)) {
        insideEducationSection = false;
      }

      // If we are currently inside the Education section, skip all date lines completely!
      if (insideEducationSection) {
        continue;
      }

      // Check context around this line (previous line, current line, next line)
      const prevLine = lines[lineIndex - 1] || '';
      const nextLine = lines[lineIndex + 1] || '';
      const fullContext = `${prevLine} ${line} ${nextLine}`;

      // If this specific line mentions academic terms (e.g. "B.Sc in CSE, 2018 - 2022"), skip it!
      if (isAcademicContext(fullContext)) {
        continue;
      }

      // Scan for year ranges on this valid work/employment line
      let match;
      const yearRegex = new RegExp(YEAR_SPAN_REGEX.source, 'gi');
      while ((match = yearRegex.exec(line)) !== null) {
        const startY = parseInt(match[1], 10);
        const endStr = match[2].toLowerCase();
        const endY = (endStr === 'present' || endStr === 'current' || endStr === 'now')
          ? currentYear
          : parseInt(endStr, 10);

        // Sanity check: work dates should be sensible career ranges
        if (startY >= 1995 && startY <= currentYear && endY >= startY && endY <= currentYear) {
          validIntervals.push({ start: startY, end: endY });

          if (!firstSpanSnippet) {
            firstSpanSnippet = `${trimmed}`;
          }
        }
      }
    }

    if (validIntervals.length > 0) {
      const totalYears = calculateIntervalsTotalYears(validIntervals, currentYear);
      if (totalYears > 0 && totalYears <= 35) {
        detectedYears = totalYears;
        detectedSource = `Work history timeline: ~${totalYears} ${totalYears === 1 ? 'yr' : 'yrs'} (${firstSpanSnippet || 'parsed from job roles'})`;
        method = 'work_history_dates';
        confidence = validIntervals.length >= 2 ? 'medium' : 'low';
      }
    }
  }

  // 3. Scan for Seniority Role Titles across the whole CV
  const isJuniorOrFresher = JUNIOR_TITLE_REGEX.test(text);
  const isLead = LEAD_TITLE_REGEX.test(text);
  const isSenior = SENIOR_TITLE_REGEX.test(text);
  const isMid = MID_TITLE_REGEX.test(text);

  // 4. Map Years & Titles to Standard Level & Badges
  let level = 'Mid-Level';
  let badgeLabel = 'Mid-Level';
  let color = 'indigo';

  if (detectedYears !== null) {
    if (detectedYears >= 8 || (isLead && detectedYears >= 6)) {
      level = 'Lead / Principal';
      badgeLabel = `${detectedYears}+ yrs (Lead)`;
      color = 'purple';
    } else if (detectedYears >= 5 || (isSenior && detectedYears >= 4)) {
      level = 'Senior';
      badgeLabel = `${detectedYears}+ yrs (Senior)`;
      color = 'emerald';
    } else if (detectedYears >= 2 && !isJuniorOrFresher) {
      level = 'Mid-Level';
      badgeLabel = `${detectedYears} yrs (Mid)`;
      color = 'indigo';
    } else if (detectedYears >= 0.5 || isJuniorOrFresher) {
      level = 'Junior';
      badgeLabel = `${detectedYears} yr (Junior)`;
      color = 'amber';
    } else {
      level = 'Intern';
      badgeLabel = 'Intern / Entry';
      color = 'sky';
    }
  } else {
    // If no work years could be calculated
    if (isJuniorOrFresher) {
      level = 'Junior';
      badgeLabel = 'Junior / Fresher';
      color = 'amber';
      detectedSource = 'Title match: Junior / Fresher in CV text';
      method = 'title_keyword';
      confidence = 'medium';
    } else if (isLead) {
      level = 'Lead / Principal';
      badgeLabel = 'Lead (8+ yrs)';
      color = 'purple';
      detectedSource = 'Seniority title match: "Lead / Principal" in CV text';
      method = 'title_keyword';
      confidence = 'medium';
    } else if (isSenior) {
      level = 'Senior';
      badgeLabel = 'Senior (5+ yrs)';
      color = 'emerald';
      detectedSource = 'Seniority title match: "Senior" in CV text';
      method = 'title_keyword';
      confidence = 'medium';
    } else if (isMid) {
      level = 'Mid-Level';
      badgeLabel = 'Mid-Level';
      color = 'indigo';
      detectedSource = 'Title match: Software Engineer in CV text';
      method = 'title_keyword';
      confidence = 'low';
    } else {
      level = 'Not Specified';
      badgeLabel = 'Exp: N/A';
      color = 'slate';
      confidence = 'low';
    }
  }

  return {
    level,
    badgeLabel,
    years: detectedYears,
    yearsDisplay: detectedYears ? `${detectedYears} ${detectedYears === 1 ? 'year' : 'years'}` : 'N/A',
    confidence,
    sourceSnippet: detectedSource,
    method,
    color,
  };
}

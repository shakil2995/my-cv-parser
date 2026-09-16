/**
 * Contact Details Extractor
 * Highly specialized for Bangladeshi phone numbers (+880, 013-019), standard international formats, and emails.
 */

// Bangladeshi Mobile Operators:
// 013, 017: Grameenphone
// 014, 019: Banglalink
// 015: Teletalk
// 016, 018: Robi / Airtel
const BD_PHONE_REGEX = /(?:\+?880\s*|880\s*|0)?1[3-9]\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g;

// Standard International phone regex (as secondary fallback if prefixed by phone context)
const CONTEXTUAL_PHONE_REGEX = /(?:phone|tel|mobile|cell|contact|hotline|call)[:\s]+(\+?[0-9\s\-().]{8,20})/gi;

// Clean Email Regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Format a raw Bangladeshi number into standard "+880 1XXX-XXXXXX" and "01XXX-XXXXXX"
 */
export function formatBangladeshiPhone(rawNumber) {
  if (!rawNumber) return null;

  // Extract only the digits
  const digits = rawNumber.replace(/\D/g, '');

  let localDigits = '';
  if (digits.startsWith('880') && digits.length >= 13) {
    localDigits = digits.slice(2); // '01XXXXXXXXX'
  } else if (digits.startsWith('88') && digits.length >= 12) {
    localDigits = '0' + digits.slice(2);
  } else if (digits.startsWith('01') && digits.length === 11) {
    localDigits = digits;
  } else if (digits.startsWith('1') && digits.length === 10) {
    localDigits = '0' + digits;
  } else {
    // Return original cleaned if not matching standard BD length
    return {
      display: rawNumber.trim(),
      raw: digits,
      whatsappUrl: `https://wa.me/${digits}`,
      telUrl: `tel:${rawNumber.trim()}`,
      operator: 'Other',
    };
  }

  // Operator lookup
  const prefix = localDigits.substring(0, 3);
  let operator = 'Mobile';
  if (prefix === '017' || prefix === '013') operator = 'Grameenphone';
  else if (prefix === '018' || prefix === '016') operator = 'Robi / Airtel';
  else if (prefix === '019' || prefix === '014') operator = 'Banglalink';
  else if (prefix === '015') operator = 'Teletalk';

  // Format: "01712-345678" or "+880 1712-345678"
  const formattedLocal = `${localDigits.slice(0, 5)}-${localDigits.slice(5)}`;
  const formattedInternational = `+880 ${localDigits.slice(1, 5)}-${localDigits.slice(5)}`;
  const cleanIntlDigits = `880${localDigits.slice(1)}`;

  return {
    display: formattedInternational,
    localDisplay: formattedLocal,
    raw: localDigits,
    intlDigits: cleanIntlDigits,
    whatsappUrl: `https://wa.me/${cleanIntlDigits}`,
    telUrl: `tel:+${cleanIntlDigits}`,
    operator,
    isBangladeshi: true,
  };
}

/**
 * Extract all contact details (Email, BD Phone, WhatsApp) from CV text and annotations
 */
export function extractContactDetails(text = '', annotations = []) {
  if (!text && (!annotations || annotations.length === 0)) {
    return {
      emails: [],
      primaryEmail: null,
      phones: [],
      primaryPhone: null,
    };
  }

  const foundEmails = new Set();
  const foundPhones = new Map(); // phone raw digits -> phone object

  // 1. Check annotations for mailto links
  if (Array.isArray(annotations)) {
    for (const ann of annotations) {
      const url = typeof ann === 'string' ? ann : (ann?.url || '');
      if (url.toLowerCase().startsWith('mailto:')) {
        const email = url.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
        if (email.includes('@')) foundEmails.add(email);
      }
    }
  }

  // 2. Extract emails from text
  const emailMatches = (text.match(EMAIL_REGEX) || []);
  for (const match of emailMatches) {
    const cleaned = match.toLowerCase().trim().replace(/[.,;)]+$/, '');
    if (cleaned.length >= 5 && !cleaned.endsWith('.png') && !cleaned.endsWith('.jpg')) {
      foundEmails.add(cleaned);
    }
  }

  // 3. Extract Bangladeshi phone numbers
  const bdMatches = (text.match(BD_PHONE_REGEX) || []);
  for (const match of bdMatches) {
    const formatted = formatBangladeshiPhone(match);
    if (formatted && formatted.raw && formatted.raw.length >= 10) {
      foundPhones.set(formatted.raw, formatted);
    }
  }

  // 4. Secondary fallback: Contextual phone matches (if no BD phone was found)
  if (foundPhones.size === 0) {
    let match;
    const ctxRegex = new RegExp(CONTEXTUAL_PHONE_REGEX.source, 'gi');
    while ((match = ctxRegex.exec(text)) !== null) {
      const candidateNumber = match[1].trim();
      const digits = candidateNumber.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        const formatted = formatBangladeshiPhone(candidateNumber);
        if (formatted) foundPhones.set(digits, formatted);
      }
    }
  }

  const emailList = Array.from(foundEmails);
  const phoneList = Array.from(foundPhones.values());

  return {
    emails: emailList,
    primaryEmail: emailList[0] || null,
    phones: phoneList,
    primaryPhone: phoneList[0] || null,
  };
}

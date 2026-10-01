/**
 * Contact Details Extractor
 * Highly specialized for Bangladeshi phone numbers (+880, 013-019), international formats, and emails.
 */

// Bangladeshi Mobile Operators:
// 013, 017: Grameenphone
// 014, 019: Banglalink
// 015: Teletalk
// 016, 018: Robi / Airtel
const BD_PHONE_REGEX = /(?:\+?880\s*|880\s*|0)?1[3-9]\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g;

// Standard International phone regex starting with + or 00
const INTL_PHONE_REGEX = /(?:\+|00)(?:[1-9]\d{0,3})[-\s]?(?:\(?\d{1,4}\)?[\s.-]?)?\d{3,4}[-\s]?\d{3,4}\b/g;

// Standard International phone regex (as fallback if prefixed by phone context)
const CONTEXTUAL_PHONE_REGEX = /(?:phone|tel|mobile|cell|contact|hotline|call|whatsapp)[:\s]+(\+?[0-9\s\-().]{8,20})/gi;

// Clean Email Regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Format a raw phone number into standard display, detecting Bangladeshi vs International
 */
export function formatPhoneNumber(rawNumber) {
  if (!rawNumber) return null;

  const trimmed = rawNumber.trim();
  const digits = trimmed.replace(/\D/g, '');

  // 1. Check if it's Bangladeshi
  let bdLocalDigits = '';
  if (digits.startsWith('880') && digits.length >= 13) {
    bdLocalDigits = digits.slice(2); // '01XXXXXXXXX'
  } else if (digits.startsWith('88') && digits.length >= 12) {
    bdLocalDigits = '0' + digits.slice(2);
  } else if (digits.startsWith('01') && digits.length === 11) {
    bdLocalDigits = digits;
  } else if (digits.startsWith('1') && digits.length === 10) {
    bdLocalDigits = '0' + digits;
  }

  if (bdLocalDigits && /^01[3-9]\d{8}$/.test(bdLocalDigits)) {
    const prefix = bdLocalDigits.substring(0, 3);
    let operator = 'Mobile';
    if (prefix === '017' || prefix === '013') operator = 'Grameenphone';
    else if (prefix === '018' || prefix === '016') operator = 'Robi / Airtel';
    else if (prefix === '019' || prefix === '014') operator = 'Banglalink';
    else if (prefix === '015') operator = 'Teletalk';

    const formattedLocal = `${bdLocalDigits.slice(0, 5)}-${bdLocalDigits.slice(5)}`;
    const formattedInternational = `+880 ${bdLocalDigits.slice(1, 5)}-${bdLocalDigits.slice(5)}`;
    const cleanIntlDigits = `880${bdLocalDigits.slice(1)}`;

    return {
      display: formattedInternational,
      localDisplay: formattedLocal,
      raw: bdLocalDigits,
      intlDigits: cleanIntlDigits,
      whatsappUrl: `https://wa.me/${cleanIntlDigits}`,
      telUrl: `tel:+${cleanIntlDigits}`,
      operator,
      isBangladeshi: true,
      country: 'Bangladesh',
    };
  }

  // 2. International Phone Number
  if (digits.length >= 7 && digits.length <= 16) {
    let intlDisplay = trimmed;
    if (!intlDisplay.startsWith('+') && (digits.startsWith('1') || digits.startsWith('91') || digits.startsWith('44') || digits.startsWith('92') || digits.startsWith('234') || digits.startsWith('971'))) {
      intlDisplay = `+${digits}`;
    }

    let detectedCountry = 'International';
    if (digits.startsWith('91') || trimmed.startsWith('+91')) detectedCountry = 'India';
    else if (digits.startsWith('92') || trimmed.startsWith('+92')) detectedCountry = 'Pakistan';
    else if (digits.startsWith('1') || trimmed.startsWith('+1')) detectedCountry = 'US/Canada';
    else if (digits.startsWith('44') || trimmed.startsWith('+44')) detectedCountry = 'United Kingdom';
    else if (digits.startsWith('234') || trimmed.startsWith('+234')) detectedCountry = 'Nigeria';
    else if (digits.startsWith('971') || trimmed.startsWith('+971')) detectedCountry = 'UAE';
    else if (digits.startsWith('60') || trimmed.startsWith('+60')) detectedCountry = 'Malaysia';
    else if (digits.startsWith('65') || trimmed.startsWith('+65')) detectedCountry = 'Singapore';
    else if (digits.startsWith('49') || trimmed.startsWith('+49')) detectedCountry = 'Germany';

    return {
      display: intlDisplay,
      localDisplay: trimmed,
      raw: digits,
      intlDigits: digits,
      whatsappUrl: `https://wa.me/${digits}`,
      telUrl: `tel:${intlDisplay.startsWith('+') ? intlDisplay : `+${digits}`}`,
      operator: detectedCountry,
      isBangladeshi: false,
      country: detectedCountry,
    };
  }

  return null;
}

// Keep backward compatibility
export const formatBangladeshiPhone = formatPhoneNumber;

/**
 * Extract all contact details (Email, BD Phone, Intl Phone, WhatsApp) from CV text and annotations
 */
export function extractContactDetails(text = '', annotations = []) {
  if (!text && (!annotations || annotations.length === 0)) {
    return {
      emails: [],
      primaryEmail: null,
      phones: [],
      primaryPhone: null,
      hasBdPhone: false,
      hasForeignPhone: false,
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
    const formatted = formatPhoneNumber(match);
    if (formatted && formatted.raw && formatted.raw.length >= 10 && formatted.isBangladeshi) {
      foundPhones.set(formatted.raw, formatted);
    }
  }

  // 4. Extract International phone numbers starting with + or 00
  const intlMatches = (text.match(INTL_PHONE_REGEX) || []);
  for (const match of intlMatches) {
    const formatted = formatPhoneNumber(match);
    if (formatted && formatted.raw && !foundPhones.has(formatted.raw)) {
      foundPhones.set(formatted.raw, formatted);
    }
  }

  // 5. Contextual phone matches (e.g., "Phone: ...")
  let match;
  const ctxRegex = new RegExp(CONTEXTUAL_PHONE_REGEX.source, 'gi');
  while ((match = ctxRegex.exec(text)) !== null) {
    const candidateNumber = match[1].trim();
    const formatted = formatPhoneNumber(candidateNumber);
    if (formatted && formatted.raw && !foundPhones.has(formatted.raw)) {
      foundPhones.set(formatted.raw, formatted);
    }
  }

  const emailList = Array.from(foundEmails);
  const phoneList = Array.from(foundPhones.values());

  const hasBdPhone = phoneList.some((p) => p.isBangladeshi);
  const hasForeignPhone = phoneList.some((p) => !p.isBangladeshi);

  return {
    emails: emailList,
    primaryEmail: emailList[0] || null,
    phones: phoneList,
    primaryPhone: phoneList[0] || null,
    hasBdPhone,
    hasForeignPhone,
  };
}

/**
 * Location & Country Extractor
 * Identifies candidate residence, country, and city from resume header / contact text.
 * Distinguishes Bangladeshi locations from foreign countries and cities.
 */

// Major Bangladeshi divisions, districts, and key metro areas
const BD_CITIES_AND_REGIONS = [
  'dhaka', 'chattogram', 'chittagong', 'sylhet', 'rajshahi', 'khulna',
  'barishal', 'barisal', 'rangpur', 'mymensingh', 'cumilla', 'comilla',
  'gazipur', 'narayanganj', 'cox\'s bazar', 'coxs bazar', 'bogra', 'bogura',
  'jessore', 'jashore', 'dinajpur', 'tangail', 'brahmanbaria', 'feni',
  'noakhali', 'pabna', 'kushtia', 'faridpur', 'sirajganj', 'manikganj',
  'munshiganj', 'narsingdi', 'savar', 'tongi', 'keraniganj',
  // Key Dhaka neighborhoods commonly written on CVs
  'uttara', 'mirpur', 'gulshan', 'banani', 'dhanmondi', 'mohammadpur',
  'mohakhali', 'bashundhara', 'motijheel', 'badda', 'rampura', 'khilgaon',
  'tejgaon', 'lalbagh', 'malibagh', 'shantinagar', 'nikunja', 'baridhara'
];

// Foreign Country Names & Standard Abbreviations
const FOREIGN_COUNTRIES = [
  { name: 'India', aliases: ['india', 'in', 'bharat'] },
  { name: 'Pakistan', aliases: ['pakistan', 'pk'] },
  { name: 'United States', aliases: ['united states', 'united states of america', 'usa', 'u.s.a.', 'u.s.'] },
  { name: 'United Kingdom', aliases: ['united kingdom', 'uk', 'u.k.', 'great britain', 'england', 'scotland', 'wales'] },
  { name: 'Canada', aliases: ['canada', 'ca'] },
  { name: 'Germany', aliases: ['germany', 'deutschland', 'de'] },
  { name: 'Australia', aliases: ['australia', 'au'] },
  { name: 'United Arab Emirates', aliases: ['united arab emirates', 'uae', 'u.a.e.', 'dubai', 'abu dhabi', 'sharjah'] },
  { name: 'Saudi Arabia', aliases: ['saudi arabia', 'ksa', 'k.s.a.'] },
  { name: 'Qatar', aliases: ['qatar'] },
  { name: 'Kuwait', aliases: ['kuwait'] },
  { name: 'Oman', aliases: ['oman'] },
  { name: 'Bahrain', aliases: ['bahrain'] },
  { name: 'Singapore', aliases: ['singapore', 'sg'] },
  { name: 'Malaysia', aliases: ['malaysia', 'my'] },
  { name: 'Nigeria', aliases: ['nigeria', 'ng'] },
  { name: 'Philippines', aliases: ['philippines', 'ph'] },
  { name: 'Egypt', aliases: ['egypt', 'eg'] },
  { name: 'Kenya', aliases: ['kenya'] },
  { name: 'South Africa', aliases: ['south africa', 'za'] },
  { name: 'Sri Lanka', aliases: ['sri lanka', 'lk'] },
  { name: 'Nepal', aliases: ['nepal', 'np'] },
  { name: 'Indonesia', aliases: ['indonesia', 'id'] },
  { name: 'Vietnam', aliases: ['vietnam', 'vn'] },
  { name: 'Turkey', aliases: ['turkey', 'tr', 'turkiye'] },
  { name: 'France', aliases: ['france', 'fr'] },
  { name: 'Netherlands', aliases: ['netherlands', 'holland', 'nl'] },
  { name: 'Spain', aliases: ['spain', 'es'] },
  { name: 'Italy', aliases: ['italy', 'it'] },
  { name: 'Poland', aliases: ['poland', 'pl'] },
  { name: 'Sweden', aliases: ['sweden', 'se'] },
  { name: 'Switzerland', aliases: ['switzerland', 'ch'] },
  { name: 'Ireland', aliases: ['ireland', 'ie'] },
  { name: 'New Zealand', aliases: ['new zealand', 'nz'] },
  { name: 'Brazil', aliases: ['brazil', 'brasil', 'br'] },
  { name: 'Russia', aliases: ['russia', 'ru'] },
  { name: 'Ukraine', aliases: ['ukraine', 'ua'] },
  { name: 'China', aliases: ['china', 'cn'] },
  { name: 'Japan', aliases: ['japan', 'jp'] },
  { name: 'South Korea', aliases: ['south korea', 'korea', 'kr'] },
  { name: 'Ghana', aliases: ['ghana'] },
  { name: 'Uganda', aliases: ['uganda'] },
  { name: 'Mexico', aliases: ['mexico', 'mx'] },
  { name: 'Argentina', aliases: ['argentina', 'ar'] },
  { name: 'Colombia', aliases: ['colombia', 'co'] },
];

// Foreign Tech Hubs & Major Cities
const FOREIGN_MAJOR_CITIES = [
  // India
  { city: 'Bangalore', country: 'India', aliases: ['bangalore', 'bengaluru'] },
  { city: 'Mumbai', country: 'India', aliases: ['mumbai', 'bombay'] },
  { city: 'Delhi', country: 'India', aliases: ['delhi', 'new delhi', 'noida', 'gurgaon', 'gurugram'] },
  { city: 'Hyderabad', country: 'India', aliases: ['hyderabad', 'secunderabad'] },
  { city: 'Pune', country: 'India', aliases: ['pune'] },
  { city: 'Chennai', country: 'India', aliases: ['chennai', 'madras'] },
  { city: 'Kolkata', country: 'India', aliases: ['kolkata', 'calcutta'] },
  { city: 'Ahmedabad', country: 'India', aliases: ['ahmedabad'] },
  { city: 'Jaipur', country: 'India', aliases: ['jaipur'] },
  { city: 'Kochi', country: 'India', aliases: ['kochi', 'cochin', 'trivandrum', 'thiruvananthapuram'] },
  { city: 'Indore', country: 'India', aliases: ['indore'] },
  { city: 'Chandigarh', country: 'India', aliases: ['chandigarh'] },
  // Pakistan
  { city: 'Lahore', country: 'India', aliases: ['lahore'] },
  { city: 'Karachi', country: 'Pakistan', aliases: ['karachi'] },
  { city: 'Islamabad', country: 'Pakistan', aliases: ['islamabad', 'rawalpindi'] },
  { city: 'Faisalabad', country: 'Pakistan', aliases: ['faisalabad'] },
  // Nigeria
  { city: 'Lagos', country: 'Nigeria', aliases: ['lagos'] },
  { city: 'Abuja', country: 'Nigeria', aliases: ['abuja'] },
  { city: 'Ibadan', country: 'Nigeria', aliases: ['ibadan'] },
  // US / Canada
  { city: 'New York', country: 'United States', aliases: ['new york', 'nyc', 'brooklyn', 'manhattan'] },
  { city: 'San Francisco', country: 'United States', aliases: ['san francisco', 'sf bay area', 'silicon valley', 'san jose'] },
  { city: 'Seattle', country: 'United States', aliases: ['seattle'] },
  { city: 'Austin', country: 'United States', aliases: ['austin'] },
  { city: 'Chicago', country: 'United States', aliases: ['chicago'] },
  { city: 'Los Angeles', country: 'United States', aliases: ['los angeles', 'la'] },
  { city: 'Toronto', country: 'Canada', aliases: ['toronto'] },
  { city: 'Vancouver', country: 'Canada', aliases: ['vancouver'] },
  { city: 'Montreal', country: 'Canada', aliases: ['montreal'] },
  // UK / Europe
  { city: 'London', country: 'United Kingdom', aliases: ['london'] },
  { city: 'Manchester', country: 'United Kingdom', aliases: ['manchester'] },
  { city: 'Berlin', country: 'Germany', aliases: ['berlin', 'munich', 'frankfurt'] },
  { city: 'Paris', country: 'France', aliases: ['paris'] },
  { city: 'Amsterdam', country: 'Netherlands', aliases: ['amsterdam'] },
  { city: 'Dublin', country: 'Ireland', aliases: ['dublin'] },
  // Middle East & Asia
  { city: 'Dubai', country: 'United Arab Emirates', aliases: ['dubai'] },
  { city: 'Riyadh', country: 'Saudi Arabia', aliases: ['riyadh', 'jeddah'] },
  { city: 'Cairo', country: 'Egypt', aliases: ['cairo', 'alexandria'] },
  { city: 'Nairobi', country: 'Kenya', aliases: ['nairobi'] },
  { city: 'Kuala Lumpur', country: 'Malaysia', aliases: ['kuala lumpur', 'kl'] },
  { city: 'Jakarta', country: 'Indonesia', aliases: ['jakarta'] },
  { city: 'Manila', country: 'Philippines', aliases: ['manila'] },
];

// Foreign Nationalities
const FOREIGN_NATIONALITIES = [
  { nationality: 'Indian', country: 'India' },
  { nationality: 'Pakistani', country: 'Pakistan' },
  { nationality: 'Nigerian', country: 'Nigeria' },
  { nationality: 'American', country: 'United States' },
  { nationality: 'British', country: 'United Kingdom' },
  { nationality: 'Canadian', country: 'Canada' },
  { nationality: 'German', country: 'Germany' },
  { nationality: 'Australian', country: 'Australia' },
  { nationality: 'Emirati', country: 'United Arab Emirates' },
  { nationality: 'Singaporean', country: 'Singapore' },
  { nationality: 'Malaysian', country: 'Malaysia' },
  { nationality: 'Filipino', country: 'Philippines' },
  { nationality: 'Egyptian', country: 'Egypt' },
  { nationality: 'Kenyan', country: 'Kenya' },
  { nationality: 'Sri Lankan', country: 'Sri Lanka' },
  { nationality: 'Nepalese', country: 'Nepal' },
];

/**
 * Safely escape regex tokens
 */
function escapeReg(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract location details and country from CV text
 * @param {string} text - Full raw CV text
 * @returns {{
 *   country: string | null,
 *   city: string | null,
 *   displayLocation: string | null,
 *   isBangladesh: boolean,
 *   isForeign: boolean,
 *   sourceSnippet: string | null
 * }}
 */
export function extractLocationDetails(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      country: null,
      city: null,
      displayLocation: null,
      isBangladesh: false,
      isForeign: false,
      sourceSnippet: null,
    };
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Focus primarily on the header / contact section (first 40 lines)
  const headerLines = lines.slice(0, 45);
  const headerText = headerLines.join('\n');

  // 1. Explicit Location / Address labels in text (e.g. "Location: Dhaka, Bangladesh", "Address: Bangalore, India")
  const locationLabelRegex = /(?:location|address|residence|present address|permanent address|living in|based in|current location|city|country|nationality)[:\s]+([^\n\r;]{3,60})/gi;
  let labelMatch;
  const labeledSnippets = [];

  while ((labelMatch = locationLabelRegex.exec(headerText)) !== null) {
    if (labelMatch[1]) {
      labeledSnippets.push(labelMatch[1].trim());
    }
  }

  // Also check full text if nothing found in top 45 lines
  if (labeledSnippets.length === 0) {
    while ((labelMatch = locationLabelRegex.exec(text)) !== null) {
      if (labelMatch[1]) {
        labeledSnippets.push(labelMatch[1].trim());
      }
    }
  }

  // Check labeled snippets first
  for (const snippet of labeledSnippets) {
    const lowerSnip = snippet.toLowerCase();

    // Check Bangladeshi markers in label
    if (lowerSnip.includes('bangladesh') || lowerSnip.includes('bangladeshi')) {
      const city = BD_CITIES_AND_REGIONS.find((c) => lowerSnip.includes(c));
      const formattedCity = city ? city.charAt(0).toUpperCase() + city.slice(1) : 'Dhaka';
      return {
        country: 'Bangladesh',
        city: formattedCity,
        displayLocation: city ? `${formattedCity}, Bangladesh` : 'Bangladesh',
        isBangladesh: true,
        isForeign: false,
        sourceSnippet: snippet,
      };
    }

    for (const bdCity of BD_CITIES_AND_REGIONS) {
      const reg = new RegExp(`\\b${escapeReg(bdCity)}\\b`, 'i');
      if (reg.test(lowerSnip)) {
        const formattedCity = bdCity.charAt(0).toUpperCase() + bdCity.slice(1);
        return {
          country: 'Bangladesh',
          city: formattedCity,
          displayLocation: `${formattedCity}, Bangladesh`,
          isBangladesh: true,
          isForeign: false,
          sourceSnippet: snippet,
        };
      }
    }

    // Check foreign countries in labeled snippet
    for (const fc of FOREIGN_COUNTRIES) {
      for (const alias of fc.aliases) {
        const reg = new RegExp(`\\b${escapeReg(alias)}\\b`, 'i');
        if (reg.test(lowerSnip)) {
          return {
            country: fc.name,
            city: null,
            displayLocation: fc.name,
            isBangladesh: false,
            isForeign: true,
            sourceSnippet: snippet,
          };
        }
      }
    }

    // Check foreign cities in labeled snippet
    for (const fCity of FOREIGN_MAJOR_CITIES) {
      for (const alias of fCity.aliases) {
        const reg = new RegExp(`\\b${escapeReg(alias)}\\b`, 'i');
        if (reg.test(lowerSnip)) {
          return {
            country: fCity.country,
            city: fCity.city,
            displayLocation: `${fCity.city}, ${fCity.country}`,
            isBangladesh: false,
            isForeign: true,
            sourceSnippet: snippet,
          };
        }
      }
    }
  }

  // 2. Scan Header Lines directly for Bangladesh markers
  const headerLower = headerText.toLowerCase();

  // Explicit Bangladesh mention in header
  if (/\b(?:bangladesh|bangladeshi|dhaka|chattogram|chittagong|sylhet|rajshahi|khulna|barishal|barisal|rangpur|mymensingh)\b/i.test(headerLower)) {
    const matchedCity = BD_CITIES_AND_REGIONS.find((c) => new RegExp(`\\b${escapeReg(c)}\\b`, 'i').test(headerLower));
    const cityDisplay = matchedCity ? matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1) : null;
    return {
      country: 'Bangladesh',
      city: cityDisplay,
      displayLocation: cityDisplay ? `${cityDisplay}, Bangladesh` : 'Bangladesh',
      isBangladesh: true,
      isForeign: false,
      sourceSnippet: cityDisplay ? `${cityDisplay}, Bangladesh` : 'Bangladesh',
    };
  }

  // 3. Scan Header Lines for Foreign Nationalities
  for (const fn of FOREIGN_NATIONALITIES) {
    const reg = new RegExp(`\\b${escapeReg(fn.nationality)}\\b`, 'i');
    if (reg.test(headerLower)) {
      return {
        country: fn.country,
        city: null,
        displayLocation: fn.country,
        isBangladesh: false,
        isForeign: true,
        sourceSnippet: fn.nationality,
      };
    }
  }

  // 4. Scan Header Lines for Foreign Tech Hubs & Cities
  for (const fCity of FOREIGN_MAJOR_CITIES) {
    for (const alias of fCity.aliases) {
      const reg = new RegExp(`\\b${escapeReg(alias)}\\b`, 'i');
      if (reg.test(headerLower)) {
        return {
          country: fCity.country,
          city: fCity.city,
          displayLocation: `${fCity.city}, ${fCity.country}`,
          isBangladesh: false,
          isForeign: true,
          sourceSnippet: `${fCity.city}, ${fCity.country}`,
        };
      }
    }
  }

  // 5. Scan Header Lines for Foreign Countries
  for (const fc of FOREIGN_COUNTRIES) {
    // Avoid short 2-letter country codes in broad regex unless boundary-checked carefully
    for (const alias of fc.aliases) {
      if (alias.length <= 2) {
        // e.g. "IN" or "US" only match with comma or location context, like "Bangalore, IN" or "TX, US"
        const strictReg = new RegExp(`(?:,|in|at|from)\\s+${escapeReg(alias.toUpperCase())}\\b`, 'i');
        if (strictReg.test(headerText)) {
          return {
            country: fc.name,
            city: null,
            displayLocation: fc.name,
            isBangladesh: false,
            isForeign: true,
            sourceSnippet: fc.name,
          };
        }
      } else {
        const reg = new RegExp(`\\b${escapeReg(alias)}\\b`, 'i');
        if (reg.test(headerLower)) {
          return {
            country: fc.name,
            city: null,
            displayLocation: fc.name,
            isBangladesh: false,
            isForeign: true,
            sourceSnippet: fc.name,
          };
        }
      }
    }
  }

  // 6. Check if any BD city exists anywhere in the rest of document
  for (const bdCity of BD_CITIES_AND_REGIONS.slice(0, 15)) {
    const reg = new RegExp(`\\b${escapeReg(bdCity)}\\b`, 'i');
    if (reg.test(text)) {
      const formattedCity = bdCity.charAt(0).toUpperCase() + bdCity.slice(1);
      return {
        country: 'Bangladesh',
        city: formattedCity,
        displayLocation: `${formattedCity}, Bangladesh`,
        isBangladesh: true,
        isForeign: false,
        sourceSnippet: `${formattedCity}, Bangladesh`,
      };
    }
  }

  // 7. No country detected (Empty is ok)
  return {
    country: null,
    city: null,
    displayLocation: null,
    isBangladesh: false,
    isForeign: false,
    sourceSnippet: null,
  };
}

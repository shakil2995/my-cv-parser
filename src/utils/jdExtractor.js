/**
 * Job Description (JD) Auto-Skill & Requirement Extractor
 * Parses free-form Job Descriptions, extracts technical stacks, tools, methodologies,
 * assigns smart weights based on JD sections (Requirements vs Nice-to-Have), and identifies potential disqualifiers.
 */

import { createTokenRegex } from './scoring.js';

// Comprehensive Skills Knowledge Base (~350+ skills & variants)
export const SKILL_KNOWLEDGE_BASE = [
  // Mobile Development
  { keyword: 'Flutter', category: 'technical', aliases: ['flutter'] },
  { keyword: 'Dart', category: 'technical', aliases: ['dart'] },
  { keyword: 'React Native', category: 'technical', aliases: ['react-native', 'react native'] },
  { keyword: 'Android', category: 'technical', aliases: ['android sdk', 'android app'] },
  { keyword: 'Kotlin', category: 'technical', aliases: ['kotlin'] },
  { keyword: 'iOS', category: 'technical', aliases: ['ios development', 'ios app'] },
  { keyword: 'Swift', category: 'technical', aliases: ['swift'] },
  { keyword: 'SwiftUI', category: 'technical', aliases: ['swiftui'] },
  { keyword: 'Jetpack Compose', category: 'technical', aliases: ['jetpack compose', 'compose'] },
  { keyword: 'BLoC', category: 'technical', aliases: ['bloc pattern', 'flutter_bloc', 'bloc'] },
  { keyword: 'Provider', category: 'technical', aliases: ['flutter provider'] },
  { keyword: 'Riverpod', category: 'technical', aliases: ['riverpod'] },
  { keyword: 'Objective-C', category: 'technical', aliases: ['objc', 'objective c'] },
  { keyword: 'Mobile UI/UX', category: 'technical', aliases: ['mobile design'] },

  // Web & Frontend
  { keyword: 'React', category: 'technical', aliases: ['reactjs', 'react.js'] },
  { keyword: 'Next.js', category: 'technical', aliases: ['nextjs', 'next.js'] },
  { keyword: 'TypeScript', category: 'technical', aliases: ['ts', 'typescript'] },
  { keyword: 'JavaScript', category: 'technical', aliases: ['js', 'es6', 'javascript'] },
  { keyword: 'Vue', category: 'technical', aliases: ['vuejs', 'vue.js', 'vue 3'] },
  { keyword: 'Nuxt', category: 'technical', aliases: ['nuxtjs', 'nuxt.js'] },
  { keyword: 'Angular', category: 'technical', aliases: ['angularjs', 'angular'] },
  { keyword: 'Svelte', category: 'technical', aliases: ['sveltekit', 'svelte'] },
  { keyword: 'HTML5', category: 'technical', aliases: ['html', 'html/css'] },
  { keyword: 'CSS3', category: 'technical', aliases: ['css', 'scss', 'sass', 'less'] },
  { keyword: 'Tailwind CSS', category: 'technical', aliases: ['tailwind', 'tailwindcss'] },
  { keyword: 'Bootstrap', category: 'technical', aliases: ['bootstrap'] },
  { keyword: 'Material UI', category: 'technical', aliases: ['mui', 'material-ui'] },
  { keyword: 'Redux', category: 'technical', aliases: ['redux toolkit', 'rtk'] },
  { keyword: 'Zustand', category: 'technical', aliases: ['zustand'] },
  { keyword: 'React Query', category: 'technical', aliases: ['tanstack query', 'react-query'] },
  { keyword: 'Webpack', category: 'technical', aliases: ['webpack', 'vite', 'turbopack'] },
  { keyword: 'WebSockets', category: 'technical', aliases: ['socket.io', 'websocket'] },

  // Backend & APIs
  { keyword: 'Node.js', category: 'technical', aliases: ['nodejs', 'node'] },
  { keyword: 'Express', category: 'technical', aliases: ['expressjs', 'express.js'] },
  { keyword: 'NestJS', category: 'technical', aliases: ['nestjs', 'nest.js'] },
  { keyword: 'Python', category: 'technical', aliases: ['python3', 'python'] },
  { keyword: 'Django', category: 'technical', aliases: ['django rest framework', 'drf'] },
  { keyword: 'FastAPI', category: 'technical', aliases: ['fastapi'] },
  { keyword: 'Flask', category: 'technical', aliases: ['flask'] },
  { keyword: 'Java', category: 'technical', aliases: ['core java', 'java 17', 'java 11', 'java 8'] },
  { keyword: 'Spring Boot', category: 'technical', aliases: ['springboot', 'spring framework', 'spring'] },
  { keyword: 'Go', category: 'technical', aliases: ['golang', 'go lang'] },
  { keyword: 'C#', category: 'technical', aliases: ['c-sharp', 'csharp'] },
  { keyword: '.NET', category: 'technical', aliases: ['.net core', 'dotnet', 'asp.net', 'asp.net core'] },
  { keyword: 'PHP', category: 'technical', aliases: ['php8', 'php7'] },
  { keyword: 'Laravel', category: 'technical', aliases: ['laravel'] },
  { keyword: 'Ruby on Rails', category: 'technical', aliases: ['rails', 'ruby'] },
  { keyword: 'Rust', category: 'technical', aliases: ['rustlang'] },
  { keyword: 'C++', category: 'technical', aliases: ['cpp', 'c/c++'] },
  { keyword: 'REST API', category: 'technical', aliases: ['restful', 'rest apis', 'restful api'] },
  { keyword: 'GraphQL', category: 'technical', aliases: ['apollo graphql', 'graphql'] },
  { keyword: 'gRPC', category: 'technical', aliases: ['grpc', 'protobuf'] },
  { keyword: 'Microservices', category: 'technical', aliases: ['microservice architecture', 'microservices'] },

  // Databases & Storage
  { keyword: 'PostgreSQL', category: 'technical', aliases: ['postgres', 'psql'] },
  { keyword: 'MySQL', category: 'technical', aliases: ['mysql database', 'mariadb'] },
  { keyword: 'MongoDB', category: 'technical', aliases: ['mongo', 'nosql'] },
  { keyword: 'Redis', category: 'technical', aliases: ['redis cache'] },
  { keyword: 'SQLite', category: 'technical', aliases: ['sqlite3'] },
  { keyword: 'Firebase', category: 'technical', aliases: ['firebase auth', 'cloud firestore', 'firestore'] },
  { keyword: 'Supabase', category: 'technical', aliases: ['supabase'] },
  { keyword: 'Elasticsearch', category: 'technical', aliases: ['elastic search', 'elk'] },
  { keyword: 'Prisma', category: 'technical', aliases: ['prisma orm'] },
  { keyword: 'TypeORM', category: 'technical', aliases: ['typeorm'] },

  // Cloud & DevOps
  { keyword: 'Docker', category: 'technical', aliases: ['docker containers', 'dockerfile'] },
  { keyword: 'Kubernetes', category: 'technical', aliases: ['k8s'] },
  { keyword: 'AWS', category: 'cert', aliases: ['amazon web services', 'ec2', 's3', 'lambda'] },
  { keyword: 'GCP', category: 'cert', aliases: ['google cloud', 'google cloud platform'] },
  { keyword: 'Azure', category: 'cert', aliases: ['microsoft azure'] },
  { keyword: 'CI/CD', category: 'technical', aliases: ['continuous integration', 'github actions', 'gitlab ci'] },
  { keyword: 'Terraform', category: 'technical', aliases: ['iac', 'terraform'] },
  { keyword: 'Linux', category: 'technical', aliases: ['ubuntu', 'debian', 'centos', 'bash', 'shell scripting'] },
  { keyword: 'Nginx', category: 'technical', aliases: ['nginx'] },
  { keyword: 'Git', category: 'technical', aliases: ['github', 'gitlab', 'version control', 'git flow'] },

  // Architecture & Testing
  { keyword: 'Clean Architecture', category: 'technical', aliases: ['clean code', 'solid principles', 'design patterns'] },
  { keyword: 'Unit Testing', category: 'technical', aliases: ['unit tests', 'tdd', 'test driven development'] },
  { keyword: 'Jest', category: 'technical', aliases: ['jest', 'vitest'] },
  { keyword: 'Cypress', category: 'technical', aliases: ['cypress.io', 'cypress'] },
  { keyword: 'Playwright', category: 'technical', aliases: ['playwright'] },

  // Soft Skills & Methodologies
  { keyword: 'Agile / Scrum', category: 'soft', aliases: ['agile', 'scrum', 'kanban', 'sprint'] },
  { keyword: 'Communication', category: 'soft', aliases: ['communication skills', 'verbal communication', 'written communication'] },
  { keyword: 'Team Leadership', category: 'soft', aliases: ['leadership', 'team lead', 'mentoring', 'mentorship'] },
  { keyword: 'Problem Solving', category: 'soft', aliases: ['analytical thinking', 'problem-solving', 'troubleshooting'] },
  { keyword: 'Code Review', category: 'soft', aliases: ['peer review', 'code reviews'] },
];

// Potential Disqualifiers commonly in JDs
const DISQUALIFIER_PATTERNS = [
  { keyword: 'Visa Required', pattern: /\b(?:visa\s+sponsorship\s+not\s+available|must\s+be\s+eligible\s+to\s+work|no\s+sponsorship)\b/i },
  { keyword: 'Onsite Only', pattern: /\b(?:strictly\s+onsite|no\s+remote|must\s+relocate|relocation\s+required)\b/i },
  { keyword: 'Immediate Joiner', pattern: /\b(?:immediate\s+joiner|join\s+immediately|max\s+15\s+days?\s+notice)\b/i },
  { keyword: 'Overtime Required', pattern: /\b(?:night\s+shifts?|weekend\s+support|24\/7\s+availability)\b/i },
];

/**
 * Split text into semantic sections: 'requirements', 'bonuses', 'general'
 */
function analyzeJdSections(text) {
  const lines = text.split('\n');
  const sections = {
    requirements: '',
    bonuses: '',
    general: '',
  };

  let currentSection = 'general';

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    // Check for Requirement section headers
    if (/^(?:requirements|what you(?:'ll| will) need|qualifications|skills required|must have|mandatory|core requirements|what we are looking for)/i.test(lower)) {
      currentSection = 'requirements';
      continue;
    }

    // Check for Bonus / Nice-to-Have section headers
    if (/^(?:nice to have|bonus points?|preferred qualifications|good to have|plus|what sets you apart|desired skills)/i.test(lower)) {
      currentSection = 'bonuses';
      continue;
    }

    // Check for About Company / Benefits headers
    if (/^(?:about us|who we are|benefits|perks|what we offer|compensation)/i.test(lower)) {
      currentSection = 'general';
      continue;
    }

    sections[currentSection] += line + '\n';
  }

  return sections;
}

/**
 * Extract matched skills, calculate smart weights based on context and frequency
 */
export function extractSkillsFromJD(jdText) {
  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    return {
      skills: [],
      suggestedDisqualifiers: [],
      stats: { totalFound: 0, requiredCount: 0, bonusCount: 0 },
    };
  }

  const sections = analyzeJdSections(jdText);
  const matchedSkills = [];
  const seenKeywords = new Set();

  for (const item of SKILL_KNOWLEDGE_BASE) {
    // Check all aliases
    const searchTerms = [item.keyword, ...(item.aliases || [])];
    let foundInReq = false;
    let foundInBonus = false;
    let foundInGeneral = false;
    let totalMatches = 0;

    for (const term of searchTerms) {
      const regex = createTokenRegex(term);
      if (!regex) continue;

      const reqMatches = (sections.requirements.match(regex) || []).length;
      const bonusMatches = (sections.bonuses.match(regex) || []).length;
      const genMatches = (sections.general.match(regex) || []).length;

      if (reqMatches > 0) foundInReq = true;
      if (bonusMatches > 0) foundInBonus = true;
      if (genMatches > 0) foundInGeneral = true;

      totalMatches += reqMatches + bonusMatches + genMatches;
    }

    if (totalMatches > 0 && !seenKeywords.has(item.keyword.toLowerCase())) {
      seenKeywords.add(item.keyword.toLowerCase());

      // Smart Weight Determination:
      // - If listed in "Requirements / Must Have": weight 8 to 10 based on frequency
      // - If listed in "Nice to have / Bonus": weight 5 to 6
      // - If listed generally: weight 7 for tech, 5 for soft
      let weight = 7;
      let importance = 'recommended';

      if (foundInReq) {
        weight = Math.min(10, 8 + Math.min(2, totalMatches - 1));
        importance = 'required';
      } else if (foundInBonus && !foundInGeneral) {
        weight = 5;
        importance = 'bonus';
      } else {
        weight = item.category === 'soft' ? 5 : (item.category === 'cert' ? 7 : 7);
      }

      matchedSkills.push({
        id: `jd-skill-${matchedSkills.length}`,
        keyword: item.keyword,
        category: item.category,
        weight,
        importance,
        occurrences: totalMatches,
        selected: true, // checked by default in the interactive review modal
      });
    }
  }

  // Sort by weight descending, then by importance
  const importanceRank = { required: 1, recommended: 2, bonus: 3 };
  matchedSkills.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return (importanceRank[a.importance] || 9) - (importanceRank[b.importance] || 9);
  });

  // Check for disqualifiers in the JD
  const suggestedDisqualifiers = [];
  for (const dis of DISQUALIFIER_PATTERNS) {
    if (dis.pattern.test(jdText)) {
      suggestedDisqualifiers.push({
        keyword: dis.keyword,
        type: 'disqualifier',
        selected: true,
      });
    }
  }

  return {
    skills: matchedSkills,
    suggestedDisqualifiers,
    stats: {
      totalFound: matchedSkills.length,
      requiredCount: matchedSkills.filter((s) => s.importance === 'required').length,
      bonusCount: matchedSkills.filter((s) => s.importance === 'bonus').length,
    },
  };
}

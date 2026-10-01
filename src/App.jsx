import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Plus,
  Trash2,
  AlertCircle,
  Star,
  Search,
  Sliders,
  ArrowUpDown,
  X,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings2,
  PanelRight,
  PanelRightClose,
  Check,
  RotateCcw,
  FileDown,
  Info,
  Smartphone,
  Globe,
  Server,
  Database,
  Users,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  MessageSquare,
  Copy,
  Briefcase,
  Wand2,
  BookOpen,
  Keyboard,
  MapPin,
  Flag,
  Highlighter
} from 'lucide-react';
import JSZip from 'jszip';
import {
  calculateCandidateScore,
  extractCandidateName,
  CATEGORY_LABELS
} from './utils/scoring';
import { extractTextFromFile, extractFilesFromZip } from './utils/documentParser';
import {
  extractLinksFromDocument,
  linkifyContent,
  highlightContent,
  renderLinkIcon
} from './utils/linkExtractor';
import { extractContactDetails } from './utils/contactExtractor';
import { extractLocationDetails } from './utils/locationExtractor';
import { extractSkillsFromJD, SKILL_KNOWLEDGE_BASE } from './utils/jdExtractor';
import { detectExperienceLevel } from './utils/experienceDetector';
import PdfHighlightViewer from './components/PdfHighlightViewer';

const SKILL_CATEGORIES = [
  {
    id: 'all',
    name: 'All Skills',
  },
  {
    id: 'mobile',
    name: 'Mobile Apps',
    icon: Smartphone,
    skills: [
      { keyword: 'Flutter', category: 'technical', weight: 8 },
      { keyword: 'Dart', category: 'technical', weight: 7 },
      { keyword: 'React Native', category: 'technical', weight: 8 },
      { keyword: 'Android', category: 'technical', weight: 7 },
      { keyword: 'Kotlin', category: 'technical', weight: 8 },
      { keyword: 'iOS', category: 'technical', weight: 7 },
      { keyword: 'Swift', category: 'technical', weight: 8 },
      { keyword: 'SwiftUI', category: 'technical', weight: 7 },
      { keyword: 'Jetpack Compose', category: 'technical', weight: 7 },
      { keyword: 'BLoC', category: 'technical', weight: 6 },
      { keyword: 'Mobile UI/UX', category: 'technical', weight: 5 }
    ]
  },
  {
    id: 'web',
    name: 'Web & Frontend',
    icon: Globe,
    skills: [
      { keyword: 'React', category: 'technical', weight: 8 },
      { keyword: 'Next.js', category: 'technical', weight: 8 },
      { keyword: 'TypeScript', category: 'technical', weight: 8 },
      { keyword: 'JavaScript', category: 'technical', weight: 7 },
      { keyword: 'Vue', category: 'technical', weight: 7 },
      { keyword: 'Tailwind CSS', category: 'technical', weight: 6 },
      { keyword: 'Redux', category: 'technical', weight: 6 },
      { keyword: 'HTML/CSS', category: 'technical', weight: 5 },
      { keyword: 'Angular', category: 'technical', weight: 7 },
      { keyword: 'Svelte', category: 'technical', weight: 6 }
    ]
  },
  {
    id: 'backend',
    name: 'Backend & APIs',
    icon: Server,
    skills: [
      { keyword: 'Node.js', category: 'technical', weight: 8 },
      { keyword: 'Python', category: 'technical', weight: 8 },
      { keyword: 'FastAPI', category: 'technical', weight: 7 },
      { keyword: 'Django', category: 'technical', weight: 7 },
      { keyword: 'Java', category: 'technical', weight: 8 },
      { keyword: 'Spring Boot', category: 'technical', weight: 8 },
      { keyword: 'Go', category: 'technical', weight: 8 },
      { keyword: 'C#', category: 'technical', weight: 7 },
      { keyword: '.NET', category: 'technical', weight: 7 },
      { keyword: 'Express', category: 'technical', weight: 7 },
      { keyword: 'NestJS', category: 'technical', weight: 7 },
      { keyword: 'GraphQL', category: 'technical', weight: 6 },
      { keyword: 'REST API', category: 'technical', weight: 6 }
    ]
  },
  {
    id: 'data-cloud',
    name: 'Database & Cloud',
    icon: Database,
    skills: [
      { keyword: 'PostgreSQL', category: 'technical', weight: 7 },
      { keyword: 'MongoDB', category: 'technical', weight: 7 },
      { keyword: 'MySQL', category: 'technical', weight: 6 },
      { keyword: 'Redis', category: 'technical', weight: 6 },
      { keyword: 'Firebase', category: 'technical', weight: 6 },
      { keyword: 'Docker', category: 'technical', weight: 7 },
      { keyword: 'Kubernetes', category: 'technical', weight: 7 },
      { keyword: 'AWS', category: 'cert', weight: 7 },
      { keyword: 'GCP', category: 'cert', weight: 7 },
      { keyword: 'CI/CD', category: 'technical', weight: 6 }
    ]
  },
  {
    id: 'soft',
    name: 'Soft & Leadership',
    icon: Users,
    skills: [
      { keyword: 'Communication', category: 'soft', weight: 5 },
      { keyword: 'Team Leadership', category: 'soft', weight: 6 },
      { keyword: 'Problem Solving', category: 'soft', weight: 5 },
      { keyword: 'Agile / Scrum', category: 'soft', weight: 5 },
      { keyword: 'Code Review', category: 'soft', weight: 5 }
    ]
  }
];

const DISQUALIFIER_PRESETS = [
  'unauthorized',
  'visa required',
  'visa sponsorship',
  'no relocation',
  'intern',
  'unpaid'
];

function getCandidateInitials(name) {
  if (!name) return 'CV';
  // Strip common noisy file suffixes like CV, Resume, Mobile, Developer, etc.
  let clean = name
    .replace(/\.(pdf|docx|doc|zip)$/i, '')
    .replace(/\b(cv|resume|curriculum|vitae|developer|engineer|flutter|mobile|senior|junior|lead|frontend|backend|fullstack|profile|doc)\b/gi, '')
    .replace(/[_.-]+/g, ' ')
    .trim();

  let parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    parts = name.replace(/\.(pdf|docx|doc)$/i, '').replace(/[_.-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }

  if (parts.length >= 2) {
    // If first part is "Md" or "Mohammad" and we have 3 parts, take Md + 2nd name part
    if (/^(md|mohammad|muhammad|mst)$/i.test(parts[0]) && parts.length >= 3) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'CV';
}

function getScoreBadgeStyle(isAccepted = false, isOverridden = false) {
  if (isOverridden) {
    return 'bg-purple-950/90 text-purple-300 border-purple-800/60 shadow-purple-950/50';
  }
  if (isAccepted) {
    return 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/50';
  }
  return 'bg-rose-950/80 text-rose-300 border-rose-800/60 shadow-rose-950/50';
}

function getCoverageBadgeStyle(coveragePercent) {
  if (coveragePercent >= 70) {
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50';
  }
  if (coveragePercent >= 40) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800/50';
  }
  return 'bg-rose-950/80 text-rose-300 border-rose-800/50';
}

function getCoverageCardStyle(coveragePercent) {
  if (coveragePercent >= 70) {
    return 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300';
  }
  if (coveragePercent >= 40) {
    return 'bg-amber-950/30 border-amber-800/50 text-amber-300';
  }
  return 'bg-rose-950/30 border-rose-800/50 text-rose-300';
}

function getCoverageBarColor(coveragePercent) {
  if (coveragePercent >= 70) {
    return 'bg-emerald-400';
  }
  if (coveragePercent >= 40) {
    return 'bg-amber-400';
  }
  return 'bg-rose-500';
}

const CVParserApp = () => {
  // Files state
  const [files, setFiles] = useState([]);
  const [fileMap, setFileMap] = useState(new Map());
  const [isDragging, setIsDragging] = useState(false);

  // Setup Modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [setupTab, setSetupTab] = useState('jd'); // 'jd' | 'skills' | 'disqualifiers' | 'upload'
  const [presetCategoryTab, setPresetCategoryTab] = useState('all');
  const searchInputRef = useRef(null);

  // JD Extractor state
  const [jdInputText, setJdInputText] = useState('');
  const [extractedJdResult, setExtractedJdResult] = useState(null);
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  const [copiedToast, setCopiedToast] = useState(null);

  // Inspector panel toggle
  const [showInspector, setShowInspector] = useState(true);

  // Keywords configuration - starter skills so skill checking works immediately
  const [positiveKeywords, setPositiveKeywords] = useState([
    { id: 'def-1', keyword: 'React', weight: 8, category: 'technical', mustHave: false },
    { id: 'def-2', keyword: 'JavaScript', weight: 7, category: 'technical', mustHave: false },
    { id: 'def-3', keyword: 'Node.js', weight: 8, category: 'technical', mustHave: false },
    { id: 'def-4', keyword: 'Python', weight: 8, category: 'technical', mustHave: false },
    { id: 'def-5', keyword: 'Communication', weight: 5, category: 'soft', mustHave: false },
  ]);
  const [negativeKeywords, setNegativeKeywords] = useState([]);
  const [bangladeshiOnly, setBangladeshiOnly] = useState(true); // Bangladeshi Only dealbreaker: ON by default

  // Keyword input states
  const [newPosKeyword, setNewPosKeyword] = useState('');
  const [newPosWeight, setNewPosWeight] = useState(7);
  const [newPosCategory, setNewPosCategory] = useState('technical');
  const [newPosMustHave, setNewPosMustHave] = useState(false);
  const [newNegKeyword, setNewNegKeyword] = useState('');
  const [newNegType, setNewNegType] = useState('disqualifier');
  const [newNegPenalty, setNewNegPenalty] = useState(5);

  // Sorter and Filter states
  const [passingThreshold, setPassingThreshold] = useState(60);
  const [sidebarTab, setSidebarTab] = useState('all'); // 'all' | 'shortlisted' | 'rejected' | 'starred'
  const [sortBy, setSortBy] = useState('score-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState(null);
  const [manualOverrides, setManualOverrides] = useState({}); // { [fileName]: 'accepted' | 'rejected' }
  const [favorites, setFavorites] = useState(new Set());

  // Processing states
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    fileName: '',
    successCount: 0,
    errorCount: 0
  });
  const [candidates, setCandidates] = useState([]);
  const cancelRef = useRef(false);

  // Selected candidate in Master-Detail view
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfViewMode, setPdfViewMode] = useState('highlighted'); // 'original' | 'highlighted'

  // Auto open setup modal on initial load if no files exist
  useEffect(() => {
    if (candidates.length === 0 && files.length === 0) {
      setShowSetupModal(true);
    }
  }, [candidates.length, files.length]);

  // Handle file uploads (PDF, DOCX, ZIP)
  const handleFilesAdded = async (fileList) => {
    const incomingFiles = Array.from(fileList);
    const newFileMap = new Map(fileMap);
    const validFiles = [];

    for (const file of incomingFiles) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.zip')) {
        try {
          const unzipped = await extractFilesFromZip(file);
          unzipped.forEach((f) => {
            validFiles.push(f);
            newFileMap.set(f.name, f);
          });
        } catch (err) {
          alert(`Error extracting ZIP: ${err.message}`);
        }
      } else if (lowerName.endsWith('.pdf') || lowerName.endsWith('.docx')) {
        validFiles.push(file);
        newFileMap.set(file.name, file);
      }
    }

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = validFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
    setFileMap(newFileMap);
  };

  const removeFile = (indexToRemove) => {
    const fileToRemove = files[indexToRemove];
    setFiles(files.filter((_, i) => i !== indexToRemove));
    if (fileToRemove) {
      const newMap = new Map(fileMap);
      newMap.delete(fileToRemove.name);
      setFileMap(newMap);
      setCandidates((prev) => prev.filter((c) => c.name !== fileToRemove.name));
      if (selectedCandidateId && selectedCandidateId.startsWith(fileToRemove.name)) {
        setSelectedCandidateId(null);
      }
    }
  };

  // Keyword operations
  const addPositiveKeyword = () => {
    if (!newPosKeyword.trim()) return;
    setPositiveKeywords((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        keyword: newPosKeyword.trim(),
        weight: Number(newPosWeight) || 5,
        category: newPosCategory,
        mustHave: newPosMustHave
      }
    ]);
    setNewPosKeyword('');
    setNewPosMustHave(false);
  };

  const toggleSkillMustHave = (id) => {
    setPositiveKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, mustHave: !k.mustHave } : k))
    );
  };

  // Presets filtering and toggle
  const displayedPresets = useMemo(() => {
    if (presetCategoryTab === 'all') {
      const all = [];
      const seen = new Set();
      SKILL_CATEGORIES.forEach((cat) => {
        if (cat.skills) {
          cat.skills.forEach((s) => {
            if (!seen.has(s.keyword.toLowerCase())) {
              seen.add(s.keyword.toLowerCase());
              all.push(s);
            }
          });
        }
      });
      return all;
    }
    const found = SKILL_CATEGORIES.find((c) => c.id === presetCategoryTab);
    return found?.skills || [];
  }, [presetCategoryTab]);

  const togglePresetSkill = (preset) => {
    const existing = positiveKeywords.find(
      (k) => k.keyword.toLowerCase() === preset.keyword.toLowerCase()
    );
    if (existing) {
      removePositiveKeyword(existing.id);
    } else {
      setPositiveKeywords((prev) => [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          keyword: preset.keyword,
          weight: preset.weight,
          category: preset.category,
          mustHave: preset.mustHave || false
        }
      ]);
    }
  };

  const togglePresetDisqualifier = (disqualifierText) => {
    const existing = negativeKeywords.find(
      (k) => k.keyword.toLowerCase() === disqualifierText.toLowerCase()
    );
    if (existing) {
      removeNegativeKeyword(existing.id);
    } else {
      setNegativeKeywords((prev) => [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          keyword: disqualifierText,
          type: 'disqualifier',
          penalty: 0
        }
      ]);
    }
  };

  const removePositiveKeyword = (id) => {
    setPositiveKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const addNegativeKeyword = () => {
    if (!newNegKeyword.trim()) return;
    setNegativeKeywords((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        keyword: newNegKeyword.trim(),
        type: newNegType,
        penalty: Number(newNegPenalty) || 5
      }
    ]);
    setNewNegKeyword('');
  };

  const removeNegativeKeyword = (id) => {
    setNegativeKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const cancelProcessing = () => {
    cancelRef.current = true;
  };

  // Process all uploaded files with cooperative scheduling for large volume stability
  const processFiles = async () => {
    if (files.length === 0) {
      alert('Please upload CV files first.');
      return;
    }

    cancelRef.current = false;
    setProcessing(true);
    setProgress({
      current: 0,
      total: files.length,
      percent: 0,
      fileName: 'Initializing queue...',
      successCount: 0,
      errorCount: 0
    });

    const parsedCandidates = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) {
        console.info(`Screening stopped by user at candidate ${i}/${files.length}`);
        break;
      }

      const file = files[i];
      const percent = Math.round(((i + 1) / files.length) * 100);

      setProgress({
        current: i + 1,
        total: files.length,
        percent,
        fileName: file.name,
        successCount,
        errorCount
      });

      try {
        const docResult = await extractTextFromFile(file);
        const text = typeof docResult === 'string' ? docResult : docResult.text;
        const annotations = (docResult && docResult.annotations) || [];
        const links = extractLinksFromDocument(text, annotations);
        const contact = extractContactDetails(text, annotations);
        const location = extractLocationDetails(text);
        const experience = detectExperienceLevel(text);
        const scoreResult = calculateCandidateScore(text, positiveKeywords, negativeKeywords, {
          bangladeshiOnly,
          contact,
          location
        });
        const displayName = extractCandidateName(file.name, text);

        parsedCandidates.push({
          id: `${file.name}-${i}-${Date.now()}`,
          name: file.name,
          displayName,
          fileType: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX',
          fullText: text,
          links,
          contact,
          location,
          experience,
          ...scoreResult
        });
        successCount++;
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        errorCount++;
        parsedCandidates.push({
          id: `${file.name}-${i}-${Date.now()}`,
          name: file.name,
          displayName: extractCandidateName(file.name, ''),
          fileType: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX',
          fullText: '',
          links: [],
          contact: { emails: [], primaryEmail: null, phones: [], primaryPhone: null, hasBdPhone: false, hasForeignPhone: false },
          location: { country: null, city: null, displayLocation: null, isBangladesh: false, isForeign: false, sourceSnippet: null },
          experience: { level: 'Not Specified', badgeLabel: 'Exp: N/A', years: null, yearsDisplay: 'N/A', confidence: 'low', sourceSnippet: null, color: 'slate' },
          score: 0,
          scorePercent: 0,
          coveragePercent: 0,
          matchedCount: 0,
          totalPositive: positiveKeywords.length,
          mustHaveCount: positiveKeywords.filter((k) => k.mustHave).length,
          matchedMustHaveCount: 0,
          missingMustHaves: positiveKeywords.filter((k) => k.mustHave),
          hasMissingMustHave: positiveKeywords.some((k) => k.mustHave),
          depthScore: 0,
          foundKeywords: [],
          foundNegatives: [],
          hasDisqualifier: false,
          disqualifiers: [],
          snippets: [],
          error: error.message
        });
      }

      // Stream candidates incrementally every 3 files or on completion
      if ((i + 1) % 3 === 0 || i === files.length - 1) {
        setCandidates([...parsedCandidates]);
      }

      // Cooperative event-loop yielding: 35ms pause allows V8 GC sweeps
      // to reclaim memory and prevents browser tab freezes on 100-500+ queues
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    setCandidates(parsedCandidates);
    setProcessing(false);
    setShowSetupModal(false);

    if (parsedCandidates.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(parsedCandidates[0].id);
    }
  };

  // Enriched candidates list with live computed status, real-time dynamic scoring, contact, and experience
  const enrichedCandidates = useMemo(() => {
    return candidates.map((c) => {
      // Ensure candidate has extracted links, contact, location, and experience
      const candidateLinks = c.links || extractLinksFromDocument(c.fullText, []);
      const candidateContact = c.contact || extractContactDetails(c.fullText, []);
      const candidateLocation = c.location || extractLocationDetails(c.fullText);
      const candidateExperience = c.experience || detectExperienceLevel(c.fullText);

      // Real-time live score calculation if keywords change after parsing
      const scoreResult = c.fullText
        ? calculateCandidateScore(c.fullText, positiveKeywords, negativeKeywords, {
            bangladeshiOnly,
            contact: candidateContact,
            location: candidateLocation
          })
        : c;

      const isManual = manualOverrides[c.name];
      let status = 'rejected';

      if (isManual) {
        status = isManual;
      } else if (scoreResult.hasDisqualifier || scoreResult.hasMissingMustHave) {
        status = 'rejected';
      } else if (scoreResult.scorePercent >= passingThreshold) {
        status = 'accepted';
      } else {
        status = 'rejected';
      }

      // Compute missing required skills
      const matchedSet = new Set((scoreResult.foundKeywords || []).map((k) => k.keyword.toLowerCase()));
      const missingSkills = positiveKeywords.filter(
        (k) => !matchedSet.has(k.keyword.toLowerCase())
      );

      return {
        ...c,
        ...scoreResult,
        contact: candidateContact,
        location: candidateLocation,
        experience: candidateExperience,
        links: candidateLinks,
        computedStatus: status,
        isOverridden: Boolean(isManual),
        isStarred: favorites.has(c.name),
        missingSkills
      };
    });
  }, [candidates, manualOverrides, passingThreshold, favorites, positiveKeywords, negativeKeywords, bangladeshiOnly]);

  // Filter and Sort Candidate List for Sidebar
  const { filteredCandidates, poolCounts, allSkills } = useMemo(() => {
    const skillsSet = new Set();
    let acceptedCount = 0;
    let rejectedCount = 0;
    let starredCount = 0;

    enrichedCandidates.forEach((c) => {
      c.foundKeywords.forEach((k) => skillsSet.add(k.keyword));
      if (c.computedStatus === 'accepted') acceptedCount++;
      if (c.computedStatus === 'rejected') rejectedCount++;
      if (c.isStarred) starredCount++;
    });

    const poolCounts = {
      all: enrichedCandidates.length,
      accepted: acceptedCount,
      rejected: rejectedCount,
      starred: starredCount
    };

    // Filter by pool tab
    let result = enrichedCandidates.filter((c) => {
      if (sidebarTab === 'shortlisted') return c.computedStatus === 'accepted';
      if (sidebarTab === 'rejected') return c.computedStatus === 'rejected';
      if (sidebarTab === 'starred') return c.isStarred;
      return true;
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.foundKeywords.some((k) => k.keyword.toLowerCase().includes(q))
      );
    }

    // Filter by skill chip
    if (selectedSkillFilter) {
      result = result.filter((c) =>
        c.foundKeywords.some(
          (k) => k.keyword.toLowerCase() === selectedSkillFilter.toLowerCase()
        )
      );
    }

    // Sort
    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'score-desc':
          return b.scorePercent - a.scorePercent || b.coveragePercent - a.coveragePercent;
        case 'score-asc':
          return a.scorePercent - b.scorePercent || a.coveragePercent - b.coveragePercent;
        case 'coverage-desc':
          return b.coveragePercent - a.coveragePercent || b.scorePercent - a.scorePercent;
        case 'name-asc':
          return a.displayName.localeCompare(b.displayName);
        case 'name-desc':
          return b.displayName.localeCompare(a.displayName);
        case 'starred-first': {
          const starA = a.isStarred ? 1 : 0;
          const starB = b.isStarred ? 1 : 0;
          if (starA !== starB) return starB - starA;
          return b.scorePercent - a.scorePercent;
        }
        default:
          return b.scorePercent - a.scorePercent;
      }
    };

    result.sort(sortFn);

    return {
      filteredCandidates: result,
      poolCounts,
      allSkills: Array.from(skillsSet)
    };
  }, [enrichedCandidates, sidebarTab, searchQuery, selectedSkillFilter, sortBy]);

  // Selected Candidate object
  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateId) return filteredCandidates[0] || null;
    return (
      enrichedCandidates.find((c) => c.id === selectedCandidateId) ||
      filteredCandidates[0] ||
      null
    );
  }, [selectedCandidateId, enrichedCandidates, filteredCandidates]);

  // Keep PDF object URL in sync with selected candidate
  useEffect(() => {
    if (!selectedCandidate || selectedCandidate.fileType !== 'PDF') {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const file = fileMap.get(selectedCandidate.name);
    if (file) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
  }, [selectedCandidate, fileMap]);

  // Navigation: Next / Prev Candidate
  const currentIndex = useMemo(() => {
    if (!selectedCandidate) return -1;
    return filteredCandidates.findIndex((c) => c.id === selectedCandidate.id);
  }, [filteredCandidates, selectedCandidate]);

  const selectPreviousCandidate = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedCandidateId(filteredCandidates[currentIndex - 1].id);
    }
  }, [currentIndex, filteredCandidates]);

  const selectNextCandidate = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredCandidates.length - 1) {
      setSelectedCandidateId(filteredCandidates[currentIndex + 1].id);
    }
  }, [currentIndex, filteredCandidates]);

  // Decisions: Shortlist (Accept), Reject, Toggle Star
  const setCandidateDecision = useCallback((status) => {
    if (!selectedCandidate) return;
    setManualOverrides((prev) => ({
      ...prev,
      [selectedCandidate.name]: status
    }));
  }, [selectedCandidate]);

  const toggleFavoriteCandidate = useCallback((name) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }
      if (showSetupModal) {
        if (e.key === 'Escape') setShowSetupModal(false);
        return;
      }
      if (showShortcutsModal) {
        if (e.key === 'Escape' || e.key === '?') setShowShortcutsModal(false);
        return;
      }

      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectNextCandidate();
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectPreviousCandidate();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setCandidateDecision('accepted');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setCandidateDecision('rejected');
      } else if (e.key === 's' || e.key === 'S' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (selectedCandidate) toggleFavoriteCandidate(selectedCandidate.name);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setPdfViewMode((prev) => (prev === 'original' ? 'highlighted' : 'original'));
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowSetupModal(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSetupModal,
    showShortcutsModal,
    selectNextCandidate,
    selectPreviousCandidate,
    setCandidateDecision,
    selectedCandidate,
    toggleFavoriteCandidate
  ]);

  // Warn before reloading, navigating away, or closing tab if active screening data exists
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (candidates.length > 0 || files.length > 0 || processing) {
        const warningMessage = `You have ${candidates.length} processed candidate(s) and screening decisions in memory. Reloading or leaving will discard your session data unless exported to CSV or ZIP.`;
        e.preventDefault();
        e.returnValue = warningMessage;
        return warningMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [candidates.length, files.length, processing]);

  const resetManualOverride = (candidateName) => {
    setManualOverrides((prev) => {
      const next = { ...prev };
      delete next[candidateName];
      return next;
    });
  };

  // Copy to clipboard with toast notification
  const copyToClipboard = (text, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedToast(`${label} copied!`);
    setTimeout(() => setCopiedToast(null), 2200);
  };

  // Sample JDs for quick testing
  const SAMPLE_JDS = [
    {
      title: 'Senior Flutter Developer (Dhaka/BD)',
      text: `Position: Senior Flutter Developer
Location: Dhaka, Bangladesh / Hybrid
Experience: 4+ Years

Key Requirements (Must-Have):
- 4+ years of professional mobile app development experience.
- Strong proficiency with Flutter and Dart.
- State Management: BLoC, Provider, or Riverpod.
- Solid understanding of REST APIs, GraphQL, and Firebase integration.
- Native Android (Kotlin) or iOS (Swift) bridging knowledge.
- Experience with Clean Architecture and Unit Testing.
- Strong Problem Solving and Team Leadership skills.

Bonus Points / Nice-to-Have:
- CI/CD with GitHub Actions.
- Knowledge of Docker & WebSockets.
- Published applications on Google Play Store and Apple App Store.`,
    },
    {
      title: 'Full-Stack React & Node.js Developer',
      text: `Job Title: Full-Stack Engineer
Location: Remote / Dhaka

Requirements:
- 3+ years experience with React, Next.js, and TypeScript.
- Backend API development in Node.js, Express, or NestJS.
- Database design with PostgreSQL, MongoDB, and Redis caching.
- Docker, CI/CD, and AWS deployment.
- Agile / Scrum and Code Review.

Nice to Have:
- Tailwind CSS, GraphQL, Jest, Python.`,
    },
    {
      title: 'Backend Python & Cloud Engineer',
      text: `Role: Senior Backend Engineer
Requirements:
- 5+ years building backend services with Python, FastAPI, and Django.
- Microservices, PostgreSQL, Redis, and gRPC.
- Docker, Kubernetes, Linux, and GCP / AWS cloud.
- REST API security, Unit Testing, and CI/CD.
- Excellent Communication and Problem Solving.`,
    },
  ];

  // JD Auto-Skill Extractor Handlers
  const handleExtractFromJd = (text = jdInputText) => {
    if (!text || !text.trim()) return;
    setIsExtractingJd(true);
    setTimeout(() => {
      const res = extractSkillsFromJD(text);
      setExtractedJdResult(res);
      setIsExtractingJd(false);
    }, 60);
  };

  const handleApplyJdCriteria = () => {
    if (!extractedJdResult || !extractedJdResult.skills) return;

    const selectedSkills = extractedJdResult.skills
      .filter((s) => s.selected)
      .map((s) => ({
        id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        keyword: s.keyword,
        weight: s.weight,
        category: s.category,
        mustHave: Boolean(s.mustHave),
      }));

    setPositiveKeywords(selectedSkills);

    if (extractedJdResult.suggestedDisqualifiers && extractedJdResult.suggestedDisqualifiers.length > 0) {
      const selectedDis = extractedJdResult.suggestedDisqualifiers
        .filter((d) => d.selected)
        .map((d) => ({
          id: `neg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          keyword: d.keyword,
          type: 'disqualifier',
          penalty: 10,
        }));
      if (selectedDis.length > 0) {
        setNegativeKeywords(selectedDis);
      }
    }

    setSetupTab('skills');
  };

  const toggleJdSkillSelection = (index) => {
    setExtractedJdResult((prev) => {
      if (!prev) return prev;
      const updatedSkills = [...prev.skills];
      updatedSkills[index] = {
        ...updatedSkills[index],
        selected: !updatedSkills[index].selected,
      };
      return { ...prev, skills: updatedSkills };
    });
  };

  const toggleJdSkillMustHave = (index) => {
    setExtractedJdResult((prev) => {
      if (!prev) return prev;
      const updatedSkills = [...prev.skills];
      updatedSkills[index] = {
        ...updatedSkills[index],
        mustHave: !updatedSkills[index].mustHave,
      };
      return { ...prev, skills: updatedSkills };
    });
  };

  const updateJdSkillWeight = (index, delta) => {
    setExtractedJdResult((prev) => {
      if (!prev) return prev;
      const updatedSkills = [...prev.skills];
      const newWeight = Math.max(1, Math.min(10, updatedSkills[index].weight + delta));
      updatedSkills[index] = {
        ...updatedSkills[index],
        weight: newWeight,
      };
      return { ...prev, skills: updatedSkills };
    });
  };

  // Download single CV
  const downloadSingleCV = (fileName) => {
    const file = fileMap.get(fileName);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV Report
  const exportCsvReport = () => {
    if (enrichedCandidates.length === 0) {
      alert('No candidates to export.');
      return;
    }

    const headers = [
      'Candidate Name',
      'Original File',
      'Format',
      'Overall Match Score (%)',
      'Experience Level',
      'Estimated Years',
      'Location / Country',
      'Email',
      'Phone (BD/Intl)',
      'Mobile Operator',
      'Must-Haves Met',
      'Missing Must-Haves',
      'Skill Coverage (%)',
      'Skills Matched Count',
      'Matched Skills',
      'Missing Skills',
      'Disqualifiers Hit',
      'Status',
      'Manually Overridden'
    ];

    const rows = enrichedCandidates.map((c) => [
      `"${c.displayName.replace(/"/g, '""')}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      c.fileType,
      c.scorePercent,
      `"${c.experience?.confidence !== 'low' ? (c.experience?.level || 'N/A') : 'N/A'}"`,
      `"${c.experience?.confidence !== 'low' ? (c.experience?.yearsDisplay || 'N/A') : 'N/A'}"`,
      `"${c.location?.displayLocation || (c.location?.country || 'N/A')}"`,
      `"${c.contact?.primaryEmail || ''}"`,
      `"${c.contact?.primaryPhone?.display || ''}"`,
      `"${c.contact?.primaryPhone?.operator || ''}"`,
      c.hasMissingMustHave ? 'NO' : (c.mustHaveCount > 0 ? 'YES' : 'N/A'),
      `"${(c.missingMustHaves || []).map((m) => m.keyword).join(', ')}"`,
      `${c.coveragePercent}%`,
      `${c.matchedCount}/${c.totalPositive}`,
      `"${c.foundKeywords.map((k) => `${k.keyword}${k.mustHave ? ' [MUST-HAVE]' : ''} (${k.matches}x)`).join(', ')}"`,
      `"${c.missingSkills.map((k) => `${k.keyword}${k.mustHave ? ' [MUST-HAVE]' : ''}`).join(', ')}"`,
      `"${c.disqualifiers.map((d) => d.keyword).join(', ')}"`,
      c.computedStatus.toUpperCase(),
      c.isOverridden ? 'YES' : 'NO'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv_screening_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bulk ZIP download
  const downloadZipArchive = async (statusFilter) => {
    const targetList =
      statusFilter === 'starred'
        ? enrichedCandidates.filter((c) => c.isStarred)
        : enrichedCandidates.filter((c) => c.computedStatus === statusFilter);

    if (targetList.length === 0) {
      alert(`No candidates in ${statusFilter} pool.`);
      return;
    }

    const zip = new JSZip();
    const mainFolder = zip.folder(`${statusFilter}_candidates`);
    for (const c of targetList) {
      const file = fileMap.get(c.name);
      if (file) mainFolder.file(c.name, file);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${statusFilter}_candidates.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Extracted-text reader with auto-linkified URLs & emails and skill highlights (DOCX, and PDF fallback)
  const renderTextReader = (candidate) => (
    <div className="w-full h-full max-w-3xl overflow-y-auto p-8 bg-white text-slate-900 rounded-xl shadow-2xl">
      <div className="text-[11px] text-slate-400 font-mono mb-4 pb-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <span>DOCUMENT READER (.{candidate.fileType === 'PDF' ? 'PDF TEXT' : 'DOCX'})</span>
        <span className="flex items-center gap-2 font-sans">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-400" />
            Matched ({candidate.foundKeywords.length})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-200 ring-1 ring-rose-400" />
            Negative ({candidate.foundNegatives?.length || 0})
          </span>
          <span className="font-mono">{candidate.fullText?.length || 0} chars</span>
        </span>
      </div>
      <div className="text-xs leading-relaxed font-sans whitespace-pre-wrap text-slate-800 selection:bg-indigo-100">
        {highlightContent(
          candidate.fullText,
          candidate.foundKeywords,
          candidate.foundNegatives,
          'text-indigo-600 hover:text-indigo-800 underline font-medium transition-colors cursor-pointer'
        ) || 'No text extracted from this document.'}
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans antialiased">
      {/* 1. TOP HEADER (52px high, dark minimal theme) */}
      <header className="h-[52px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left branding and criteria preview */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-white leading-none">
                CV Screener
              </span>
              <a
                href="https://shakil2995.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9.5px] text-slate-400 hover:text-indigo-400 transition-colors font-medium block leading-tight mt-0.5"
                title="Made by Shakil Ahmed"
              >
                by Shakil Ahmed ↗
              </a>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Quick Criteria Pill */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60 transition-colors"
          >
            <span className="font-semibold text-slate-300">
              {positiveKeywords.length} Required Skills
            </span>
            {positiveKeywords.filter((k) => k.mustHave).length > 0 && (
              <span className="text-[10px] bg-amber-950/90 text-amber-300 border border-amber-700/60 px-1.5 py-0.2 rounded font-bold font-mono">
                ⭐ {positiveKeywords.filter((k) => k.mustHave).length} Must-Have
              </span>
            )}
            <span className="text-slate-500">•</span>
            <span>Cutoff: {passingThreshold}%</span>
          </button>

          {/* Bangladeshi Only Quick Switch */}
          <button
            onClick={() => setBangladeshiOnly((prev) => !prev)}
            className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
              bangladeshiOnly
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 shadow-xs'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
            title="Toggle Bangladeshi Only Dealbreaker (Rejects non-BD phone / foreign country)"
          >
            <span className="text-sm leading-none">🇧🇩</span>
            <span className="font-semibold">{bangladeshiOnly ? 'BD Only: ON' : 'BD Only: OFF'}</span>
          </button>
        </div>

        {/* Center: Global Counters / Live Screening Status */}
        {processing ? (
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/90 border border-indigo-500/40 px-3 py-1 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
              <span className="text-xs font-semibold text-indigo-300">
                Screening: {progress.current} / {progress.total}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({progress.percent}%)
              </span>
            </div>
            <div className="w-16 sm:w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <button
              onClick={cancelProcessing}
              className="px-2 py-0.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
              title="Stop screening and keep already parsed candidates"
            >
              <XCircle className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
        ) : candidates.length > 0 && (
          <div className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg text-xs font-semibold">
            {[
              { tab: 'all', label: `${poolCounts.all} Total`, idle: 'text-slate-300 border-transparent hover:bg-slate-700/60', active: 'bg-slate-600 text-white border-slate-500' },
              { tab: 'shortlisted', label: `${poolCounts.accepted} Shortlisted`, idle: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/80', active: 'bg-emerald-600 text-white border-emerald-500' },
              { tab: 'rejected', label: `${poolCounts.rejected} Rejected`, idle: 'bg-rose-950/80 text-rose-400 border-rose-800/40 hover:bg-rose-900/80', active: 'bg-rose-600 text-white border-rose-500' },
              ...(poolCounts.starred > 0
                ? [{ tab: 'starred', label: `★ ${poolCounts.starred}`, idle: 'bg-amber-950/80 text-amber-400 border-amber-800/40 hover:bg-amber-900/80', active: 'bg-amber-600 text-white border-amber-500' }]
                : []),
            ].map(({ tab, label, idle, active }) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                aria-pressed={sidebarTab === tab}
                className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${sidebarTab === tab ? active : idle}`}
                title={`Show ${tab === 'all' ? 'all' : tab} candidates`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Right action buttons */}
        <div className="flex items-center gap-2">
          {/* Criteria & Upload Button */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Open Screening Criteria & Resumes [C]"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Criteria & Files</span>
            {files.length > 0 && (
              <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 rounded-full font-mono">
                {files.length}
              </span>
            )}
          </button>

          {/* Keyboard Shortcuts Cheat Sheet Button */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
            title="Keyboard Shortcuts Reference [?]"
          >
            <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
            <kbd className="px-1 py-0.2 text-[9px] bg-white/10 text-white border border-white/20 rounded font-mono">?</kbd>
          </button>

          {/* Export Actions */}
          {candidates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => downloadZipArchive('accepted')}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                title="Download Shortlisted Resumes as ZIP"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ZIP</span>
              </button>

              <button
                onClick={exportCsvReport}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                title="Export CSV Summary"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          )}

          {/* Toggle Inspector Panel */}
          {selectedCandidate && (
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showInspector
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle Skill & Contact Inspector [I]"
            >
              {showInspector ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (SCREENING ROOM) */}
      <div className="flex-1 flex overflow-hidden bg-slate-950">
        {/* A. LEFT CANDIDATE ROSTER (Fixed 320px) */}
        <aside className="w-80 shrink-0 h-full flex flex-col bg-slate-900 border-r border-slate-800">
          {/* Segmented Filter Pills */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-900">
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 rounded-lg text-[11px] font-semibold text-slate-400">
              <button
                onClick={() => setSidebarTab('all')}
                className={`py-1 rounded-md transition-all text-center ${
                  sidebarTab === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'hover:text-slate-200'
                }`}
              >
                All ({poolCounts.all})
              </button>
              <button
                onClick={() => setSidebarTab('shortlisted')}
                className={`py-1 rounded-md transition-all text-center ${
                  sidebarTab === 'shortlisted'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'hover:text-emerald-400'
                }`}
              >
                Pass ({poolCounts.accepted})
              </button>
              <button
                onClick={() => setSidebarTab('rejected')}
                className={`py-1 rounded-md transition-all text-center ${
                  sidebarTab === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'hover:text-rose-400'
                }`}
              >
                Fail ({poolCounts.rejected})
              </button>
              <button
                onClick={() => setSidebarTab('starred')}
                className={`py-1 rounded-md transition-all text-center ${
                  sidebarTab === 'starred'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'hover:text-amber-400'
                }`}
              >
                ★ ({poolCounts.starred})
              </button>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="p-2.5 border-b border-slate-800 space-y-2 bg-slate-900/50">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter by name or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1 py-0.2 text-[9px] bg-slate-900 border border-slate-800 rounded text-slate-500 font-mono pointer-events-none">
                  /
                </kbd>
              )}
            </div>

            {/* Sort Dropdown and Live Cutoff */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-xs">
                <ArrowUpDown className="w-3 h-3 text-slate-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-transparent font-medium text-slate-300 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="score-desc" className="bg-slate-900">Score: High → Low</option>
                  <option value="score-asc" className="bg-slate-900">Score: Low → High</option>
                  <option value="coverage-desc" className="bg-slate-900">Coverage: High → Low</option>
                  <option value="name-asc" className="bg-slate-900">Name: A → Z</option>
                  <option value="name-desc" className="bg-slate-900">Name: Z → A</option>
                  <option value="starred-first" className="bg-slate-900">Starred First</option>
                </select>
              </div>

              {/* Threshold Slider */}
              <div
                className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg"
                title="Passing Score Cutoff Threshold"
              >
                <Sliders className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-300 font-mono">{passingThreshold}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={passingThreshold}
                  onChange={(e) => setPassingThreshold(Number(e.target.value))}
                  className="w-14 accent-indigo-500 cursor-pointer h-1"
                />
              </div>
            </div>

            {/* Skill Filter Pills */}
            {allSkills.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
                {selectedSkillFilter && (
                  <button
                    onClick={() => setSelectedSkillFilter(null)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold shrink-0"
                  >
                    Reset ×
                  </button>
                )}
                {allSkills.slice(0, 6).map((skill, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSkillFilter(selectedSkillFilter === skill ? null : skill)}
                    className={`px-1.5 py-0.5 rounded border shrink-0 font-medium transition-colors ${
                      selectedSkillFilter === skill
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Candidate Feed List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {candidates.length === 0 ? (
                  <div className="space-y-3">
                    <p className="font-medium text-slate-400">No CVs processed yet.</p>
                    <button
                      onClick={() => setShowSetupModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-indigo-950/50"
                    >
                      Upload Resumes
                    </button>
                  </div>
                ) : (
                  <p>No candidates match your filters.</p>
                )}
              </div>
            ) : (
              filteredCandidates.map((c) => {
                const isSelected = selectedCandidate?.id === c.id;
                const isAccepted = c.computedStatus === 'accepted';

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCandidateId(c.id)}
                    className={`relative rounded-xl p-3 cursor-pointer transition-all duration-150 border ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500/90 ring-1 ring-indigo-500/30 shadow-md'
                        : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600/80 shadow-xs'
                    }`}
                  >
                    {/* Row 1: Candidate Name & Original Filename + Top-Right Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-bold text-[9.5px] flex items-center justify-center shrink-0 font-mono select-none">
                          {getCandidateInitials(c.displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-xs font-bold truncate transition-colors ${
                              isSelected ? 'text-white' : 'text-slate-200 hover:text-white'
                            }`}
                            title={c.displayName}
                          >
                            {c.displayName}
                          </h3>
                          <p className="text-[10px] text-slate-400 truncate" title={c.name}>
                            {c.name}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 self-start">
                        {/* Star Favorite Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteCandidate(c.name);
                          }}
                          className="p-0.5 text-slate-400 hover:text-amber-400 transition-colors"
                          title="Toggle Favorite"
                        >
                          <Star
                            className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                              c.isStarred ? 'fill-amber-400 text-amber-400' : 'hover:text-amber-300'
                            }`}
                          />
                        </button>

                        {/* Match Score Pill */}
                        <span
                          className={`text-[11px] font-black px-2 py-0.5 rounded-lg font-mono tracking-tight shadow-xs border ${getScoreBadgeStyle(
                            isAccepted,
                            c.isOverridden
                          )}`}
                        >
                          {c.scorePercent}%
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Metadata Badges (File Type, Location, Experience, Skill Match Count) */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px]">
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300 font-mono">
                        {c.fileType}
                      </span>

                      {/* Location badge */}
                      {c.location?.displayLocation && (
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded font-mono border inline-flex items-center gap-1 ${
                            c.location.isForeign
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800/50'
                              : 'bg-slate-800/90 text-slate-300 border-slate-700/60'
                          }`}
                          title={`Detected Location: ${c.location.displayLocation}`}
                        >
                          <span>{c.location.isForeign ? '🌐' : '🇧🇩'}</span>
                          <span className="truncate max-w-[100px]">{c.location.displayLocation}</span>
                        </span>
                      )}

                      {/* Experience badge - only show for medium or high confidence */}
                      {c.experience && c.experience.level !== 'Not Specified' && c.experience.confidence !== 'low' && (
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded font-mono border inline-flex items-center gap-1 ${
                            c.experience.color === 'purple'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800/40'
                              : c.experience.color === 'emerald'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/40'
                              : c.experience.color === 'amber'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800/40'
                              : 'bg-indigo-950/80 text-indigo-300 border-indigo-800/40'
                          }`}
                        >
                          <span className="w-1 h-1 rounded-full bg-current opacity-70" />
                          {c.experience.badgeLabel}
                        </span>
                      )}

                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded font-mono border inline-flex items-center gap-1 ${getCoverageBadgeStyle(
                          c.coveragePercent
                        )}`}
                        title={`${c.coveragePercent}% Skill Coverage (${c.matchedCount} of ${c.totalPositive} skills)`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current opacity-70" />
                        {c.matchedCount}/{c.totalPositive} skills ({c.coveragePercent}%)
                      </span>
                    </div>

                    {/* Dealbreaker Alert Badge */}
                    {c.hasDisqualifier && (
                      <div className="mt-2 text-[10px] text-rose-300 font-medium bg-rose-950/60 border border-rose-800/50 px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">Disqualified: {c.disqualifiers.map((d) => d.keyword).join(', ')}</span>
                      </div>
                    )}

                    {/* Missing Must-Have Warning Badge */}
                    {c.hasMissingMustHave && !c.hasDisqualifier && (
                      <div className="mt-2 text-[10px] text-amber-300 font-medium bg-amber-950/60 border border-amber-700/50 px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Missing Must-Have: {c.missingMustHaves.map((m) => m.keyword).join(', ')}</span>
                      </div>
                    )}

                    {/* Row 3: Matched Skill Tags (Single Row) */}
                    {c.foundKeywords.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 overflow-hidden flex-nowrap">
                        {c.foundKeywords.slice(0, 3).map((k, idx) => (
                          <span
                            key={idx}
                            className={`text-[9.5px] px-2 py-0.5 rounded-md border font-medium truncate shrink-0 max-w-[95px] flex items-center gap-1 ${
                              k.mustHave
                                ? 'bg-amber-950/50 text-amber-200 border-amber-600/50'
                                : 'bg-slate-900/90 text-slate-300 border-slate-700/70'
                            }`}
                            title={`${k.keyword}${k.mustHave ? ' (Must-Have Met)' : ''}`}
                          >
                            {k.mustHave && <span className="text-amber-400">⭐</span>}
                            <span>{k.keyword}</span>
                          </span>
                        ))}
                        {c.foundKeywords.length > 3 && (
                          <span className="text-[9.5px] bg-slate-900/60 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-700/50 font-mono shrink-0">
                            +{c.foundKeywords.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-2 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-400 flex items-center justify-between flex-wrap gap-1">
            <span>{filteredCandidates.length} of {candidates.length} candidates</span>
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-slate-400">
              <span className="inline-flex items-center gap-0.5" title="Navigate candidates (J: Prev, K: Next)">
                <kbd className="px-1 py-0.2 bg-white/10 border border-white/15 rounded text-white text-[9px]">J</kbd> Prev •
                <kbd className="px-1 py-0.2 bg-white/10 border border-white/15 rounded text-white text-[9px]">K</kbd> Next
              </span>
              <span className="inline-flex items-center gap-0.5" title="Shortlist candidate">
                <kbd className="px-1 py-0.2 bg-white/10 border border-white/15 rounded text-white text-[9px]">A</kbd> Pass
              </span>
              <span className="inline-flex items-center gap-0.5" title="Reject candidate">
                <kbd className="px-1 py-0.2 bg-white/10 border border-white/15 rounded text-white text-[9px]">R</kbd> Fail
              </span>
              <span className="inline-flex items-center gap-0.5" title="Star candidate">
                <kbd className="px-1 py-0.2 bg-white/10 border border-white/15 rounded text-white text-[9px]">S</kbd> Star
              </span>
            </div>
          </div>
        </aside>

        {/* B. PRIMARY RESUME STAGE (Flex-1) */}
        <main className="flex-1 h-full flex flex-col overflow-hidden bg-slate-950">
          {selectedCandidate ? (
            <>
              {/* Stage Header: Candidate Name & Triage Action Bar */}
              <div className="relative h-[52px] px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-10">
                {/* Candidate title & Filename */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2 max-w-[calc(50%-90px)]">
                  <div className="min-w-0">
                    <h2 className="text-sm md:text-base font-extrabold text-white truncate" title={selectedCandidate.displayName}>
                      {selectedCandidate.displayName}
                    </h2>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5" title={selectedCandidate.name}>
                      {selectedCandidate.name}
                    </p>
                  </div>
                </div>

                {/* Center: Prev/Next Buttons - FIXED ANCHORED IN PLACE */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0 z-20 shadow-xs">
                  <button
                    onClick={selectPreviousCandidate}
                    disabled={currentIndex <= 0}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                    title="Previous Candidate [J or ↑]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-white/10 border border-white/15 rounded text-white font-mono">J</kbd>
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300 px-2 min-w-[70px] text-center select-none">
                    {currentIndex + 1} / {filteredCandidates.length}
                  </span>
                  <button
                    onClick={selectNextCandidate}
                    disabled={currentIndex >= filteredCandidates.length - 1}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1"
                    title="Next Candidate [K or ↓]"
                  >
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-white/10 border border-white/15 rounded text-white font-mono">K</kbd>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: Rapid Triage Decision Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-auto z-10">
                  {/* Shortlist Button */}
                  <button
                    onClick={() => setCandidateDecision('accepted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                      selectedCandidate.computedStatus === 'accepted'
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                        : 'bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700'
                    }`}
                    title="Shortlist Candidate [A]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Shortlist</span>
                    <kbd className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-white/15 border border-white/20 text-white shadow-2xs">A</kbd>
                  </button>

                  {/* Reject Button */}
                  <button
                    onClick={() => setCandidateDecision('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                      selectedCandidate.computedStatus === 'rejected'
                        ? 'bg-rose-600 text-white ring-2 ring-rose-400/40'
                        : 'bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700'
                    }`}
                    title="Reject Candidate [R]"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                    <kbd className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-white/15 border border-white/20 text-white shadow-2xs">R</kbd>
                  </button>

                  {/* Star/Favorite Toggle */}
                  <button
                    onClick={() => toggleFavoriteCandidate(selectedCandidate.name)}
                    className={`px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                      selectedCandidate.isStarred
                        ? 'bg-amber-950/80 border-amber-600/50 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                    }`}
                    title="Star / Favorite Candidate [S]"
                  >
                    <Star className={`w-4 h-4 ${selectedCandidate.isStarred ? 'fill-amber-400' : ''}`} />
                    <kbd className="px-1 py-0.2 text-[9px] font-mono rounded bg-white/15 border border-white/20 text-white shadow-2xs">S</kbd>
                  </button>



                  {/* PDF view toggle: original PDF vs extracted text with skill highlights */}
                  {selectedCandidate.fileType === 'PDF' && (
                    <button
                      onClick={() => setPdfViewMode(pdfViewMode === 'original' ? 'highlighted' : 'original')}
                      className={`p-1.5 rounded-lg border transition-all text-xs ${
                        pdfViewMode === 'highlighted'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                      }`}
                      title={pdfViewMode === 'highlighted' ? 'Switch to native PDF viewer [H]' : 'Show skill highlights on PDF [H]'}
                    >
                      <Highlighter className="w-4 h-4" />
                    </button>
                  )}

                  {/* Open in New Tab Button */}
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                      title="Open full PDF in new browser tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Download Button */}
                  <button
                    onClick={() => downloadSingleCV(selectedCandidate.name)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                    title="Download original file"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {/* Inspector Panel Toggle */}
                  <button
                    onClick={() => setShowInspector(!showInspector)}
                    className={`p-1.5 rounded-lg border transition-all text-xs ${
                      showInspector
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                    }`}
                    title={showInspector ? 'Hide Inspector [I]' : 'Show Inspector [I]'}
                  >
                    {showInspector ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Stage Body: Distraction-Free Document Canvas */}
              <div className="flex-1 overflow-hidden bg-slate-900/60 p-3 flex justify-center">
                {selectedCandidate.fileType !== 'PDF' ? (
                  renderTextReader(selectedCandidate)
                ) : pdfViewMode === 'highlighted' && fileMap.get(selectedCandidate.name) ? (
                  <div className="w-full h-full max-w-5xl">
                    <PdfHighlightViewer
                      key={selectedCandidate.name}
                      file={fileMap.get(selectedCandidate.name)}
                      positives={selectedCandidate.foundKeywords}
                      negatives={selectedCandidate.foundNegatives}
                      fallback={renderTextReader(selectedCandidate)}
                    />
                  </div>
                ) : pdfUrl ? (
                  <div className="w-full h-full max-w-5xl rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-800">
                    {/* Embed with #toolbar=0&navpanes=0 and allow popups so external links escape smoothly */}
                    <iframe
                      src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-full border-0 bg-white"
                      title="CV Resume Preview"
                      allow="popups; popups-to-escape-sandbox"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    Loading PDF...
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="p-4 bg-slate-900 rounded-2xl mb-3 border border-slate-800 text-slate-400">
                <FileText className="w-10 h-10" />
              </div>
              <h3 className="text-sm font-bold text-slate-300 mb-1">
                No Candidate Selected
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Click a candidate from the left roster or upload your resumes to begin screening.
              </p>
              <button
                onClick={() => setShowSetupModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors shadow-xs mb-4 cursor-pointer"
              >
                Open Criteria & Files
              </button>
              <div className="text-[11px] text-slate-500">
                Created by{' '}
                <a
                  href="https://shakil2995.github.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline font-medium"
                >
                  Shakil Ahmed ↗
                </a>
              </div>
            </div>
          )}
        </main>

        {/* C. RIGHT SKILL & SCORE INSPECTOR (340px, Toggleable) */}
        {showInspector && selectedCandidate && (
          <aside className="w-[340px] shrink-0 h-full flex flex-col bg-slate-900 border-l border-slate-800 animate-in slide-in-from-right-3 duration-150">
            {/* Inspector Header */}
            <div className="h-[52px] px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Skill Breakdown
                </h3>
              </div>
              <button
                onClick={() => setShowInspector(false)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded"
                title="Collapse Inspector [I]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Score summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className={`border p-2.5 rounded-xl ${
                    selectedCandidate.isOverridden
                      ? 'bg-purple-950/40 border-purple-800/50 text-purple-300'
                      : selectedCandidate.computedStatus === 'accepted'
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Match</span>
                  <div className="text-xl font-black font-mono mt-0.5">
                    {selectedCandidate.scorePercent}%
                  </div>
                  <p className="text-[9px] opacity-75">Overall</p>
                </div>

                <div
                  className={`border p-2.5 rounded-xl ${getCoverageCardStyle(
                    selectedCandidate.coveragePercent
                  )}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Coverage</span>
                  <div className="text-xl font-black font-mono mt-0.5">
                    {selectedCandidate.coveragePercent}%
                  </div>
                  <p className="text-[9px] opacity-75">
                    {selectedCandidate.matchedCount}/{selectedCandidate.totalPositive} skills
                  </p>
                  <div className="w-full bg-black/40 rounded-full h-1 mt-1.5 overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getCoverageBarColor(
                        selectedCandidate.coveragePercent
                      )}`}
                      style={{ width: `${selectedCandidate.coveragePercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-purple-950/40 border border-purple-800/50 p-2.5 rounded-xl text-purple-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Depth</span>
                  <div className="text-xl font-black text-purple-300 font-mono mt-0.5">
                    {selectedCandidate.depthScore}
                  </div>
                  <p className="text-[9px] opacity-75">Freq pts</p>
                </div>
              </div>

              {/* Direct Candidate Contact & Outreach Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Candidate Outreach & Location
                </h4>

                {/* Location / Country row */}
                <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${selectedCandidate.location?.isForeign ? 'text-rose-400' : 'text-indigo-400'}`} />
                    <div className="min-w-0">
                      <div className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                        <span>Location / Country</span>
                        {selectedCandidate.location?.isBangladesh && (
                          <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 px-1 rounded font-bold">
                            🇧🇩 BD Verified
                          </span>
                        )}
                        {selectedCandidate.location?.isForeign && (
                          <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800/40 px-1 rounded font-bold">
                            🌐 Foreign Location
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate block">
                        {selectedCandidate.location?.displayLocation || (selectedCandidate.location?.country ? selectedCandidate.location.country : 'Not Specified')}
                      </span>
                    </div>
                  </div>
                  {selectedCandidate.location?.displayLocation && (
                    <button
                      onClick={() => copyToClipboard(selectedCandidate.location.displayLocation, 'Location')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy Location"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Email row */}
                {selectedCandidate.contact?.primaryEmail && (
                  <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[9px] text-slate-500 font-semibold uppercase">Email</div>
                        <a
                          href={`mailto:${selectedCandidate.contact.primaryEmail}`}
                          className="text-xs font-semibold text-slate-200 hover:text-indigo-300 transition-colors truncate block"
                          title="Click to compose email"
                        >
                          {selectedCandidate.contact.primaryEmail}
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedCandidate.contact.primaryEmail, 'Email')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy Email Address"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Bangladeshi / Intl Phone row */}
                {selectedCandidate.contact?.primaryPhone && (
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className={`w-3.5 h-3.5 shrink-0 ${selectedCandidate.contact.primaryPhone.isBangladeshi ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <div className="min-w-0">
                          <div className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                            <span>Phone</span>
                            {selectedCandidate.contact.primaryPhone.operator && (
                              <span className={`text-[9px] px-1 rounded font-normal ${
                                selectedCandidate.contact.primaryPhone.isBangladeshi ? 'bg-slate-800 text-slate-400' : 'bg-rose-950 text-rose-300'
                              }`}>
                                {selectedCandidate.contact.primaryPhone.operator}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-200 block font-mono whitespace-nowrap">
                            {selectedCandidate.contact.primaryPhone.display}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedCandidate.contact.primaryPhone.raw, 'Phone Number')}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Copy Phone Number"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* WhatsApp Button on Next Line */}
                    <a
                      href={selectedCandidate.contact.primaryPhone.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full mt-2 py-1.5 px-3 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg border border-emerald-800/60 transition-all text-xs flex items-center justify-center gap-1.5 font-semibold shadow-xs"
                      title="Open WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open WhatsApp Chat</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Experience & Seniority Breakdown Card */}
              {selectedCandidate.experience && selectedCandidate.experience.level !== 'Not Specified' && selectedCandidate.experience.confidence !== 'low' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      Experience & Seniority
                    </span>
                    <span className="text-[10px] text-indigo-400 font-medium font-mono">
                      {selectedCandidate.experience.yearsDisplay}
                    </span>
                  </h4>
                  <div className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-xs font-bold text-slate-200">{selectedCandidate.experience.level}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {selectedCandidate.experience.confidence} confidence
                    </span>
                  </div>
                  {selectedCandidate.experience.sourceSnippet && (
                    <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/60 text-[11px] font-mono text-slate-400">
                      <span className="text-[9px] uppercase font-sans font-bold text-slate-500 block mb-0.5">Calculated from statement:</span>
                      &quot;{selectedCandidate.experience.sourceSnippet}&quot;
                    </div>
                  )}
                </div>
              )}

              {/* Dealbreaker Alert */}
              {selectedCandidate.hasDisqualifier && (
                <div className="bg-rose-950/80 border border-rose-800/80 p-3 rounded-xl text-xs text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-200">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Dealbreaker Triggered
                  </div>
                  <p className="text-[11px] text-rose-300/80">
                    Matched: &quot;{selectedCandidate.disqualifiers.map((d) => d.keyword).join(', ')}&quot;.
                    Candidate automatically routed to Rejected pool.
                  </p>
                </div>
              )}

              {/* Missing Must-Have Alert */}
              {selectedCandidate.hasMissingMustHave && (
                <div className="bg-amber-950/80 border border-amber-700/80 p-3 rounded-xl text-xs text-amber-200 space-y-1 shadow-sm">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Missing Must-Have Criteria ({selectedCandidate.missingMustHaves.length})
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Missing required must-have skill(s):{' '}
                    <strong>{selectedCandidate.missingMustHaves.map((m) => m.keyword).join(', ')}</strong>.
                    Candidate cannot be shortlisted automatically.
                  </p>
                </div>
              )}

              {/* Matched Skills Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Matched Skills ({selectedCandidate.foundKeywords.length})
                  </h4>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${getCoverageBadgeStyle(
                      selectedCandidate.coveragePercent
                    )}`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current opacity-75" />
                    {selectedCandidate.coveragePercent}% Coverage
                  </span>
                </div>
                {selectedCandidate.foundKeywords.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-950 p-3 rounded-xl text-center border border-slate-800">
                    No positive skills detected.
                  </p>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2">Skill</th>
                          <th className="p-2">Type</th>
                          <th className="p-2 text-center">Hits</th>
                          <th className="p-2 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {selectedCandidate.foundKeywords.map((k, i) => (
                          <tr key={i}>
                            <td className="p-2 font-bold text-slate-200 flex items-center gap-1.5">
                              {k.mustHave && (
                                <span className="text-amber-400" title="Must-Have Skill Met">⭐</span>
                              )}
                              <span>{k.keyword}</span>
                            </td>
                            <td className="p-2 text-[10px] text-slate-400">
                              <span className="block">{CATEGORY_LABELS[k.category] || k.category}</span>
                              {k.mustHave && (
                                <span className="text-[9px] text-amber-400 font-bold">Must-Have</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-slate-300">
                              {k.matches}×
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-400">
                              +{k.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Missing Skills List */}
              {selectedCandidate.missingSkills.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Missing Skills ({selectedCandidate.missingSkills.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate.missingSkills.map((k) => (
                      <span
                        key={k.id || k.keyword}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                          k.mustHave
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700 shadow-xs font-bold'
                            : 'bg-rose-950/40 text-rose-400 border-rose-900/40'
                        }`}
                      >
                        {k.mustHave ? '⭐ Missing Must-Have: ' : '✕ '}
                        {k.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate Profiles & Detected Links */}
              {selectedCandidate.links && selectedCandidate.links.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                      Profiles & Links ({selectedCandidate.links.length})
                    </span>
                    <span className="text-[10px] text-indigo-400 font-medium">Opens in new tab</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCandidate.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors group cursor-pointer"
                        title={`Open ${link.url} in new tab`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="text-indigo-400">
                            {renderLinkIcon(link.type, 'w-3.5 h-3.5 shrink-0')}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 truncate">{link.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{link.url}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Snippets */}
              {selectedCandidate.snippets && selectedCandidate.snippets.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Match Snippets
                  </h4>
                  <div className="space-y-2">
                    {selectedCandidate.snippets.map((snip, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300"
                      >
                        <span className="text-[9px] font-bold text-indigo-400 uppercase font-sans block mb-0.5">
                          {snip.keyword}:
                        </span>
                        &quot;{linkifyContent(snip.snippet)}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset manual override button */}
              {selectedCandidate.isOverridden && (
                <button
                  onClick={() => resetManualOverride(selectedCandidate.name)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Manual Decision
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 3. DEDICATED SETUP & UPLOAD MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 md:p-8">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl w-full max-w-4xl lg:max-w-5xl h-[85vh] min-h-[580px] max-h-[820px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-7 py-4.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Screening Criteria & Resumes
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure your required skills, dealbreakers, and upload candidates
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSetupModal(false)}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white rounded-xl transition-colors flex items-center gap-2 hover:bg-slate-800 cursor-pointer"
                title="Close (Esc)"
              >
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 text-white border border-white/20 rounded">ESC</kbd>
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="border-b border-slate-800 bg-slate-950 px-5 sm:px-7">
              <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto h-13 min-h-[52px] -mb-px scrollbar-none [::-webkit-scrollbar]:hidden">
                <button
                  onClick={() => setSetupTab('jd')}
                  className={`px-3.5 sm:px-4 h-full border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer font-semibold text-xs sm:text-sm rounded-t-xl ${
                    setupTab === 'jd'
                      ? 'border-indigo-500 text-white bg-indigo-500/10'
                      : 'border-transparent text-indigo-400/90 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>✨ Auto-Extract from JD</span>
                </button>
                <button
                  onClick={() => setSetupTab('skills')}
                  className={`px-3.5 sm:px-4 h-full border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer font-semibold text-xs sm:text-sm rounded-t-xl ${
                    setupTab === 'skills'
                      ? 'border-indigo-500 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span>1. Required Skills ({positiveKeywords.length})</span>
                </button>
                <button
                  onClick={() => setSetupTab('disqualifiers')}
                  className={`px-3.5 sm:px-4 h-full border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer font-semibold text-xs sm:text-sm rounded-t-xl ${
                    setupTab === 'disqualifiers'
                      ? 'border-rose-500 text-white bg-rose-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span>2. Dealbreakers ({negativeKeywords.length})</span>
                </button>
                <button
                  onClick={() => setSetupTab('upload')}
                  className={`px-3.5 sm:px-4 h-full border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer font-semibold text-xs sm:text-sm rounded-t-xl ${
                    setupTab === 'upload'
                      ? 'border-emerald-500 text-white bg-emerald-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span>3. Upload Resumes ({files.length})</span>
                </button>
              </div>
            </div>

            {/* Modal Tab Content */}
            <div className="p-6 sm:p-8 pb-14 overflow-y-auto flex-1 space-y-6 sm:space-y-7 bg-slate-900">
              {/* TAB 0: AUTO-EXTRACT FROM JOB DESCRIPTION */}
              {setupTab === 'jd' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Wand2 className="w-4.5 h-4.5 text-indigo-400" />
                          Paste Job Description (JD)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Auto-extracts required tech stacks, tools, methodologies, and smart weights.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 font-semibold mr-1">Load Demo:</span>
                        {SAMPLE_JDS.map((sample, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setJdInputText(sample.text);
                              handleExtractFromJd(sample.text);
                            }}
                            className="text-xs bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                          >
                            {sample.title.split(' ')[1]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={jdInputText}
                      onChange={(e) => {
                        setJdInputText(e.target.value);
                        if (e.target.value.trim().length > 30) {
                          handleExtractFromJd(e.target.value);
                        }
                      }}
                      rows={6}
                      placeholder="Paste full Job Description here (e.g. We are looking for a Senior Flutter/React Developer with 4+ years of experience in Dart, BLoC, REST APIs, Firebase...)"
                      className="w-full text-xs sm:text-sm font-sans p-4 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500 font-mono">
                        {jdInputText.trim() ? `${jdInputText.trim().split(/\s+/).length} words entered` : 'Ready for input'}
                      </span>
                      <button
                        onClick={() => handleExtractFromJd(jdInputText)}
                        disabled={!jdInputText.trim() || isExtractingJd}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>{isExtractingJd ? 'Extracting...' : 'Scan & Extract Skills'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Extracted Results Sheet */}
                  {extractedJdResult && (
                    <div className="bg-slate-950 p-5 sm:p-6 rounded-2xl border border-indigo-500/30 space-y-5 animate-in fade-in-50 duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-bold text-white">
                            {extractedJdResult.stats.totalFound} Skills Identified in JD
                          </span>
                          <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2.5 py-0.5 rounded-full font-mono font-bold">
                            {extractedJdResult.skills.filter((s) => s.mustHave).length} Must-Haves
                          </span>
                        </div>

                        <button
                          onClick={handleApplyJdCriteria}
                          className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                          <Check className="w-4.5 h-4.5" />
                          <span>Apply to Scoring Matrix</span>
                        </button>
                      </div>

                      {/* Skills interactive chips grid */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                          Review Extracted Skills (Toggle on/off, adjust weights, or mark Must-Have):
                        </span>
                        <div className="flex flex-wrap gap-2.5 p-1 pb-2">
                          {extractedJdResult.skills.map((skill, idx) => (
                            <div
                              key={skill.id}
                              onClick={() => toggleJdSkillSelection(idx)}
                              className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer select-none shadow-xs ${
                                skill.selected
                                  ? skill.importance === 'required'
                                    ? 'bg-indigo-950/90 text-indigo-200 border-indigo-500/80 ring-1 ring-indigo-500/30'
                                    : 'bg-slate-800 text-slate-200 border-slate-600'
                                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                  skill.selected ? 'bg-indigo-500 text-white font-bold' : 'border border-slate-600'
                                }`}
                              >
                                {skill.selected && '✓'}
                              </div>
                              <span className="font-semibold">{skill.keyword}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                {CATEGORY_LABELS[skill.category] || skill.category}
                              </span>

                              {/* Must Have Toggle */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleJdSkillMustHave(idx);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                                  skill.mustHave
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-1 ring-amber-400/50'
                                    : 'bg-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-700 border border-slate-700/60'
                                }`}
                                title="Toggle Must-Have requirement for this skill"
                              >
                                {skill.mustHave ? '⭐ Must-Have' : '+ Must-Have'}
                              </button>

                              {/* Weight controls */}
                              <div
                                className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-slate-700/60"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] font-mono font-bold text-indigo-300 mr-0.5">W:{skill.weight}</span>
                                <button
                                  onClick={() => updateJdSkillWeight(idx, -1)}
                                  className="text-slate-400 hover:text-white px-1 py-0.5 text-xs font-bold hover:bg-slate-700 rounded transition-colors"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => updateJdSkillWeight(idx, 1)}
                                  className="text-slate-400 hover:text-white px-1 py-0.5 text-xs font-bold hover:bg-slate-700 rounded transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Suggested Disqualifiers if found */}
                      {extractedJdResult.suggestedDisqualifiers && extractedJdResult.suggestedDisqualifiers.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-2">
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                            Potential Dealbreakers Detected in JD:
                          </span>
                          <div className="flex flex-wrap gap-2.5">
                            {extractedJdResult.suggestedDisqualifiers.map((dis, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 rounded-xl bg-rose-950 text-rose-300 border border-rose-800 text-xs font-medium flex items-center gap-2"
                              >
                                <ShieldAlert className="w-4 h-4 text-rose-400" />
                                <span>{dis.keyword}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: REQUIRED SKILLS */}
              {setupTab === 'skills' && (
                <div className="space-y-6">
                  {/* Quick Presets Catalog */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Quick Add Skills by Role
                      </span>
                      <span className="text-xs text-slate-500">
                        Click any chip to toggle on/off
                      </span>
                    </div>

                    {/* Category Selector Pills */}
                    <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs sm:text-xs">
                      {SKILL_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setPresetCategoryTab(cat.id)}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-2 cursor-pointer ${
                              presetCategoryTab === cat.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                          >
                            {Icon && <Icon className="w-4 h-4" />}
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Presets Chips Grid */}
                    <div className="flex flex-wrap gap-2 p-3 sm:p-3.5 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                      {displayedPresets.map((preset, idx) => {
                        const isAdded = positiveKeywords.some(
                          (k) => k.keyword.toLowerCase() === preset.keyword.toLowerCase()
                        );

                        return (
                          <button
                            key={idx}
                            onClick={() => togglePresetSkill(preset)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 cursor-pointer ${
                              isAdded
                                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 shadow-xs ring-1 ring-indigo-500/40'
                                : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600'
                            }`}
                          >
                            {isAdded ? (
                              <Check className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{preset.keyword}</span>
                            <span className="text-[10px] text-slate-500 font-mono">W:{preset.weight}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add Custom Skill Form */}
                  <div className="p-5 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                    <span className="text-xs sm:text-sm font-bold text-slate-300 block">Add Custom Skill</span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        placeholder="Skill keyword (e.g. Flutter, C++, GraphQL, AWS)"
                        value={newPosKeyword}
                        onChange={(e) => setNewPosKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPositiveKeyword()}
                        className="flex-1 min-w-[200px] px-3.5 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={newPosCategory}
                        onChange={(e) => setNewPosCategory(e.target.value)}
                        className="px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="technical">💻 Technical (1.2×)</option>
                        <option value="soft">🤝 Soft Skill (1.0×)</option>
                        <option value="cert">📜 Certification (1.1×)</option>
                      </select>
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                        <span className="text-xs text-slate-400 font-bold">Weight:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newPosWeight}
                          onChange={(e) => setNewPosWeight(e.target.value)}
                          className="w-8 text-xs sm:text-sm bg-transparent text-center font-bold text-white focus:outline-none"
                        />
                      </div>

                      {/* Must-Have Toggle Checkbox */}
                      <label className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs sm:text-sm cursor-pointer select-none transition-all ${
                        newPosMustHave
                          ? 'bg-slate-900 text-amber-200 border-amber-500/60 shadow-xs'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}>
                        <input
                          type="checkbox"
                          checked={newPosMustHave}
                          onChange={(e) => setNewPosMustHave(e.target.checked)}
                          className="sr-only"
                        />
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                          newPosMustHave
                            ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-400/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          ⭐ Must-Have
                        </span>
                        <span className="font-semibold">{newPosMustHave ? 'Yes' : 'No'}</span>
                      </label>

                      <button
                        onClick={addPositiveKeyword}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                      >
                        Add Skill
                      </button>
                    </div>
                  </div>

                  {/* Active Skills List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                          Active Required Skills ({positiveKeywords.length}):
                        </span>
                        {positiveKeywords.filter((k) => k.mustHave).length > 0 && (
                          <span className="text-xs bg-indigo-950 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold font-mono">
                            ⭐ {positiveKeywords.filter((k) => k.mustHave).length} Must-Have
                          </span>
                        )}
                      </div>
                      {positiveKeywords.length > 0 && (
                        <button
                          onClick={() => setPositiveKeywords([])}
                          className="text-xs text-rose-400 hover:underline font-medium cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {positiveKeywords.length === 0 ? (
                      <div className="p-5 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-center text-xs sm:text-sm text-slate-500">
                        No required skills active yet. Click any skill chip above or add a custom keyword to start.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {positiveKeywords.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-2 text-xs sm:text-xs px-3 py-1.5 rounded-xl border font-medium transition-all bg-slate-800 text-slate-200 border-slate-700 shadow-xs"
                          >
                            <span className="font-bold">{item.keyword}</span>
                            <span className="text-[10px] text-indigo-400 font-mono">W:{item.weight}</span>
                            <button
                              type="button"
                              onClick={() => toggleSkillMustHave(item.id)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer shadow-xs ${
                                item.mustHave
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-1 ring-amber-400/50'
                                  : 'bg-slate-700/80 text-slate-400 hover:text-amber-300 hover:bg-slate-700'
                              }`}
                              title="Click to toggle Must-Have requirement (candidate must match this to be shortlisted)"
                            >
                              {item.mustHave ? '⭐ Must-Have' : '+ Must-Have'}
                            </button>
                            <button
                              onClick={() => removePositiveKeyword(item.id)}
                              className="text-slate-500 hover:text-rose-400 ml-0.5 cursor-pointer"
                              title="Remove skill"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DEALBREAKERS */}
              {setupTab === 'disqualifiers' && (
                <div className="space-y-6">
                  {/* Bangladeshi Candidates Only Toggle Card */}
                  <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                    bangladeshiOnly
                      ? 'bg-emerald-950/40 border-emerald-600/70 shadow-sm'
                      : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">🇧🇩</span>
                          <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                            Bangladeshi Candidates Only
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            bangladeshiOnly
                              ? 'bg-emerald-900/90 text-emerald-300 border-emerald-600/60'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {bangladeshiOnly ? 'ON (Default)' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                          Filters candidates based on <strong>Bangladeshi Phone Number</strong> (013–019, +880) and <strong>Country</strong>.
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed space-y-1 pt-1">
                          • Rejects candidates whose resume mentions a <strong>foreign country</strong> (e.g. India, USA, Pakistan, Nigeria).
                          <br />
                          • Rejects candidates with <strong>foreign phone numbers</strong> (+91, +1, +44, etc.) if no BD phone is found.
                          <br />
                          • Resumes with <strong>empty/unspecified country</strong> or <strong>no phone number</strong> are <em>accepted</em> (empty is ok).
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={bangladeshiOnly}
                          onChange={(e) => setBangladeshiOnly(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Common Dealbreaker Presets */}
                  <div className="space-y-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider block">
                      Quick Add Common Dealbreakers:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DISQUALIFIER_PRESETS.map((preset, idx) => {
                        const isAdded = negativeKeywords.some(
                          (k) => k.keyword.toLowerCase() === preset.toLowerCase()
                        );
                        return (
                          <button
                            key={idx}
                            onClick={() => togglePresetDisqualifier(preset)}
                            className={`px-3 py-1.5 rounded-xl text-xs sm:text-xs font-medium border transition-all flex items-center gap-2 cursor-pointer ${
                              isAdded
                                ? 'bg-rose-950 text-rose-200 border-rose-600/80 shadow-xs ring-1 ring-rose-600/40'
                                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                            }`}
                          >
                            {isAdded ? (
                              <Check className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{preset}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                    <span className="text-xs sm:text-sm font-bold text-slate-300 block">Add Dealbreaker or Penalty</span>
                    <div className="flex flex-wrap gap-2.5">
                      <input
                        type="text"
                        placeholder="Keyword (e.g. unauthorized, visa required)"
                        value={newNegKeyword}
                        onChange={(e) => setNewNegKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addNegativeKeyword()}
                        className="flex-1 min-w-[200px] px-3.5 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={newNegType}
                        onChange={(e) => setNewNegType(e.target.value)}
                        className="px-3 py-2 text-xs sm:text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="disqualifier">🚫 Dealbreaker (Instant Fail)</option>
                        <option value="penalty">⚠️ Soft Penalty (-5 pts)</option>
                      </select>
                      {newNegType === 'penalty' && (
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                          <span className="text-xs text-slate-400 font-bold">-pts:</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={newNegPenalty}
                            onChange={(e) => setNewNegPenalty(Number(e.target.value))}
                            className="w-8 text-xs sm:text-sm bg-transparent text-center font-bold text-white focus:outline-none"
                          />
                        </div>
                      )}
                      <button
                        onClick={addNegativeKeyword}
                        className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Active Negative List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                        Active Dealbreakers & Penalties ({negativeKeywords.length + (bangladeshiOnly ? 1 : 0)}):
                      </span>
                      {negativeKeywords.length > 0 && (
                        <button
                          onClick={() => setNegativeKeywords([])}
                          className="text-xs text-rose-400 hover:underline font-medium cursor-pointer"
                        >
                          Clear Custom
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {bangladeshiOnly && (
                        <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border bg-emerald-950/60 text-emerald-300 border-emerald-800/60 font-medium">
                          <span>🇧🇩</span>
                          <span className="font-bold">Bangladeshi Only</span>
                          <span className="text-[10px] opacity-75">Dealbreaker</span>
                          <button
                            onClick={() => setBangladeshiOnly(false)}
                            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                            title="Disable Bangladeshi Only requirement"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}

                      {negativeKeywords.map((neg) => (
                        <span
                          key={neg.id}
                          className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border font-medium ${
                            neg.type === 'disqualifier'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          <span className="font-bold">{neg.keyword}</span>
                          <span className="text-[10px] opacity-75">
                            {neg.type === 'disqualifier' ? 'Dealbreaker' : `-${neg.penalty}pts`}
                          </span>
                          <button
                            onClick={() => removeNegativeKeyword(neg.id)}
                            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}

                      {!bangladeshiOnly && negativeKeywords.length === 0 && (
                        <div className="p-4 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-center text-xs sm:text-sm text-slate-500 w-full">
                          No dealbreakers configured. Candidates will be judged solely on positive match score.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: UPLOAD RESUMES */}
              {setupTab === 'upload' && (
                <div className="space-y-5 flex flex-col">
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center shrink-0 ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-950/30'
                        : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-slate-950'
                    }`}
                  >
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.zip"
                      onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                      className="hidden"
                      id="modal-cv-file-input"
                    />
                    <label htmlFor="modal-cv-file-input" className="cursor-pointer flex flex-col items-center">
                      <div className="p-3.5 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-3 border border-indigo-500/20">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-base sm:text-lg font-bold text-white mb-1">
                        Click or Drop PDF, DOCX, or ZIP Archives
                      </span>
                      <span className="text-xs sm:text-sm text-slate-400">
                        Bulk upload supported • Automatic ZIP unpacking
                      </span>
                    </label>
                  </div>

                  {/* Queued Files List */}
                  {files.length > 0 && (
                    <div className="space-y-3 flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-300">
                          {files.length} Resume(s) Queued:
                        </span>
                        <button
                          onClick={() => {
                            setFiles([]);
                            setFileMap(new Map());
                          }}
                          className="text-xs text-rose-400 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2.5 max-h-[340px] overflow-y-auto pr-1 p-3 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                        {files.map((file, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-2 text-xs bg-slate-800 text-slate-200 px-3 py-2 rounded-xl border border-slate-700 font-medium shadow-xs"
                          >
                            <span className="truncate max-w-[220px]">{file.name}</span>
                            <button
                              onClick={() => removeFile(idx)}
                              className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="px-7 py-4 border-t border-slate-800 bg-slate-950">
              {processing ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-white shrink-0">
                        Analyzing {progress.current} of {progress.total} ({progress.percent}%)
                      </span>
                      <span className="text-slate-500 hidden sm:inline">•</span>
                      <span className="text-xs text-slate-400 truncate max-w-[240px] hidden sm:inline" title={progress.fileName}>
                        {progress.fileName}
                      </span>
                    </div>

                    <button
                      onClick={cancelProcessing}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Stop & Keep Parsed</span>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Parsed: {progress.successCount} ok
                      {progress.errorCount > 0 && `, ${progress.errorCount} failed`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-400" />
                      {positiveKeywords.length} skills • {files.length} files ready
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <a
                      href="https://shakil2995.github.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:inline-block text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      Created by Shakil Ahmed ↗
                    </a>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setShowSetupModal(false)}
                      className="px-4.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Close
                    </button>

                    <button
                      onClick={processFiles}
                      disabled={processing || files.length === 0}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Run Screener ({files.length} CVs)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. KEYBOARD SHORTCUTS REFERENCE MODAL */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
                  <p className="text-[11px] text-slate-400">Power navigation & triage hotkeys</p>
                </div>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-2 py-1 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center gap-1 hover:bg-slate-800"
                title="Close (Esc)"
              >
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 text-white border border-white/20 rounded">ESC</kbd>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto text-xs">
              {/* Category: Triage & Decisions */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">
                  Triage & Screening
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Shortlist Candidate</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">A</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Reject Candidate</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">R</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Star / Bookmark</span>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">S</kbd>
                      <span className="text-slate-500">or</span>
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">F</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category: Navigation */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">
                  Navigation
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Next Candidate</span>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">K</kbd>
                      <span className="text-slate-500">or</span>
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">↓</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Previous Candidate</span>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">J</kbd>
                      <span className="text-slate-500">or</span>
                      <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">↑</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category: General Actions */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">
                  Panels & Filters
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Toggle Inspector Panel</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">I</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Toggle PDF Skill Highlights</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">H</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Open Criteria & Files Setup</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">C</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Focus Search Input</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">/</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">Close Modal / Unfocus</span>
                    <kbd className="px-2 py-0.5 font-mono text-[10px] bg-white/10 text-white border border-white/20 rounded">ESC</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <a
                href="https://shakil2995.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-500 hover:text-indigo-400 transition-colors"
                title="Made by Shakil Ahmed"
              >
                Made by Shakil Ahmed ↗
              </a>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {copiedToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-indigo-500/50 text-indigo-200 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copiedToast}</span>
        </div>
      )}
    </div>
  );
};

export default CVParserApp;
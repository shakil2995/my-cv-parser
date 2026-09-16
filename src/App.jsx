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
  BookOpen
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
  renderLinkIcon
} from './utils/linkExtractor';
import { extractContactDetails } from './utils/contactExtractor';
import { extractSkillsFromJD, SKILL_KNOWLEDGE_BASE } from './utils/jdExtractor';
import { detectExperienceLevel } from './utils/experienceDetector';

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
    .replace(/[_\-\.]+/g, ' ')
    .trim();

  let parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    parts = name.replace(/\.(pdf|docx|doc)$/i, '').replace(/[_\-\.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
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

function getCoverageColor(coveragePercent) {
  if (coveragePercent >= 70) {
    return 'text-emerald-400';
  }
  if (coveragePercent >= 40) {
    return 'text-amber-400';
  }
  return 'text-rose-400';
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
  const [setupTab, setSetupTab] = useState('jd'); // 'jd' | 'skills' | 'disqualifiers' | 'upload'
  const [presetCategoryTab, setPresetCategoryTab] = useState('all');

  // JD Extractor state
  const [jdInputText, setJdInputText] = useState('');
  const [extractedJdResult, setExtractedJdResult] = useState(null);
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  const [copiedToast, setCopiedToast] = useState(null);

  // Inspector panel toggle
  const [showInspector, setShowInspector] = useState(true);

  // Keywords configuration - starts empty by default
  const [positiveKeywords, setPositiveKeywords] = useState([]);
  const [negativeKeywords, setNegativeKeywords] = useState([]);

  // Keyword input states
  const [newPosKeyword, setNewPosKeyword] = useState('');
  const [newPosWeight, setNewPosWeight] = useState(7);
  const [newPosCategory, setNewPosCategory] = useState('technical');
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
        category: newPosCategory
      }
    ]);
    setNewPosKeyword('');
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
          category: preset.category
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
        const experience = detectExperienceLevel(text);
        const scoreResult = calculateCandidateScore(text, positiveKeywords, negativeKeywords);
        const displayName = extractCandidateName(file.name, text);

        parsedCandidates.push({
          id: `${file.name}-${i}-${Date.now()}`,
          name: file.name,
          displayName,
          fileType: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX',
          fullText: text,
          links,
          contact,
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
          contact: { emails: [], primaryEmail: null, phones: [], primaryPhone: null },
          experience: { level: 'Not Specified', badgeLabel: 'Exp: N/A', years: null, yearsDisplay: 'N/A', confidence: 'low', sourceSnippet: null, color: 'slate' },
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
      // Real-time live score calculation if keywords change after parsing
      const scoreResult = c.fullText ? calculateCandidateScore(c.fullText, positiveKeywords, negativeKeywords) : c;
      const isManual = manualOverrides[c.name];
      let status = 'rejected';

      if (isManual) {
        status = isManual;
      } else if (scoreResult.hasDisqualifier) {
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

      // Ensure candidate has extracted links, contact, and experience
      const candidateLinks = c.links || extractLinksFromDocument(c.fullText, []);
      const candidateContact = c.contact || extractContactDetails(c.fullText, []);
      const candidateExperience = c.experience || detectExperienceLevel(c.fullText);

      return {
        ...c,
        ...scoreResult,
        contact: candidateContact,
        experience: candidateExperience,
        links: candidateLinks,
        computedStatus: status,
        isOverridden: Boolean(isManual),
        isStarred: favorites.has(c.name),
        missingSkills
      };
    });
  }, [candidates, manualOverrides, passingThreshold, favorites, positiveKeywords, negativeKeywords]);

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
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (showSetupModal) {
        if (e.key === 'Escape') setShowSetupModal(false);
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectNextCandidate();
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectPreviousCandidate();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setCandidateDecision('accepted');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setCandidateDecision('rejected');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (selectedCandidate) toggleFavoriteCandidate(selectedCandidate.name);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSetupModal,
    selectNextCandidate,
    selectPreviousCandidate,
    setCandidateDecision,
    selectedCandidate,
    toggleFavoriteCandidate
  ]);

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
      'Email',
      'Phone (BD/Intl)',
      'Mobile Operator',
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
      `"${c.contact?.primaryEmail || ''}"`,
      `"${c.contact?.primaryPhone?.display || ''}"`,
      `"${c.contact?.primaryPhone?.operator || ''}"`,
      `${c.coveragePercent}%`,
      `${c.matchedCount}/${c.totalPositive}`,
      `"${c.foundKeywords.map((k) => `${k.keyword} (${k.matches}x)`).join(', ')}"`,
      `"${c.missingSkills.map((k) => k.keyword).join(', ')}"`,
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

  return (
    <div className="w-full h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans antialiased select-none">
      {/* 1. TOP HEADER (52px high, dark minimal theme) */}
      <header className="h-[52px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left branding and criteria preview */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              CV Screener
            </span>
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
            <span className="text-slate-500">•</span>
            <span>Cutoff: {passingThreshold}%</span>
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
            <span className="px-2 py-0.5 text-slate-300">{poolCounts.all} Total</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
              {poolCounts.accepted} Shortlisted
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/40">
              {poolCounts.rejected} Rejected
            </span>
            {poolCounts.starred > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40">
                ★ {poolCounts.starred}
              </span>
            )}
          </div>
        )}

        {/* Right action buttons */}
        <div className="flex items-center gap-2">
          {/* Criteria & Upload Button */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Criteria & Files</span>
            {files.length > 0 && (
              <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 rounded-full font-mono">
                {files.length}
              </span>
            )}
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
              title={`Toggle Skill Inspector (Key: I)`}
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
                type="text"
                placeholder="Filter by name or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-6 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
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
                const initials = getCandidateInitials(c.displayName);

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
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-xs font-bold truncate transition-colors ${
                            isSelected ? 'text-white' : 'text-slate-200 hover:text-white'
                          }`}
                          title={c.displayName}
                        >
                          {c.displayName}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5" title={c.name}>
                          {c.name}
                        </p>
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

                    {/* Row 2: Metadata Badges (File Type, Experience, Skill Match Count) */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px]">
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300 font-mono">
                        {c.fileType}
                      </span>

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

                    {/* Row 3: Matched Skill Tags (Single Row) */}
                    {c.foundKeywords.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 overflow-hidden flex-nowrap">
                        {c.foundKeywords.slice(0, 3).map((k, idx) => (
                          <span
                            key={idx}
                            className="text-[9.5px] bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/70 font-medium truncate shrink-0 max-w-[85px]"
                            title={k.keyword}
                          >
                            {k.keyword}
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
          <div className="p-2 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 flex items-center justify-between">
            <span>{filteredCandidates.length} of {candidates.length} candidates</span>
            <span className="text-slate-600 font-mono">[J] Next • [K] Prev</span>
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
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Candidate [K]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-300 px-2 min-w-[70px] text-center select-none">
                    {currentIndex + 1} / {filteredCandidates.length}
                  </span>
                  <button
                    onClick={selectNextCandidate}
                    disabled={currentIndex >= filteredCandidates.length - 1}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Candidate [J]"
                  >
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
                    title="Shortlist Candidate [S]"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Shortlist</span>
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
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>

                  {/* Star/Favorite Toggle */}
                  <button
                    onClick={() => toggleFavoriteCandidate(selectedCandidate.name)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      selectedCandidate.isStarred
                        ? 'bg-amber-950/80 border-amber-600/50 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                    }`}
                    title="Star Candidate [F]"
                  >
                    <Star className={`w-4 h-4 ${selectedCandidate.isStarred ? 'fill-amber-400' : ''}`} />
                  </button>

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
                    className={`p-1.5 rounded-lg border transition-all ${
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
                {selectedCandidate.fileType === 'PDF' ? (
                  pdfUrl ? (
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
                  )
                ) : (
                  /* Formatted DOCX Reader with auto-linkified URLs & emails */
                  <div className="w-full h-full max-w-3xl overflow-y-auto p-8 bg-white text-slate-900 rounded-xl shadow-2xl">
                    <div className="text-[11px] text-slate-400 font-mono mb-4 pb-2 border-b border-slate-200 flex justify-between">
                      <span>DOCUMENT READER (.DOCX)</span>
                      <span>{selectedCandidate.fullText?.length || 0} characters</span>
                    </div>
                    <div className="text-xs leading-relaxed font-sans whitespace-pre-wrap text-slate-800 selection:bg-indigo-100">
                      {linkifyContent(
                        selectedCandidate.fullText,
                        'text-indigo-600 hover:text-indigo-800 underline font-medium transition-colors cursor-pointer'
                      ) || 'No text extracted from this document.'}
                    </div>
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
              >
                Open Criteria & Files
              </button>
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
              {(selectedCandidate.contact?.primaryEmail || selectedCandidate.contact?.primaryPhone) && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Candidate Outreach
                  </h4>

                  {/* Email row */}
                  {selectedCandidate.contact.primaryEmail && (
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
                  {selectedCandidate.contact.primaryPhone && (
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-500 font-semibold uppercase flex items-center gap-1">
                              <span>Phone</span>
                              {selectedCandidate.contact.primaryPhone.operator && (
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-normal">
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
              )}

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
                          <th className="p-2">Category</th>
                          <th className="p-2 text-center">Hits</th>
                          <th className="p-2 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {selectedCandidate.foundKeywords.map((k, i) => (
                          <tr key={i}>
                            <td className="p-2 font-bold text-slate-200">{k.keyword}</td>
                            <td className="p-2 text-[10px] text-slate-400">
                              {CATEGORY_LABELS[k.category] || k.category}
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
                        key={k.id}
                        className="text-[10px] bg-rose-950/40 text-rose-400 border border-rose-900/40 px-2 py-0.5 rounded-md font-medium"
                      >
                        ✕ {k.keyword}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Screening Criteria & Resumes
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure your required skills, dealbreakers, and upload candidates
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSetupModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-800 bg-slate-950 flex gap-5 text-xs font-semibold text-slate-400 overflow-x-auto">
              <button
                onClick={() => setSetupTab('jd')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  setupTab === 'jd'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent hover:text-slate-200 text-indigo-400'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>✨ Auto-Extract from JD</span>
              </button>
              <button
                onClick={() => setSetupTab('skills')}
                className={`py-3 border-b-2 transition-colors shrink-0 ${
                  setupTab === 'skills'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                1. Required Skills ({positiveKeywords.length})
              </button>
              <button
                onClick={() => setSetupTab('disqualifiers')}
                className={`py-3 border-b-2 transition-colors shrink-0 ${
                  setupTab === 'disqualifiers'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                2. Dealbreakers ({negativeKeywords.length})
              </button>
              <button
                onClick={() => setSetupTab('upload')}
                className={`py-3 border-b-2 transition-colors shrink-0 ${
                  setupTab === 'upload'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                3. Upload Resumes ({files.length})
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="p-6 pb-12 overflow-y-auto flex-1 space-y-5 bg-slate-900">
              {/* TAB 0: AUTO-EXTRACT FROM JOB DESCRIPTION */}
              {setupTab === 'jd' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Wand2 className="w-4 h-4 text-indigo-400" />
                          Paste Job Description (JD)
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Auto-extracts required tech stacks, tools, methodologies, and smart weights.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold mr-1">Load Demo:</span>
                        {SAMPLE_JDS.map((sample, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setJdInputText(sample.text);
                              handleExtractFromJd(sample.text);
                            }}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white px-2 py-1 rounded border border-slate-800 transition-colors cursor-pointer"
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
                      className="w-full text-xs font-sans p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {jdInputText.trim() ? `${jdInputText.trim().split(/\s+/).length} words entered` : 'Ready for input'}
                      </span>
                      <button
                        onClick={() => handleExtractFromJd(jdInputText)}
                        disabled={!jdInputText.trim() || isExtractingJd}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isExtractingJd ? 'Extracting...' : 'Scan & Extract Skills'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Extracted Results Sheet */}
                  {extractedJdResult && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-4 animate-in fade-in-50 duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">
                            {extractedJdResult.stats.totalFound} Skills Identified in JD
                          </span>
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-mono font-bold">
                            {extractedJdResult.stats.requiredCount} Must-Haves (W: 8-10)
                          </span>
                        </div>

                        <button
                          onClick={handleApplyJdCriteria}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Apply to Scoring Matrix</span>
                        </button>
                      </div>

                      {/* Skills interactive chips grid */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Review Extracted Skills (Toggle on/off or adjust weights):
                        </span>
                        <div className="flex flex-wrap gap-2.5 p-1 pb-3">
                          {extractedJdResult.skills.map((skill, idx) => (
                            <div
                              key={skill.id}
                              onClick={() => toggleJdSkillSelection(idx)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2 cursor-pointer select-none ${
                                skill.selected
                                  ? skill.importance === 'required'
                                    ? 'bg-indigo-950/90 text-indigo-200 border-indigo-500/80 shadow-xs ring-1 ring-indigo-500/40'
                                    : 'bg-slate-800 text-slate-200 border-slate-600 shadow-xs'
                                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-60'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                  skill.selected ? 'bg-indigo-500 text-white font-bold' : 'border border-slate-600'
                                }`}
                              >
                                {skill.selected && '✓'}
                              </div>
                              <span className="font-semibold">{skill.keyword}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                {CATEGORY_LABELS[skill.category] || skill.category}
                              </span>

                              {/* Weight controls */}
                              <div
                                className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-md border border-slate-700/60"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] font-mono font-bold text-indigo-300">W:{skill.weight}</span>
                                <button
                                  onClick={() => updateJdSkillWeight(idx, -1)}
                                  className="text-slate-400 hover:text-white px-1 text-[10px] font-bold"
                                >
                                  -
                                </button>
                                <button
                                  onClick={() => updateJdSkillWeight(idx, 1)}
                                  className="text-slate-400 hover:text-white px-1 text-[10px] font-bold"
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
                        <div className="pt-2 border-t border-slate-800">
                          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-2">
                            Potential Dealbreakers Detected in JD:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {extractedJdResult.suggestedDisqualifiers.map((dis, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-medium flex items-center gap-1.5"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
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
                <div className="space-y-4">
                  {/* Quick Presets Catalog */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Quick Add Skills by Role
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Click any chip to toggle on/off
                      </span>
                    </div>

                    {/* Category Selector Pills */}
                    <div className="flex flex-wrap gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      {SKILL_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setPresetCategoryTab(cat.id)}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                              presetCategoryTab === cat.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                          >
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Presets Chips Grid */}
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
                      {displayedPresets.map((preset, idx) => {
                        const isAdded = positiveKeywords.some(
                          (k) => k.keyword.toLowerCase() === preset.keyword.toLowerCase()
                        );

                        return (
                          <button
                            key={idx}
                            onClick={() => togglePresetSkill(preset)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
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
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300">Add Custom Skill</span>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        placeholder="Skill keyword (e.g. C++, GraphQL, AWS)"
                        value={newPosKeyword}
                        onChange={(e) => setNewPosKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPositiveKeyword()}
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={newPosCategory}
                        onChange={(e) => setNewPosCategory(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none"
                      >
                        <option value="technical">💻 Technical (1.2×)</option>
                        <option value="soft">🤝 Soft Skill (1.0×)</option>
                        <option value="cert">📜 Certification (1.1×)</option>
                      </select>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">
                        <span className="text-[10px] text-slate-400 font-bold">Weight:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newPosWeight}
                          onChange={(e) => setNewPosWeight(e.target.value)}
                          className="w-8 text-xs bg-transparent text-center font-bold text-white focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={addPositiveKeyword}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Add Skill
                      </button>
                    </div>
                  </div>

                  {/* Active Skills List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Active Required Skills ({positiveKeywords.length}):
                      </span>
                      {positiveKeywords.length > 0 && (
                        <button
                          onClick={() => setPositiveKeywords([])}
                          className="text-[11px] text-rose-400 hover:underline font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {positiveKeywords.length === 0 ? (
                      <div className="p-4 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No required skills active yet. Click any skill chip above or add a custom keyword to start.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {positiveKeywords.map((item) => (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 font-medium"
                          >
                            <span className="font-bold">{item.keyword}</span>
                            <span className="text-[10px] text-indigo-400 font-mono">W:{item.weight}</span>
                            <button
                              onClick={() => removePositiveKeyword(item.id)}
                              className="text-slate-500 hover:text-rose-400 ml-1"
                            >
                              <X className="w-3 h-3" />
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
                <div className="space-y-4">
                  {/* Common Dealbreaker Presets */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Quick Add Common Dealbreakers:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {DISQUALIFIER_PRESETS.map((preset, idx) => {
                        const isAdded = negativeKeywords.some(
                          (k) => k.keyword.toLowerCase() === preset.toLowerCase()
                        );
                        return (
                          <button
                            key={idx}
                            onClick={() => togglePresetDisqualifier(preset)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
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

                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300">Add Dealbreaker or Penalty</span>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        placeholder="Keyword (e.g. unauthorized, visa required)"
                        value={newNegKeyword}
                        onChange={(e) => setNewNegKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addNegativeKeyword()}
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-rose-500"
                      />
                      <select
                        value={newNegType}
                        onChange={(e) => setNewNegType(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none"
                      >
                        <option value="disqualifier">🚫 Dealbreaker (Instant Fail)</option>
                        <option value="penalty">⚠️ Soft Penalty (-5 pts)</option>
                      </select>
                      {newNegType === 'penalty' && (
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-bold">-pts:</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={newNegPenalty}
                            onChange={(e) => setNewNegPenalty(Number(e.target.value))}
                            className="w-8 text-xs bg-transparent text-center font-bold text-white focus:outline-none"
                          />
                        </div>
                      )}
                      <button
                        onClick={addNegativeKeyword}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Active Negative List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Active Dealbreakers & Penalties ({negativeKeywords.length}):
                      </span>
                      {negativeKeywords.length > 0 && (
                        <button
                          onClick={() => setNegativeKeywords([])}
                          className="text-[11px] text-rose-400 hover:underline font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {negativeKeywords.length === 0 ? (
                      <div className="p-3 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No dealbreakers configured. Candidates will be judged solely on positive match score.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {negativeKeywords.map((neg) => (
                          <span
                            key={neg.id}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium ${
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
                              className="text-slate-400 hover:text-white ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: UPLOAD RESUMES */}
              {setupTab === 'upload' && (
                <div className="space-y-4">
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
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
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
                      <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl mb-3 border border-indigo-500/20">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-white mb-1">
                        Click or Drop PDF, DOCX, or ZIP Archives
                      </span>
                      <span className="text-xs text-slate-400">
                        Bulk upload supported • Automatic ZIP unpacking
                      </span>
                    </label>
                  </div>

                  {/* High Volume Safe Parsing Callout */}
                  {files.length >= 10 && (
                    <div className="flex items-start gap-2.5 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300">
                      <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-white mb-0.5">
                          High-Volume Crash Protection Active ({files.length} CVs)
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          Engine safely parses documents with strict WebAssembly memory release and 35ms event-loop yielding. Designed to comfortably handle 100 to 500+ CV batches without tab memory spikes or crashes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Queued Files List */}
                  {files.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-300">
                          {files.length} Resume(s) Queued:
                        </span>
                        <button
                          onClick={() => {
                            setFiles([]);
                            setFileMap(new Map());
                          }}
                          className="text-xs text-rose-400 hover:underline"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {files.map((file, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 font-medium"
                          >
                            <span className="truncate max-w-[180px]">{file.name}</span>
                            <button
                              onClick={() => removeFile(idx)}
                              className="text-slate-500 hover:text-rose-400 ml-1"
                            >
                              <X className="w-3 h-3" />
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
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950">
              {processing ? (
                <div className="w-full space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
                      <span className="text-xs font-bold text-white shrink-0">
                        Analyzing {progress.current} of {progress.total} ({progress.percent}%)
                      </span>
                      <span className="text-slate-500 hidden sm:inline">•</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[220px] hidden sm:inline" title={progress.fileName}>
                        {progress.fileName}
                      </span>
                    </div>

                    <button
                      onClick={cancelProcessing}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Stop & Keep Parsed</span>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Parsed: {progress.successCount} ok
                      {progress.errorCount > 0 && `, ${progress.errorCount} failed`}
                    </span>
                    <span className="text-indigo-400/90 font-medium">
                      Zero-crash memory mode (35ms GC pause)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {positiveKeywords.length} skills • {files.length} files ready
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSetupModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Close
                    </button>

                    <button
                      onClick={processFiles}
                      disabled={processing || files.length === 0}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Run Screener ({files.length} CVs)
                    </button>
                  </div>
                </div>
              )}
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
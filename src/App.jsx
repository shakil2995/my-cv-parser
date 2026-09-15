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
  Users
} from 'lucide-react';
import JSZip from 'jszip';
import {
  calculateCandidateScore,
  extractCandidateName,
  CATEGORY_LABELS
} from './utils/scoring';
import { extractTextFromFile, extractFilesFromZip } from './utils/documentParser';

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

const CVParserApp = () => {
  // Files state
  const [files, setFiles] = useState([]);
  const [fileMap, setFileMap] = useState(new Map());
  const [isDragging, setIsDragging] = useState(false);

  // Setup Modal state
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupTab, setSetupTab] = useState('skills'); // 'skills' | 'disqualifiers' | 'upload'
  const [presetCategoryTab, setPresetCategoryTab] = useState('all');

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
        const text = await extractTextFromFile(file);
        const scoreResult = calculateCandidateScore(text, positiveKeywords, negativeKeywords);
        const displayName = extractCandidateName(file.name, text);

        parsedCandidates.push({
          id: `${file.name}-${i}-${Date.now()}`,
          name: file.name,
          displayName,
          fileType: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX',
          fullText: text,
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

  // Enriched candidates list with live computed status and overrides
  const enrichedCandidates = useMemo(() => {
    return candidates.map((c) => {
      const isManual = manualOverrides[c.name];
      let status = 'rejected';

      if (isManual) {
        status = isManual;
      } else if (c.hasDisqualifier) {
        status = 'rejected';
      } else if (c.scorePercent >= passingThreshold) {
        status = 'accepted';
      } else {
        status = 'rejected';
      }

      // Compute missing required skills
      const matchedSet = new Set(c.foundKeywords.map((k) => k.keyword.toLowerCase()));
      const missingSkills = positiveKeywords.filter(
        (k) => !matchedSet.has(k.keyword.toLowerCase())
      );

      return {
        ...c,
        computedStatus: status,
        isOverridden: Boolean(isManual),
        isStarred: favorites.has(c.name),
        missingSkills
      };
    });
  }, [candidates, manualOverrides, passingThreshold, favorites, positiveKeywords]);

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
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {candidates.length === 0 ? (
                  <div className="space-y-3">
                    <p className="font-medium text-slate-400">No CVs processed yet.</p>
                    <button
                      onClick={() => setShowSetupModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
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
                    className={`p-3 cursor-pointer transition-all border-l-[3px] ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 shadow-sm'
                        : 'border-transparent hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Top row: Name & Score */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          <h3
                            className={`text-xs font-bold truncate ${
                              isSelected ? 'text-white' : 'text-slate-200'
                            }`}
                            title={c.displayName}
                          >
                            {c.displayName}
                          </h3>
                          <span className="text-[9px] uppercase font-bold px-1 rounded bg-slate-800 text-slate-400">
                            {c.fileType}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate" title={c.name}>
                          {c.name}
                        </p>
                      </div>

                      {/* Score Pill */}
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-md shrink-0 font-mono ${
                          c.isOverridden
                            ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                            : isAccepted
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {c.scorePercent}%
                      </span>
                    </div>

                    {/* Skill coverage & Disqualifier */}
                    <div className="flex items-center justify-between gap-2 mt-1 text-[11px]">
                      <span className="text-slate-400">
                        {c.matchedCount}/{c.totalPositive} skills ({c.coveragePercent}%)
                      </span>

                      {/* Star Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteCandidate(c.name);
                        }}
                        className="p-0.5 text-amber-400 hover:text-amber-300"
                        title="Toggle Favorite"
                      >
                        <Star className={`w-3.5 h-3.5 ${c.isStarred ? 'fill-amber-400' : 'text-slate-600'}`} />
                      </button>
                    </div>

                    {/* Dealbreaker Alert Badge */}
                    {c.hasDisqualifier && (
                      <div className="mt-1.5 text-[10px] text-rose-400 font-bold bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                        <span className="truncate">Disqualified: {c.disqualifiers.map((d) => d.keyword).join(', ')}</span>
                      </div>
                    )}

                    {/* Matched Skill Tags preview */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.foundKeywords.slice(0, 3).map((k, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.2 rounded border border-slate-800 font-medium truncate max-w-[80px]"
                        >
                          {k.keyword}
                        </span>
                      ))}
                      {c.foundKeywords.length > 3 && (
                        <span className="text-[10px] text-slate-600">+{c.foundKeywords.length - 3}</span>
                      )}
                    </div>
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
                {/* Candidate title & badges */}
                <div className="flex items-center gap-3 min-w-0 pr-2 max-w-[calc(50%-90px)]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-base font-extrabold text-white truncate" title={selectedCandidate.displayName}>
                        {selectedCandidate.displayName}
                      </h2>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                        {selectedCandidate.fileType}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate" title={selectedCandidate.name}>
                      {selectedCandidate.name}
                    </p>
                  </div>

                  <div className="hidden 2xl:flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full font-mono ${
                        selectedCandidate.computedStatus === 'accepted'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {selectedCandidate.scorePercent}% Match
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedCandidate.matchedCount}/{selectedCandidate.totalPositive} skills ({selectedCandidate.coveragePercent}%)
                    </span>
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
                    title="Shortlist Candidate [A]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Shortlist</span>
                    <kbd className="hidden lg:inline-block text-[9px] bg-black/30 px-1 rounded font-mono">A</kbd>
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
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                    <kbd className="hidden lg:inline-block text-[9px] bg-black/30 px-1 rounded font-mono">R</kbd>
                  </button>

                  {/* Star Button */}
                  <button
                    onClick={() => toggleFavoriteCandidate(selectedCandidate.name)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition-colors"
                    title="Toggle Star [S]"
                  >
                    <Star className={`w-4 h-4 ${selectedCandidate.isStarred ? 'fill-amber-400' : 'text-slate-500'}`} />
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={() => downloadSingleCV(selectedCandidate.name)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                    title="Download original file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stage Body: Distraction-Free Document Canvas */}
              <div className="flex-1 overflow-hidden bg-slate-900/60 p-3 flex justify-center">
                {selectedCandidate.fileType === 'PDF' ? (
                  pdfUrl ? (
                    <div className="w-full h-full max-w-5xl rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-800">
                      {/* Embed with #toolbar=0&navpanes=0 to hide ugly browser PDF chrome */}
                      <iframe
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                        className="w-full h-full border-0 bg-white"
                        title="CV Resume Preview"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                      Loading PDF...
                    </div>
                  )
                ) : (
                  /* Formatted DOCX Reader */
                  <div className="w-full h-full max-w-3xl overflow-y-auto p-8 bg-white text-slate-900 rounded-xl shadow-2xl">
                    <div className="text-[11px] text-slate-400 font-mono mb-4 pb-2 border-b border-slate-200 flex justify-between">
                      <span>DOCUMENT READER (.DOCX)</span>
                      <span>{selectedCandidate.fullText?.length || 0} characters</span>
                    </div>
                    <pre className="text-xs leading-relaxed font-sans whitespace-pre-wrap text-slate-800">
                      {selectedCandidate.fullText || 'No text extracted from this document.'}
                    </pre>
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
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Match</span>
                  <div className="text-xl font-black text-indigo-400 font-mono mt-0.5">
                    {selectedCandidate.scorePercent}%
                  </div>
                  <p className="text-[9px] text-slate-500">Overall</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Coverage</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    {selectedCandidate.coveragePercent}%
                  </div>
                  <p className="text-[9px] text-slate-500">
                    {selectedCandidate.matchedCount}/{selectedCandidate.totalPositive}
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Depth</span>
                  <div className="text-xl font-black text-purple-400 font-mono mt-0.5">
                    {selectedCandidate.depthScore}
                  </div>
                  <p className="text-[9px] text-slate-500">Freq pts</p>
                </div>
              </div>

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
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Matched Skills ({selectedCandidate.foundKeywords.length})
                </h4>
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
                        &quot;{snip.snippet}&quot;
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
            <div className="px-6 border-b border-slate-800 bg-slate-950 flex gap-6 text-xs font-semibold text-slate-400">
              <button
                onClick={() => setSetupTab('skills')}
                className={`py-3 border-b-2 transition-colors ${
                  setupTab === 'skills'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                1. Required Skills ({positiveKeywords.length})
              </button>
              <button
                onClick={() => setSetupTab('disqualifiers')}
                className={`py-3 border-b-2 transition-colors ${
                  setupTab === 'disqualifiers'
                    ? 'border-rose-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                2. Dealbreakers ({negativeKeywords.length})
              </button>
              <button
                onClick={() => setSetupTab('upload')}
                className={`py-3 border-b-2 transition-colors ${
                  setupTab === 'upload'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent hover:text-slate-200'
                }`}
              >
                3. Upload Resumes ({files.length})
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-900">
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
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950/40 rounded-xl border border-slate-800/80">
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
    </div>
  );
};

export default CVParserApp;
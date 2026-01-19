import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Download, Plus, Trash2, AlertCircle, Eye, File, Star } from 'lucide-react';

const CVParserApp = () => {
  const [files, setFiles] = useState([]);
  const [positiveKeywords, setPositiveKeywords] = useState([]);
  const [negativeKeywords, setNegativeKeywords] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ accepted: [], rejected: [] });
  const [favorites, setFavorites] = useState(new Set());
  const [newPosKeyword, setNewPosKeyword] = useState('');
  const [newPosWeight, setNewPosWeight] = useState(5);
  const [newNegKeyword, setNewNegKeyword] = useState('');
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [fileMap, setFileMap] = useState(new Map());
  const [pdfUrl, setPdfUrl] = useState(null);

  const loadPdfJs = async () => {
    if (window.pdfjsLib) return window.pdfjsLib;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const extractTextFromPdf = async (file) => {
    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }

      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from ${file.name}`);
    }
  };

  // Example category multipliers
  const categoryMultiplier = {
    technical: 1.2,
    soft: 1,
    cert: 1.1
  };

  const calculateScore = (text) => {
    const lowerText = text.toLowerCase();
    let score = 0;
    const foundKeywords = [];
    const foundNegatives = [];
    let hasNegativeHit = false;

    positiveKeywords.forEach(({ keyword, weight, category = 'soft' }) => {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = lowerText.match(regex) || [];

      if (matches.length > 0) {
        // Logarithmic decay scoring
        const totalPoints = weight * Math.log(matches.length + 1) * (categoryMultiplier[category] || 1);
        score += totalPoints;
        foundKeywords.push({ keyword, matches: matches.length, points: Math.round(totalPoints), category });
      }
    });

    negativeKeywords.forEach(keyword => {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = lowerText.match(regex) || [];
      if (matches.length > 0) {
        hasNegativeHit = true;
        foundNegatives.push({ keyword, matches: matches.length });
        score -= 5 * matches.length; // heavy penalty
      }
    });

    if (score < 0) score = 0;
    return { score: Math.round(score), foundKeywords, foundNegatives, hasNegativeHit };
  };

  const getMaxPossibleScore = () => {
    let maxScore = 0;
    positiveKeywords.forEach(({ weight, category = 'soft' }) => {
      // Assume minimum 1 occurrence per keyword
      maxScore += weight * Math.log(2) * (categoryMultiplier[category] || 1);
    });
    return Math.round(maxScore);
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    const pdfFiles = [];
    const newFileMap = new Map(fileMap);

    for (const file of uploadedFiles) {
      if (file.type === 'application/pdf') {
        pdfFiles.push(file);
        newFileMap.set(file.name, file);
      } else if (file.name.endsWith('.zip')) {
        // Note: Real zip extraction would require JSZip library
        alert('Zip file detected. In production, this would extract PDFs from the zip.');
      }
    }

    setFiles(prev => [...prev, ...pdfFiles]);
    setFileMap(newFileMap);
  };

  const processFiles = async () => {
    if (files.length === 0) {
      alert('Please upload CV files first');
      return;
    }

    setProcessing(true);
    const candidates = [];

    try {
      // Extract and score each CV
      for (const file of files) {
        try {
          const text = await extractTextFromPdf(file);
          const { score, foundKeywords, foundNegatives, hasNegativeHit } = calculateScore(text);

          candidates.push({
            name: file.name,
            score,
            foundKeywords,
            foundNegatives,
            text: text.substring(0, 500) + "...",
            fullText: text,
            hasNegativeHit
          });
        } catch (error) {
          candidates.push({
            name: file.name,
            score: 0,
            error: error.message,
            foundKeywords: [],
            foundNegatives: [],
            fullText: "Error loading CV",
            hasNegativeHit: false
          });
        }
      }

      // Absolute passing score
      const maxPossibleScore = getMaxPossibleScore();
      const passingScorePercent = 60; // fixed 60% threshold

      const accepted = [];
      const rejected = [];

      candidates.forEach(c => {
        // Convert to percentage for UI
        c.scorePercent = maxPossibleScore > 0 ? Math.round((c.score / maxPossibleScore) * 100) : 0;
        if (c.hasNegativeHit || c.scorePercent < passingScorePercent) {
          rejected.push(c);
        } else {
          accepted.push(c);
        }
      });

      accepted.sort((a, b) => b.score - a.score);
      rejected.sort((a, b) => b.score - a.score);

      setResults({ accepted, rejected });
    } catch (error) {
      alert("Error processing files: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleFavorite = (candidateName) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(candidateName)) {
        newFavorites.delete(candidateName);
      } else {
        newFavorites.add(candidateName);
      }
      return newFavorites;
    });
  };

  const getFavoriteCandidates = () => {
    const allCandidates = [...results.accepted, ...results.rejected];
    return allCandidates.filter(c => favorites.has(c.name));
  };

  const downloadFavoritesAsZip = async () => {
    const favoriteCandidates = getFavoriteCandidates();
    
    if (favoriteCandidates.length === 0) {
      alert('No favorites to download');
      return;
    }

    // Load JSZip from CDN
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const zip = new window.JSZip();
    
    // Separate favorites into starred and accepted folders
    const starredCandidates = favoriteCandidates.filter(c => !results.accepted.includes(c));
    const acceptedCandidates = favoriteCandidates.filter(c => results.accepted.includes(c));

    // Create star folder for rejected but favorited
    if (starredCandidates.length > 0) {
      const starFolder = zip.folder('star');
      for (const candidate of starredCandidates) {
        const file = fileMap.get(candidate.name);
        if (file) {
          starFolder.file(candidate.name, file);
        }
      }
    }

    // Create accepted folder for accepted and favorited
    if (acceptedCandidates.length > 0) {
      const acceptedFolder = zip.folder('accepted');
      for (const candidate of acceptedCandidates) {
        const file = fileMap.get(candidate.name);
        if (file) {
          acceptedFolder.file(candidate.name, file);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorite_candidates.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addPositiveKeyword = () => {
    if (newPosKeyword.trim()) {
      setPositiveKeywords([...positiveKeywords, { keyword: newPosKeyword.trim(), weight: newPosWeight }]);
      setNewPosKeyword('');
      setNewPosWeight(5);
    }
  };

  const addNegativeKeyword = () => {
    if (newNegKeyword.trim()) {
      setNegativeKeywords([...negativeKeywords, newNegKeyword.trim()]);
      setNewNegKeyword('');
    }
  };

  const removePositiveKeyword = (index) => {
    setPositiveKeywords(positiveKeywords.filter((_, i) => i !== index));
  };

  const removeNegativeKeyword = (index) => {
    setNegativeKeywords(negativeKeywords.filter((_, i) => i !== index));
  };

  const exportResults = (type) => {
    const data = type === 'accepted' ? results.accepted : results.rejected;
    const csv = [
      ['Name', 'Score', 'Positive Keywords', 'Negative Keywords'],
      ...data.map(c => [
        c.name,
        c.score,
        c.foundKeywords.map(k => `${k.keyword}(${k.matches})`).join('; '),
        c.foundNegatives.map(k => `${k.keyword}(${k.matches})`).join('; ')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_candidates.csv`;
    a.click();
  };

  const viewCV = (candidate) => {
    setViewingCandidate(candidate);
    const file = fileMap.get(candidate.name);
    if (file) {
      // Clean up previous URL if exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      // Create new URL for PDF viewing
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  };

  const closeViewer = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setViewingCandidate(null);
    setPdfUrl(null);
  };

  const downloadCV = (fileName) => {
    const file = fileMap.get(fileName);
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadAllAsZip = async (type) => {
    const candidates = type === 'accepted' ? results.accepted : results.rejected;
    
    if (candidates.length === 0) {
      alert('No files to download');
      return;
    }

    // Load JSZip from CDN
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const zip = new window.JSZip();
    
    // Separate into favorites and non-favorites
    const favoriteCandidates = candidates.filter(c => favorites.has(c.name));
    const nonFavoriteCandidates = candidates.filter(c => !favorites.has(c.name));

    // Create favorites folder if there are any
    if (favoriteCandidates.length > 0) {
      const favFolder = zip.folder('favourites');
      for (const candidate of favoriteCandidates) {
        const file = fileMap.get(candidate.name);
        if (file) {
          favFolder.file(candidate.name, file);
        }
      }
    }

    // Create the main folder (accepted/rejected) for non-favorites
    if (nonFavoriteCandidates.length > 0) {
      const mainFolder = zip.folder(type === 'accepted' ? 'accepted' : 'rejected');
      for (const candidate of nonFavoriteCandidates) {
        const file = fileMap.get(candidate.name);
        if (file) {
          mainFolder.file(candidate.name, file);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_candidates.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Make all links open in new tab
  React.useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest('a');
      if (target && target.href && !target.target) {
        target.target = '_blank';
        target.rel = 'noopener noreferrer';
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  const CandidateCard = ({ candidate, idx, type }) => {
    const isFavorite = favorites.has(candidate.name);
    const bgColor = type === 'accepted' ? 'bg-green-100' : 'bg-red-100';
    const borderColor = type === 'accepted' ? 'border-green-100' : 'border-red-100';
    const buttonColor = type === 'accepted' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600';

    return (
      <div key={idx} className={`bg-white p-3 rounded-lg border ${borderColor}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-gray-800 flex-1 truncate text-sm">{candidate.name}</h3>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`${type === 'accepted' ? 'bg-green-500' : 'bg-red-500'} text-white px-2 py-0.5 rounded-full text-xs font-bold`}>
              {candidate.score}
            </span>
            <button
              onClick={() => toggleFavorite(candidate.name)}
              className="text-yellow-400 hover:text-yellow-500 transition-colors"
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
            </button>
          </div>
        </div>

        {candidate.error && (
          <div className="flex items-center gap-1 text-xs text-red-600 mb-1.5">
            <AlertCircle className="w-3 h-3" />
            <span className="text-xs">{candidate.error}</span>
          </div>
        )}

        {candidate.foundKeywords.length > 0 && (
          <div className="text-xs text-gray-700 mb-2">
            {candidate.foundKeywords.map((k, i) => (
              <span key={i} className={`${bgColor} ${type === 'accepted' ? 'text-green-700' : 'text-red-700'} px-1.5 py-0.5 rounded mr-1 mb-1 inline-block text-xs`}>
                {k.keyword} ({k.matches}×{k.points}pts)
              </span>
            ))}
          </div>
        )}

        {candidate.foundNegatives.length > 0 && (
          <div className="text-xs text-gray-700 mb-2">
            {candidate.foundNegatives.map((k, i) => (
              <span key={i} className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded mr-1 mb-1 inline-block text-xs">
                {k.keyword} ({k.matches}×)
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <button
            onClick={() => viewCV(candidate)}
            className="flex-1 px-2 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-1 text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            onClick={() => downloadCV(candidate.name)}
            className={`flex-1 px-2 py-1.5 ${buttonColor} text-white rounded transition-colors flex items-center justify-center gap-1 text-xs`}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-7 h-7 text-indigo-500" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">CV Scoring System</h1>
          </div>

          {/* Favorites Section */}
          {favorites.size > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <h2 className="text-sm font-semibold text-yellow-800">
                    Favorites ({favorites.size})
                  </h2>
                </div>
                <button
                  onClick={downloadFavoritesAsZip}
                  className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(favorites).map((name, idx) => (
                  <span key={idx} className="bg-white px-2 py-1 rounded border border-yellow-200 text-xs text-gray-700">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Positive Keywords */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h2 className="text-base font-semibold text-blue-800 mb-2">Positive Keywords (Weighted)</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Keyword"
                  value={newPosKeyword}
                  onChange={(e) => setNewPosKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPositiveKeyword()}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Weight"
                  value={newPosWeight}
                  onChange={(e) => setNewPosWeight(parseInt(e.target.value) || 5)}
                  className="w-20 px-3 py-2 text-sm text-gray-700 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  onClick={addPositiveKeyword}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                {positiveKeywords.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-sm text-gray-700">{item.keyword}</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">
                        W: {item.weight}
                      </span>
                      <button
                        onClick={() => removePositiveKeyword(index)}
                        className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative Keywords */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-100">
              <h2 className="text-base font-semibold text-red-800 mb-2">Negative Keywords</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Enter negative keyword"
                  value={newNegKeyword}
                  onChange={(e) => setNewNegKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNegativeKeyword()}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
                <button
                  onClick={addNegativeKeyword}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                {negativeKeywords.map((keyword, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-2 rounded-lg border border-red-100">
                    <span className="text-sm text-gray-700">{keyword}</span>
                    <button
                      onClick={() => removeNegativeKeyword(index)}
                      className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-200 rounded-lg cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-colors">
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-10 h-10 mb-2 text-indigo-400" />
                <p className="mb-1 text-sm font-medium text-gray-800">
                  Click to upload CVs (PDF or ZIP)
                </p>
                <p className="text-xs text-gray-600">Supports bulk upload</p>
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.zip"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-800 mb-2">
                  {files.length} file(s) uploaded
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 max-h-24 overflow-y-auto pr-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="text-xs text-gray-700 bg-gray-100 p-1.5 rounded border border-gray-200 truncate">
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Process Button */}
          <button
            onClick={processFiles}
            disabled={processing || files.length === 0}
            className="w-full py-2.5 bg-indigo-500 text-white rounded-lg font-medium text-sm hover:bg-indigo-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed mb-6"
          >
            {processing ? 'Processing CVs...' : `Process ${files.length} CV(s)`}
          </button>

          {/* Results */}
          {(results.accepted.length > 0 || results.rejected.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Accepted List */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-bold text-green-800">
                      Accepted ({results.accepted.length})
                    </h2>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => downloadAllAsZip('accepted')}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      ZIP
                    </button>
                    <button
                      onClick={() => exportResults('accepted')}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1 text-xs"
                    >
                      <File className="w-3 h-3" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-2">
                  {results.accepted.map((candidate, idx) => (
                    <CandidateCard key={idx} candidate={candidate} idx={idx} type="accepted" />
                  ))}
                </div>
              </div>

              {/* Rejected List */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <h2 className="text-lg font-bold text-red-800">
                      Rejected ({results.rejected.length})
                    </h2>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => downloadAllAsZip('rejected')}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      ZIP
                    </button>
                    <button
                      onClick={() => exportResults('rejected')}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1 text-xs"
                    >
                      <File className="w-3 h-3" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-2">
                  {results.rejected.map((candidate, idx) => (
                    <CandidateCard key={idx} candidate={candidate} idx={idx} type="rejected" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CLEAN CV VIEWER MODAL */}
          {viewingCandidate && (
            <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800 truncate">
                    {viewingCandidate.name}
                  </h2>
                  <button
                    onClick={closeViewer}
                    className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                  >
                    &times;
                  </button>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                  {pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Loading PDF...
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 text-right">
                  <button
                    onClick={closeViewer}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CVParserApp;
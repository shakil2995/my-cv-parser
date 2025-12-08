import React, { useState } from 'react';
import { Upload, Plus, X, Check, XCircle, Award, Search, Download, Settings, FolderArchive, Filter } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
export default function CVParser() {
  const [cvs, setCvs] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [rejectKeywords, setRejectKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newRejectKeyword, setNewRejectKeyword] = useState('');
  const [newWeight, setNewWeight] = useState(10);
  const [minScore, setMinScore] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

const handleFileUpload = async (e) => {
  const files = Array.from(e.target.files);
  const newCVs = await Promise.all(files.map(async (file) => {
    // Keep original file object for download
    return {
      id: Date.now() + Math.random(),
      name: file.name,
      content: (await file.text()).toLowerCase(),
      originalContent: await file.text(), // Keep original text for content display
      originalFile: file, // Add this line to keep the original file object
      uploadDate: new Date(),
      status: 'pending',
      score: 0,
      matchedCriteria: [],
      rejectedBy: []
    };
  }));
  
  const scoredCVs = newCVs.map(cv => scoreCV(cv));
  setCvs([...cvs, ...scoredCVs]);
};
const addCriterion = () => {
  if (newKeyword.trim()) {
    const newCriterion = {
      id: uuidv4(),
      keyword: newKeyword.trim(),
      weight: newWeight,
      type: 'must-have' // Default type
    };
    const updatedCriteria = [...criteria, newCriterion];
    setCriteria(updatedCriteria);
    setNewKeyword('');
    
    // Reset to default weight for next entry
    setNewWeight(10);
    
    // Only rescore if there are CVs
    if (cvs.length > 0) {
      const rescoredCVs = cvs.map(cv => scoreCV(cv, updatedCriteria, rejectKeywords));
      setCvs(rescoredCVs);
    }
  }
};
const addRejectKeyword = () => {
  if (newRejectKeyword.trim()) {
    const updatedRejectKeywords = [...rejectKeywords, newRejectKeyword.trim()];
    setRejectKeywords(updatedRejectKeywords);
    setNewRejectKeyword('');
    
    // Only rescore if there are CVs
    if (cvs.length > 0) {
      const rescoredCVs = cvs.map(cv => scoreCV(cv, criteria, updatedRejectKeywords));
      setCvs(rescoredCVs);
    }
  }
};

  const removeRejectKeyword = (keyword) => {
    const updatedRejectKeywords = rejectKeywords.filter(k => k !== keyword);
    setRejectKeywords(updatedRejectKeywords);
    const rescoredCVs = cvs.map(cv => scoreCV(cv, criteria, updatedRejectKeywords));
    setCvs(rescoredCVs);
  };

  const removeCriterion = (id) => {
    const updatedCriteria = criteria.filter(c => c.id !== id);
    setCriteria(updatedCriteria);
    const rescoredCVs = cvs.map(cv => scoreCV(cv, updatedCriteria, rejectKeywords));
    setCvs(rescoredCVs);
  };

  const updateCriterionType = (id, type) => {
    const updatedCriteria = criteria.map(c => 
      c.id === id ? { ...c, type } : c
    );
    setCriteria(updatedCriteria);
    const rescoredCVs = cvs.map(cv => scoreCV(cv, updatedCriteria, rejectKeywords));
    setCvs(rescoredCVs);
  };

const scoreCV = (cv, criteriaList = criteria, rejectList = rejectKeywords) => {
  if (criteriaList.length === 0 && rejectList.length === 0) {
    return { ...cv, score: 0, matchedCriteria: [], status: 'pending', rejectedBy: [] };
  }

  let totalScore = 0;
  let maxScore = 0;
  const matched = [];
  let hasMissingMustHave = false;
  let hasExcludingKeyword = false;
  const rejectedBy = [];

  // Check reject keywords first
  rejectList.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const occurrences = (cv.content.match(new RegExp(keywordLower, 'g')) || []).length;
    if (occurrences > 0) {
      hasExcludingKeyword = true;
      rejectedBy.push(keyword);
    }
  });

  // Check criteria
  criteriaList.forEach(criterion => {
    const keywordLower = criterion.keyword.toLowerCase();
    const occurrences = (cv.content.match(new RegExp(keywordLower, 'g')) || []).length;
    
    if (criterion.type === 'must-have') {
      maxScore += criterion.weight;
      if (occurrences > 0) {
        totalScore += criterion.weight;
        matched.push({ ...criterion, occurrences });
      } else {
        // Only mark as missing if no occurrences found
        hasMissingMustHave = true;
      }
    } else if (criterion.type === 'nice-to-have') {
      maxScore += criterion.weight;
      if (occurrences > 0) {
        totalScore += criterion.weight;
        matched.push({ ...criterion, occurrences });
      }
      // Nice-to-have keywords don't cause rejection if missing
    } else if (criterion.type === 'excluding') {
      if (occurrences > 0) {
        hasExcludingKeyword = true;
        rejectedBy.push(criterion.keyword);
      }
    }
  });

  const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  
  let status;
  if (hasExcludingKeyword || hasMissingMustHave) {
    status = 'rejected';
  } else if (scorePercentage >= minScore) {
    status = 'accepted';
  } else {
    status = 'rejected';
  }

  return {
    ...cv,
    score: scorePercentage,
    matchedCriteria: matched,
    status,
    rejectedBy
  };
};

  const applyScoring = () => {
    const rescoredCVs = cvs.map(cv => scoreCV(cv));
    setCvs(rescoredCVs);
  };

  const deleteCV = (id) => {
    setCvs(cvs.filter(cv => cv.id !== id));
  };

  const acceptedCVs = cvs.filter(cv => cv.status === 'accepted').sort((a, b) => b.score - a.score);
  const rejectedCVs = cvs.filter(cv => cv.status === 'rejected').sort((a, b) => b.score - a.score);
  const pendingCVs = cvs.filter(cv => cv.status === 'pending');

  const filteredAccepted = acceptedCVs.filter(cv => 
    cv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredRejected = rejectedCVs.filter(cv => 
    cv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportResults = () => {
    const data = cvs.map(cv => ({
      name: cv.name,
      status: cv.status,
      score: cv.score,
      matchedKeywords: cv.matchedCriteria.map(c => c.keyword).join('; '),
      rejectedBy: cv.rejectedBy.join('; ')
    }));
    const csv = [
      'Name,Status,Score,Matched Keywords,Rejected By',
      ...data.map(row => `"${row.name}","${row.status}",${row.score},"${row.matchedKeywords}","${row.rejectedBy}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cv-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

const downloadCVsByStatus = (status) => {
  const filteredCVs = cvs.filter(cv => cv.status === status);
  if (filteredCVs.length === 0) {
    alert(`No ${status} CVs to download`);
    return;
  }

  filteredCVs.forEach((cv, index) => {
    setTimeout(() => {
      // Use the original file object if available
      if (cv.originalFile) {
        const url = URL.createObjectURL(cv.originalFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${status}_${index + 1}_${cv.originalFile.name}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback to creating blob from original content
        const blob = new Blob([cv.originalContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${status}_${index + 1}_${cv.name}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, index * 100);
  });
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
<div className="w-full mx-auto px-4">    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <h1 className="text-4xl font-bold text-white mb-2">CV Parser</h1>
          <p className="text-purple-200">Define criteria, upload CVs, and automatically rank candidates</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Matching Criteria
              </h2>

              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="Enter keyword (e.g., Python, MBA)"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCriterion()}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-purple-200 mb-1">Weight</label>
                    <input
                      type="number"
                      value={newWeight}
                      onChange={(e) => setNewWeight(parseInt(e.target.value) || 0)}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <button
                    onClick={addCriterion}
                    className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              {criteria.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {criteria.map(c => (
                    <div key={c.id} className="bg-white/20 rounded-lg p-3 border border-white/30">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-white font-medium">{c.keyword}</span>
                        <button
                          onClick={() => removeCriterion(c.id)}
                          className="text-red-300 hover:text-red-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-purple-200">Weight: {c.weight}</span>
                      </div>
                      <select
                        value={c.type}
                        onChange={(e) => updateCriterionType(c.id, e.target.value)}
                        className="mt-2 w-full px-2 py-1 bg-white/20 border border-white/30 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        <option value="must-have" className="bg-slate-800">Must Have</option>
                        <option value="nice-to-have" className="bg-slate-800">Nice to Have</option>
                        <option value="excluding" className="bg-slate-800">Excluding</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/20 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Auto-Reject Keywords
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="e.g., competitor name"
                    value={newRejectKeyword}
                    onChange={(e) => setNewRejectKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRejectKeyword()}
                    className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  />
                  <button
                    onClick={addRejectKeyword}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {rejectKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {rejectKeywords.map((keyword, i) => (
                      <span key={i} className="px-2 py-1 bg-red-600/80 text-white text-xs rounded-full flex items-center gap-1">
                        {keyword}
                        <button
                          onClick={() => removeRejectKeyword(keyword)}
                          className="hover:text-red-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Settings
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-purple-200 mb-2">
                    Minimum Pass Score: {minScore}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minScore}
                    onChange={(e) => {
                      setMinScore(parseInt(e.target.value));
                      applyScoring();
                    }}
                    className="w-full"
                  />
                </div>

                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-purple-400 rounded-lg cursor-pointer hover:border-purple-300 hover:bg-white/5 transition">
                  <Upload className="w-6 h-6 text-purple-300 mb-1" />
                  <span className="text-sm text-purple-200">Upload CVs</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {cvs.length > 0 && (
                  <div className="space-y-2">
                    <button
                      onClick={exportResults}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                    
                    <button
                      onClick={() => downloadCVsByStatus('accepted')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <FolderArchive className="w-4 h-4" />
                      Download Accepted
                    </button>
                    
                    <button
                      onClick={() => downloadCVsByStatus('rejected')}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <FolderArchive className="w-4 h-4" />
                      Download Rejected
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/20 backdrop-blur-lg rounded-xl p-4 border border-green-400/30">
                <div className="text-3xl font-bold text-green-300">{acceptedCVs.length}</div>
                <div className="text-green-200 text-sm">Accepted</div>
              </div>
              <div className="bg-red-500/20 backdrop-blur-lg rounded-xl p-4 border border-red-400/30">
                <div className="text-3xl font-bold text-red-300">{rejectedCVs.length}</div>
                <div className="text-red-200 text-sm">Rejected</div>
              </div>
              <div className="bg-yellow-500/20 backdrop-blur-lg rounded-xl p-4 border border-yellow-400/30">
                <div className="text-3xl font-bold text-yellow-300">{pendingCVs.length}</div>
                <div className="text-yellow-200 text-sm">Pending</div>
              </div>
            </div>

            {cvs.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-300" />
                  <input
                    type="text"
                    placeholder="Search CVs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>
            )}

            {filteredAccepted.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-green-300 mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Accepted Candidates
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredAccepted.map((cv, index) => (
                    <div key={cv.id} className="bg-green-500/20 rounded-lg p-4 border border-green-400/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-400" />
                            <span className="text-white font-semibold">#{index + 1} - {cv.name}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="text-2xl font-bold text-green-300">{cv.score}%</div>
                            <div className="flex-1 bg-white/20 rounded-full h-3">
                              <div
                                className="bg-green-400 h-3 rounded-full transition-all"
                                style={{ width: `${cv.score}%` }}
                              />
                            </div>
                          </div>
                          {cv.matchedCriteria.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {cv.matchedCriteria.map((mc, i) => (
                                <span key={i} className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                                  ✓ {mc.keyword} ({mc.occurrences}x)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteCV(cv.id)}
                          className="text-red-300 hover:text-red-100 ml-2"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredRejected.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-semibold text-red-300 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Rejected Candidates
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {filteredRejected.map(cv => (
                    <div key={cv.id} className="bg-red-500/20 rounded-lg p-4 border border-red-400/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span className="text-white font-semibold">{cv.name}</span>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="text-xl font-bold text-red-300">{cv.score}%</div>
                            <div className="flex-1 bg-white/20 rounded-full h-2">
                              <div
                                className="bg-red-400 h-2 rounded-full transition-all"
                                style={{ width: `${cv.score}%` }}
                              />
                            </div>
                          </div>
                          {cv.rejectedBy.length > 0 && (
                            <div className="mt-2 text-xs text-red-200">
                              Rejected by: {cv.rejectedBy.join(', ')}
                            </div>
                          )}
                          {cv.matchedCriteria.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {cv.matchedCriteria.map((mc, i) => (
                                <span key={i} className="px-2 py-1 bg-red-800/50 text-red-200 text-xs rounded-full">
                                  {mc.keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteCV(cv.id)}
                          className="text-red-300 hover:text-red-100 ml-2"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingCVs.length > 0 && criteria.length === 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="text-center text-purple-200">
                  <Search className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                  <p className="text-lg">Add matching criteria to start ranking CVs</p>
                </div>
              </div>
            )}

            {cvs.length === 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20">
                <div className="text-center text-purple-200">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-purple-300" />
                  <p className="text-lg">Upload CVs to get started</p>
                  <p className="text-sm mt-2">Define your criteria, then upload candidate resumes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    
  );
}
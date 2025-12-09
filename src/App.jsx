import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Download, Plus, Trash2, AlertCircle, Eye, File } from 'lucide-react';

const CVParserApp = () => {
  const [files, setFiles] = useState([]);
  const [positiveKeywords, setPositiveKeywords] = useState([
    { keyword: 'react', weight: 10 },
    { keyword: 'javascript', weight: 8 },
    { keyword: 'node.js', weight: 8 }
  ]);
  const [negativeKeywords, setNegativeKeywords] = useState(['no experience', 'beginner']);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ accepted: [], rejected: [] });
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

  const calculateScore = (text) => {
    const lowerText = text.toLowerCase();
    let score = 0;
    const foundKeywords = [];
    const foundNegatives = [];

    positiveKeywords.forEach(({ keyword, weight }) => {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = (lowerText.match(regex) || []).length;
      if (matches > 0) {
        const points = matches * weight;
        score += points;
        foundKeywords.push({ keyword, matches, points });
      }
    });

    negativeKeywords.forEach(keyword => {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = (lowerText.match(regex) || []).length;
      if (matches > 0) {
        score -= matches * 5;
        foundNegatives.push({ keyword, matches });
      }
    });

    return { score, foundKeywords, foundNegatives };
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
    const accepted = [];
    const rejected = [];

    try {
      for (const file of files) {
        try {
          const text = await extractTextFromPdf(file);
          const { score, foundKeywords, foundNegatives } = calculateScore(text);
          
          const candidate = {
            name: file.name,
            score,
            foundKeywords,
            foundNegatives,
            text: text.substring(0, 500) + '...',
            fullText: text // Store full text for viewing
          };

          if (score >= 20) {
            accepted.push(candidate);
          } else {
            rejected.push(candidate);
          }
        } catch (error) {
          rejected.push({
            name: file.name,
            score: 0,
            error: error.message,
            foundKeywords: [],
            foundNegatives: [],
            fullText: 'Error loading CV'
          });
        }
      }

      accepted.sort((a, b) => b.score - a.score);
      rejected.sort((a, b) => b.score - a.score);

      setResults({ accepted, rejected });
    } catch (error) {
      alert('Error processing files: ' + error.message);
    } finally {
      setProcessing(false);
    }
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
    const folder = zip.folder(type === 'accepted' ? 'Accepted_CVs' : 'Rejected_CVs');

    for (const candidate of candidates) {
      const file = fileMap.get(candidate.name);
      if (file) {
        folder.file(candidate.name, file);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">CV Parser & Scoring System</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Positive Keywords */}
            <div className="bg-green-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-800 mb-4">Positive Keywords (Weighted)</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Keyword"
                  value={newPosKeyword}
                  onChange={(e) => setNewPosKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPositiveKeyword()}
                  className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="Weight"
                  value={newPosWeight}
                  onChange={(e) => setNewPosWeight(parseInt(e.target.value) || 5)}
                  className="w-20 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={addPositiveKeyword}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {positiveKeywords.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <span className="text-gray-700">{item.keyword}</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-green-200 text-green-800 px-2 py-1 rounded text-sm font-semibold">
                        Weight: {item.weight}
                      </span>
                      <button
                        onClick={() => removePositiveKeyword(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative Keywords */}
            <div className="bg-red-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-4">Negative Keywords</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Enter negative keyword"
                  value={newNegKeyword}
                  onChange={(e) => setNewNegKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNegativeKeyword()}
                  className="flex-1 px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  onClick={addNegativeKeyword}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {negativeKeywords.map((keyword, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <span className="text-gray-700">{keyword}</span>
                    <button
                      onClick={() => removeNegativeKeyword(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-8">
            <label className="flex flex-col items-center justify-center w-full h-48 border-4 border-dashed border-indigo-300 rounded-xl cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-16 h-16 mb-4 text-indigo-500" />
                <p className="mb-2 text-lg font-semibold text-gray-700">
                  Click to upload CVs (PDF or ZIP)
                </p>
                <p className="text-sm text-gray-500">Supports bulk upload and zip files</p>
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
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {files.length} file(s) uploaded
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {files.map((file, idx) => (
                    <div key={idx} className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
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
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing CVs...' : `Process ${files.length} CV(s)`}
          </button>

          {/* Results */}
          {(results.accepted.length > 0 || results.rejected.length > 0) && (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Accepted List */}
              <div className="bg-green-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h2 className="text-2xl font-bold text-green-800">
                      Accepted ({results.accepted.length})
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadAllAsZip('accepted')}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      ZIP
                    </button>
                    <button
                      onClick={() => exportResults('accepted')}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                    >
                      <File className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results.accepted.map((candidate, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800 flex-1">{candidate.name}</h3>
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {candidate.score}
                        </span>
                      </div>
                      {candidate.foundKeywords.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2 mb-3">
                          <span className="font-semibold">Matches: </span>
                          {candidate.foundKeywords.map((k, i) => (
                            <span key={i} className="bg-green-200 px-2 py-1 rounded mr-1">
                              {k.keyword} ({k.matches}×{k.points}pts)
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewCV(candidate)}
                          className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-1 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => downloadCV(candidate.name)}
                          className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-1 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejected List */}
              <div className="bg-red-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <h2 className="text-2xl font-bold text-red-800">
                      Rejected ({results.rejected.length})
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadAllAsZip('rejected')}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      ZIP
                    </button>
                    <button
                      onClick={() => exportResults('rejected')}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1"
                    >
                      <File className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results.rejected.map((candidate, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-800 flex-1">{candidate.name}</h3>
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {candidate.score}
                        </span>
                      </div>
                      {candidate.error && (
                        <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
                          <AlertCircle className="w-4 h-4" />
                          {candidate.error}
                        </div>
                      )}
                      {candidate.foundNegatives.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2 mb-3">
                          <span className="font-semibold">Issues: </span>
                          {candidate.foundNegatives.map((k, i) => (
                            <span key={i} className="bg-red-200 px-2 py-1 rounded mr-1">
                              {k.keyword} ({k.matches}×)
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewCV(candidate)}
                          className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-1 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => downloadCV(candidate.name)}
                          className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-1 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CV Viewer Modal */}
          {viewingCandidate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{viewingCandidate.name}</h2>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        Score: {viewingCandidate.score}
                      </span>
                      {viewingCandidate.foundKeywords.length > 0 && (
                        <span className="inline-block bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {viewingCandidate.foundKeywords.length} Matches
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={closeViewer}
                    className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                  >
                    ×
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                  {viewingCandidate.foundKeywords.length > 0 && (
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm">
                      <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Positive Matches:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingCandidate.foundKeywords.map((k, i) => (
                          <span key={i} className="bg-green-100 text-green-800 px-3 py-1 rounded-lg border border-green-300">
                            <strong>{k.keyword}</strong> - {k.matches} matches ({k.points} pts)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingCandidate.foundNegatives.length > 0 && (
                    <div className="mb-4 bg-white p-4 rounded-lg shadow-sm">
                      <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                        <XCircle className="w-5 h-5" />
                        Negative Matches:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {viewingCandidate.foundNegatives.map((k, i) => (
                          <span key={i} className="bg-red-100 text-red-800 px-3 py-1 rounded-lg border border-red-300">
                            <strong>{k.keyword}</strong> - {k.matches} matches
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pdfUrl ? (
                    <div className="mb-4 bg-white rounded-lg shadow-lg overflow-hidden">
                      <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          PDF Preview
                        </h3>
                        <span className="text-sm text-gray-300">Use scroll to navigate pages</span>
                      </div>
                      <iframe
                        src={pdfUrl}
                        className="w-full h-[600px] border-0"
                        title="CV Preview"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 bg-white p-8 rounded-lg shadow-sm text-center">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">PDF preview not available</p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t flex gap-3 bg-gray-50">
                  <button
                    onClick={() => downloadCV(viewingCandidate.name)}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Download Original PDF
                  </button>
                  <button
                    onClick={closeViewer}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
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
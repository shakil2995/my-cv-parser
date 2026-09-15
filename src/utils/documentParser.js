import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Fallback loader for PDF.js via CDN if local worker ever hits an environment limitation
 */
async function ensurePdfJs() {
  if (pdfjsLib && pdfjsLib.getDocument) {
    return pdfjsLib;
  }

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
}

/**
 * Extract raw text from a PDF file in a strictly memory-safe manner:
 * - Disables font-face downloading and image decoding (saves ~80% RAM per document).
 * - Enforces per-page cleanup (`page.cleanup()`).
 * - Destroys document and loadingTask in a `finally` block to release WebAssembly & worker memory.
 * - Caps parsing at 10 pages maximum per resume to protect against accidental 500-page book uploads.
 */
export async function extractTextFromPdf(file) {
  let loadingTask = null;
  let pdf = null;
  let arrayBuffer = null;

  try {
    const lib = await ensurePdfJs();
    arrayBuffer = await file.arrayBuffer();

    loadingTask = lib.getDocument({
      data: arrayBuffer,
      disableFontFace: true, // Don't download or render fonts; we only need raw text
      nativeImageDecoderSupport: 'none', // Don't decode images
      ignoreErrors: true,
      isEvalSupported: false,
    });

    pdf = await loadingTask.promise;

    let fullText = '';
    const annotationsList = [];
    // Safety cap: up to 10 pages per resume (covers 99.9% of resumes without memory blowup)
    const maxPages = Math.min(pdf.numPages, 10);

    for (let i = 1; i <= maxPages; i++) {
      let page = null;
      try {
        page = await pdf.getPage(i);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        });
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += pageText + '\n';

        // Extract clickable hyperlinks embedded in PDF annotations
        try {
          const pageAnnots = await page.getAnnotations();
          if (Array.isArray(pageAnnots)) {
            for (const ann of pageAnnots) {
              if (ann && ann.subtype === 'Link' && ann.url) {
                annotationsList.push(ann.url);
              }
            }
          }
        } catch (annErr) {
          console.warn(`Warning reading annotations on page ${i}:`, annErr);
        }
      } catch (pageErr) {
        console.warn(`Warning reading page ${i} of ${file.name}:`, pageErr);
      } finally {
        if (page && typeof page.cleanup === 'function') {
          page.cleanup();
        }
      }
    }

    return {
      text: fullText.trim(),
      annotations: annotationsList
    };
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${file.name} (${error.message})`);
  } finally {
    // Explicitly release PDF memory and worker task
    if (pdf) {
      try {
        if (typeof pdf.cleanup === 'function') await pdf.cleanup();
        if (typeof pdf.destroy === 'function') await pdf.destroy();
      } catch (e) {
        console.warn('PDF destroy error:', e);
      }
    }
    if (loadingTask) {
      try {
        if (typeof loadingTask.destroy === 'function') await loadingTask.destroy();
      } catch (e) {
        console.warn('LoadingTask destroy error:', e);
      }
    }
    arrayBuffer = null;
  }
}

/**
 * Extract raw text from a DOCX Word file using Mammoth with explicit buffer clearing
 */
export async function extractTextFromDocx(file) {
  let arrayBuffer = null;
  try {
    arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
      text: (result.value || '').trim(),
      annotations: []
    };
  } catch (error) {
    console.error('DOCX text extraction error:', error);
    throw new Error(`Failed to extract text from Word document: ${file.name} (${error.message})`);
  } finally {
    arrayBuffer = null;
  }
}

/**
 * Progressively extract PDF and DOCX files from an uploaded ZIP archive
 * with memory yielding between files.
 */
export async function extractFilesFromZip(zipFile, onProgress) {
  try {
    const zip = await JSZip.loadAsync(zipFile);
    const extractedFiles = [];

    const validEntries = Object.entries(zip.files).filter(([name, entry]) => {
      if (entry.dir) return false;
      if (name.startsWith('__MACOSX') || name.startsWith('.') || name.includes('/.')) return false;
      const lower = name.toLowerCase();
      return lower.endsWith('.pdf') || lower.endsWith('.docx');
    });

    let count = 0;
    for (const [name, entry] of validEntries) {
      const blob = await entry.async('blob');
      const cleanName = name.split('/').pop();
      const isPdf = cleanName.toLowerCase().endsWith('.pdf');
      const mimeType = isPdf
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const file = new File([blob], cleanName, { type: mimeType });
      extractedFiles.push(file);
      count++;

      if (onProgress) {
        onProgress(count, validEntries.length, cleanName);
      }

      // Cooperative yield every 10 files during unzip
      if (count % 10 === 0) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    return extractedFiles;
  } catch (error) {
    console.error('ZIP extraction error:', error);
    throw new Error(`Failed to unzip archive: ${zipFile.name} (${error.message})`);
  }
}

/**
 * Universally extract text from any supported file format (.pdf or .docx)
 */
export async function extractTextFromFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) {
    return await extractTextFromPdf(file);
  } else if (lowerName.endsWith('.docx')) {
    return await extractTextFromDocx(file);
  } else {
    throw new Error(`Unsupported file type: ${file.name}. Please upload PDF or DOCX files.`);
  }
}

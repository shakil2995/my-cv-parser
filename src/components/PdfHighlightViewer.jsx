import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { findHighlightRanges } from '../utils/highlightRanges';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

// Resumes are short; this only guards against accidental book-length uploads.
const MAX_PAGES = 20;
const PAGE_GUTTER_PX = 24;
const MAX_SCALE = 2;

/**
 * Wrap highlight ranges inside the pdf.js text layer spans of one page.
 * Page text is built by joining items with ' ', the same way documentParser builds the
 * text the scorer sees, so a highlight appears exactly where a match was counted.
 */
function applyHighlights(textDivs, itemStrs, positives, negatives) {
  const offsets = [];
  let pageText = '';
  itemStrs.forEach((str, i) => {
    if (i > 0) pageText += ' ';
    offsets.push(pageText.length);
    pageText += str;
  });

  const ranges = findHighlightRanges(pageText, positives, negatives);

  textDivs.forEach((div, i) => {
    const str = itemStrs[i];
    const itemStart = offsets[i];
    const itemEnd = itemStart + str.length;
    const hits = ranges.filter((r) => r.start < itemEnd && r.end > itemStart);

    if (hits.length === 0) {
      if (div.dataset.highlighted) {
        div.textContent = str;
        delete div.dataset.highlighted;
      }
      return;
    }

    const frag = document.createDocumentFragment();
    let cursor = 0;
    hits.forEach((r) => {
      const s = Math.max(r.start, itemStart) - itemStart;
      const e = Math.min(r.end, itemEnd) - itemStart;
      if (s > cursor) frag.append(str.slice(cursor, s));
      const mark = document.createElement('mark');
      const isReject = r.kind === 'reject';
      const strong = isReject ? r.type === 'disqualifier' : r.mustHave;
      mark.className = `pdf-hl pdf-hl-${isReject ? 'reject' : 'accept'}${strong ? ' pdf-hl-strong' : ''}`;
      mark.title = isReject
        ? `${r.type === 'disqualifier' ? 'Disqualifier' : 'Penalty'}: ${r.keyword}`
        : `${r.mustHave ? 'Must-have skill' : 'Matched skill'}: ${r.keyword}`;
      mark.textContent = str.slice(s, e);
      frag.append(mark);
      cursor = e;
    });
    if (cursor < str.length) frag.append(str.slice(cursor));

    div.replaceChildren(frag);
    div.dataset.highlighted = '1';
  });
}

function PdfPage({ pdf, pageNumber, width, positives, negatives }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const wrapperRef = useRef(null);
  const textStateRef = useRef(null);
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    if (!width) return undefined;
    let cancelled = false;
    let renderTask = null;
    let textLayer = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(width / baseViewport.width, MAX_SCALE);
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      const wrapper = wrapperRef.current;
      wrapper.style.setProperty('--scale-factor', String(scale));
      wrapper.style.setProperty('--total-scale-factor', String(scale));
      wrapper.style.width = `${Math.floor(viewport.width)}px`;
      wrapper.style.height = `${Math.floor(viewport.height)}px`;

      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });

      const textContent = await page.getTextContent();
      if (cancelled) return;

      const container = textLayerRef.current;
      container.replaceChildren();
      textLayer = new pdfjsLib.TextLayer({ textContentSource: textContent, container, viewport });
      await textLayer.render();
      if (cancelled) return;

      textStateRef.current = {
        textDivs: textLayer.textDivs,
        itemStrs: textLayer.textContentItemsStr,
      };
      setRendered((n) => n + 1);

      await renderTask.promise;
    })().catch((err) => {
      if (!cancelled && err?.name !== 'RenderingCancelledException') {
        console.warn(`PDF page ${pageNumber} render error:`, err);
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, pageNumber, width]);

  // Re-apply without re-rendering the page when keywords change
  useEffect(() => {
    const state = textStateRef.current;
    if (!state) return;
    applyHighlights(state.textDivs, state.itemStrs, positives, negatives);
  }, [rendered, positives, negatives]);

  return (
    <div ref={wrapperRef} className="pdf-page relative bg-white shadow-2xl rounded-sm overflow-hidden mx-auto">
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
}

/**
 * Renders a PDF with pdf.js (canvas + text layer) and highlights matched skills (green)
 * and negative keywords (red) on top of the original layout.
 */
export default function PdfHighlightViewer({ file, positives = [], negatives = [], fallback = null }) {
  const scrollRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    let loadingTask = null;
    let doc = null;

    (async () => {
      const data = await file.arrayBuffer();
      if (cancelled) return;
      loadingTask = pdfjsLib.getDocument({ data, isEvalSupported: false });
      doc = await loadingTask.promise;
      if (cancelled) {
        doc.destroy();
        return;
      }
      setPdf(doc);
    })().catch((err) => {
      if (!cancelled) {
        console.error('PDF viewer load error:', err);
        setError(err);
      }
    });

    return () => {
      cancelled = true;
      if (doc) doc.destroy();
      else loadingTask?.destroy();
    };
  }, [file]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let timer = null;
    const measure = () => setWidth(Math.max(0, Math.floor(el.clientWidth - PAGE_GUTTER_PX * 2)));
    measure();
    // Debounced so dragging the window doesn't re-render every page on every frame
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (error) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-full text-rose-400 text-xs">
          Could not render this PDF.
        </div>
      )
    );
  }

  const pageCount = pdf ? Math.min(pdf.numPages, MAX_PAGES) : 0;

  return (
    <div ref={scrollRef} className="w-full h-full overflow-y-auto overflow-x-hidden">
      {!pdf ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-xs">Rendering PDF...</div>
      ) : (
        <div className="flex flex-col gap-4 py-2">
          {Array.from({ length: pageCount }, (_, i) => (
            <PdfPage
              key={i + 1}
              pdf={pdf}
              pageNumber={i + 1}
              width={width}
              positives={positives}
              negatives={negatives}
            />
          ))}
          {pdf.numPages > MAX_PAGES && (
            <p className="text-center text-[11px] text-slate-500">
              Showing first {MAX_PAGES} of {pdf.numPages} pages. Open the original to see the rest.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { getPaperFileUrl, createNote } from "../api/client";

const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs";

export default function PdfViewer({ paperId, currentPage, onPageChange, onTextSelect }) {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.2);
  const renderingRef = useRef(false);
  const textLayersRef = useRef({});
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdf(null);

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        const url = getPaperFileUrl(paperId);
        const loadingTask = pdfjsLib.getDocument(url);
        const _pdf = await loadingTask.promise;
        if (!cancelled) {
          setPdf(_pdf);
          setTotalPages(_pdf.numPages);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [paperId]);

  const renderPage = useCallback(async (pageNum) => {
    if (!pdf || !containerRef.current || renderingRef.current) return;
    renderingRef.current = true;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      let canvas = containerRef.current.querySelector(`[data-page="${pageNum}"]`);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.dataset.page = pageNum;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "mb-2 mx-auto block";
        containerRef.current.appendChild(canvas);
      } else {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
      }
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (selectionMode) {
        const textContent = await page.getTextContent();
        const textLayerDiv = containerRef.current.querySelector(`[data-text-layer="${pageNum}"]`) || document.createElement("div");
        textLayerDiv.dataset.textLayer = pageNum;
        textLayerDiv.className = "absolute top-0 left-0 pointer-events-none select-text";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.transform = `scale(${1/scale})`;
        textLayerDiv.style.transformOrigin = "top left";
        
        if (!containerRef.current.querySelector(`[data-text-layer="${pageNum}"]`)) {
          const pageContainer = containerRef.current.querySelector(`[data-page="${pageNum}"]`).parentElement;
          if (pageContainer) {
            pageContainer.style.position = "relative";
            pageContainer.appendChild(textLayerDiv);
          }
        }
        
        const pdfjsLib = await import("pdfjs-dist");
        await pdfjsLib.renderTextLayer({
          textContent,
          container: textLayerDiv,
          viewport,
          textDivs: [],
        });
      }
    } catch (e) {
      console.error("Render error:", e);
    } finally {
      renderingRef.current = false;
    }
  }, [pdf, scale, selectionMode]);

  useEffect(() => {
    if (!pdf) return;
    const start = Math.max(1, (currentPage || 1) - 1);
    const end = Math.min(totalPages, (currentPage || 1) + 2);
    for (let i = start; i <= end; i++) {
      renderPage(i);
    }
  }, [pdf, currentPage, totalPages, renderPage]);

  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    containerRef.current.innerHTML = "";
    const start = Math.max(1, (currentPage || 1) - 1);
    const end = Math.min(totalPages, (currentPage || 1) + 2);
    for (let i = start; i <= end; i++) {
      renderPage(i);
    }
  }, [scale, selectionMode]);

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    onPageChange?.(clamped);
  };

  const handleTextSelection = useCallback(() => {
    if (!selectionMode) return;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const pageElement = container.closest('[data-page]');
        if (pageElement) {
          const pageNum = parseInt(pageElement.dataset.page, 10);
          if (onTextSelect) {
            onTextSelect(text, pageNum);
          }
        }
        selection.removeAllRanges();
      }
    }
  }, [selectionMode, onTextSelect]);

  useEffect(() => {
    if (selectionMode) {
      document.addEventListener("mouseup", handleTextSelection);
      return () => document.removeEventListener("mouseup", handleTextSelection);
    }
  }, [selectionMode, handleTextSelection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-container-low rounded-xl">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
          </svg>
          <p className="text-body-sm text-on-surface-variant">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-container-low rounded-xl">
        <div className="text-center px-6">
          <span className="material-symbols-outlined text-4xl text-outline-variant/40 mb-2 block">description</span>
          <p className="text-body-md text-on-surface-variant">{error}</p>
          <p className="text-body-sm text-on-surface-variant/60 mt-1">Original file may not be a PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-container-lowest border-b border-outline-variant/40 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => goToPage((currentPage || 1) - 1)} disabled={(currentPage || 1) <= 1}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container disabled:opacity-30">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <span className="text-[12px] text-on-surface font-medium">
            Page <input type="number" value={currentPage || 1} min={1} max={totalPages}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 text-center border border-outline-variant/60 rounded px-1 py-0.5 text-[12px] mx-1 bg-surface-container-lowest text-on-surface" />
            / {totalPages}
          </span>
          <button onClick={() => goToPage((currentPage || 1) + 1)} disabled={(currentPage || 1) >= totalPages}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container disabled:opacity-30">
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container" title="Zoom out">
            <span className="material-symbols-outlined text-[16px]">zoom_out</span>
          </button>
          <span className="text-[11px] text-on-surface-variant w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container" title="Zoom in">
            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
          </button>
          <button 
            onClick={() => setSelectionMode(!selectionMode)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${selectionMode ? "bg-primary/10 text-primary" : "hover:bg-surface-container text-on-surface-variant"}`}
            title={selectionMode ? "Exit highlight mode" : "Enter highlight mode"}
          >
            <span className="material-symbols-outlined text-[18px]">{selectionMode ? "highlight_off" : "highlight"}</span>
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-4 custom-scrollbar" />
      {selectionMode && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-on-primary px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm animate-slide-up">
          <span className="material-symbols-outlined">touch_app</span>
          <span>Select text to save as note</span>
        </div>
      )}
    </div>
  );
}
function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdfArrayBuffer(arrayBuffer) {
  if (!arrayBuffer) return "";
  const bytes = new Uint8Array(arrayBuffer);

  // Use legacy build for Node compatibility in Next.js route handlers.
  // Also explicitly point to the worker entry in node_modules; otherwise
  // Next.js may bundle `./pdf.worker.mjs` as a server chunk that doesn't exist.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  try {
    const { createRequire } = await import("module");
    const { pathToFileURL } = await import("url");
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
    }
  } catch {
    // If this fails, pdf.js will use its default worker resolution.
  }

  // Force "fake worker" (in-process) for stability in Node route handlers.
  const loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true });
  const pdf = await loadingTask.promise;

  let out = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content?.items || [])
      .map((item) => (item && item.str ? String(item.str) : ""))
      .filter(Boolean)
      .join(" ");
    out += `${pageText}\n\n`;
  }

  return normalizeWhitespace(out);
}

export function clampText(text, maxChars) {
  const str = String(text || "");
  if (!maxChars || str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}\n\n[TRUNCATED: ${str.length - maxChars} chars removed]`;
}


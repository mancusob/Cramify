"use client";

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromPdfFile(file) {
  if (!file) return "";
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Webpack entry configures worker for the browser build.
  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const loadingTask = pdfjs.getDocument({ data: bytes });
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


/** A PDF filename from the document title, without characters that filesystems reject. */
export function pdfFileName(title: string): string {
  const safe = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/[. ]+$/, "");
  return `${safe || "Document"}.pdf`;
}

/** Triggers a browser download of the blob under the given filename. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking immediately can cancel the download before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

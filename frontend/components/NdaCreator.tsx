"use client";

import { useMemo, useState } from "react";
import { defaultValues, documentTitle, fillCoverPage, pdfFileName, type NdaValues } from "@/lib/nda";
import { NdaDocument } from "./NdaDocument";
import { NdaForm } from "./NdaForm";

type Props = {
  coverPageTemplate: string;
  standardTerms: string;
};

/** Triggers a browser download of the blob under the given filename. */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking immediately can cancel the download before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function NdaCreator({ coverPageTemplate, standardTerms }: Props) {
  const [values, setValues] = useState<NdaValues>(defaultValues);
  const coverPage = useMemo(() => fillCoverPage(coverPageTemplate, values), [coverPageTemplate, values]);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      // Loaded on demand: the PDF renderer is large and only needed when downloading.
      const [{ pdf }, { NdaPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./NdaPdf")]);
      const blob = await pdf(
        <NdaPdf title={documentTitle(values)} coverPage={coverPage} standardTerms={standardTerms} />,
      ).toBlob();
      saveFile(blob, pdfFileName(values));
    } catch (error) {
      console.error("Failed to generate the PDF", error);
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block print:p-0">
      <aside className="print:hidden lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-2">
        {/* Not an <h1>: the agreement's own title is the page's main heading. */}
        <p className="text-2xl font-semibold text-neutral-900">Mutual NDA creator</p>
        <p className="mt-1 mb-6 text-sm text-neutral-600">
          Fill in the key terms. The agreement on the right updates as you type.
        </p>
        <NdaForm values={values} onChange={setValues} />
      </aside>

      <main className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <h2 className="text-sm font-medium text-neutral-500">Preview</h2>
          <div className="flex items-center gap-3">
            {downloadError && (
              <p role="alert" className="text-sm text-red-700">
                Couldn&apos;t create the PDF. Please try again.
              </p>
            )}
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="rounded-md bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-purple/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm sm:p-12 print:border-0 print:p-0 print:shadow-none">
          <NdaDocument coverPage={coverPage} standardTerms={standardTerms} />
        </div>
      </main>
    </div>
  );
}

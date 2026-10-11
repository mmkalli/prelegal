"use client";

import { useMemo, useState } from "react";
import { defaultValues, fillCoverPage, type NdaValues } from "@/lib/nda";
import { NdaDocument } from "./NdaDocument";
import { NdaForm } from "./NdaForm";

type Props = {
  coverPageTemplate: string;
  standardTerms: string;
};

/** Suggests a PDF filename via the document title, which browsers use for "Save as PDF". */
function pdfTitle(values: NdaValues): string {
  const companies = [values.party1.company, values.party2.company].map((c) => c.trim()).filter(Boolean);
  return ["Mutual NDA", ...companies].join(" - ");
}

export function NdaCreator({ coverPageTemplate, standardTerms }: Props) {
  const [values, setValues] = useState<NdaValues>(defaultValues);
  const coverPage = useMemo(() => fillCoverPage(coverPageTemplate, values), [coverPageTemplate, values]);

  const downloadPdf = () => {
    const originalTitle = document.title;
    document.title = pdfTitle(values);
    window.addEventListener("afterprint", () => (document.title = originalTitle), { once: true });
    window.print();
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
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Download PDF
          </button>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm sm:p-12 print:border-0 print:p-0 print:shadow-none">
          <NdaDocument coverPage={coverPage} standardTerms={standardTerms} />
        </div>
      </main>
    </div>
  );
}

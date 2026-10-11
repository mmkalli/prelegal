import Markdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

// rehype-raw renders the templates' <span>/<label> markup. This is safe because user input is
// escaped by fillCoverPage before it reaches the markdown.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

const coverPageComponents: Components = {
  // Task list checkboxes omit `checked` when unticked, which React treats as uncontrolled and
  // never unticks. Always pass a boolean so toggling an option updates the preview.
  input: ({ type, disabled, checked }) => (
    <input type={type} disabled={disabled} checked={Boolean(checked)} readOnly />
  ),
};

const standardTermsComponents: Components = {
  // The agreement title on the cover page is the page's only <h1>.
  h1: ({ children }) => <h2 className="nda-terms-title">{children}</h2>,
};

type Props = {
  coverPage: string;
  standardTerms: string;
};

export function NdaDocument({ coverPage, standardTerms }: Props) {
  return (
    <article className="nda-document prose prose-sm max-w-none prose-neutral">
      <section>
        <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={coverPageComponents}>
          {coverPage}
        </Markdown>
      </section>
      <section className="nda-standard-terms">
        <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={standardTermsComponents}>
          {standardTerms}
        </Markdown>
      </section>
    </article>
  );
}

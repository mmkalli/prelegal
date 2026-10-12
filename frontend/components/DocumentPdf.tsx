// Renders a document's markdown as a real (text-based) PDF with @react-pdf/renderer.
// Loaded on demand when the user clicks "Download PDF", so the PDF library isn't in the page bundle.

import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import type { List, PhrasingContent, Root, RootContent, Table } from "mdast";
import type { ReactNode } from "react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { DISCLAIMER } from "./Disclaimer";

// Legal text reads badly with words hyphenated across lines.
Font.registerHyphenationCallback((word) => [word]);

const parser = unified().use(remarkParse).use(remarkGfm);

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 84,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
    color: "#171717",
  },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 20, marginBottom: 14 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 6, marginBottom: 8 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 12, marginBottom: 4 },
  paragraph: { marginBottom: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },
  link: { color: "#171717" },
  variable: { fontFamily: "Helvetica-Bold" },
  hint: { fontSize: 8, color: "#737373" },
  listItem: { flexDirection: "row", marginBottom: 8 },
  listMarker: { width: 20 },
  listBody: { flex: 1 },
  checkbox: {
    width: 9,
    height: 9,
    marginTop: 2.5,
    marginRight: 8,
    borderWidth: 0.75,
    borderColor: "#404040",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { fontFamily: "Helvetica-Bold", fontSize: 7, lineHeight: 1 },
  table: { marginTop: 4, marginBottom: 12, borderTopWidth: 0.75, borderColor: "#d4d4d4" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.75, borderColor: "#d4d4d4", minHeight: 24 },
  tableCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 4 },
  tableLabelCell: { flex: 1.3 },
  tableHeader: { fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 64,
    right: 64,
    fontSize: 7,
    lineHeight: 1.3,
    color: "#888888",
  },
});

// The templates mark variables with <span class="coverpage_link">, "keyterms_link", "orderform_link"...
const VARIABLE = /class="\w+_link"/;

/**
 * Renders inline markdown. The templates mark variables and hints with raw HTML
 * (`<span class="..._link">`, `<label>`), which arrives as separate open/close `html` nodes.
 */
function renderInline(nodes: PhrasingContent[]): ReactNode[] {
  const styleStack: Styles[string][] = [];
  const output: ReactNode[] = [];
  nodes.forEach((node, index) => {
    if (node.type === "html") {
      if (/^<\//.test(node.value)) styleStack.pop();
      else if (VARIABLE.test(node.value)) styleStack.push(styles.variable);
      else if (node.value.startsWith("<label")) styleStack.push(styles.hint);
      else if (node.value.startsWith("<span")) styleStack.push({});
      return;
    }
    output.push(
      <Text key={index} style={[...styleStack]}>
        {renderPhrasing(node)}
      </Text>,
    );
  });
  return output;
}

function renderPhrasing(node: PhrasingContent): ReactNode {
  switch (node.type) {
    case "text":
    case "inlineCode":
      return node.value;
    case "strong":
      return <Text style={styles.bold}>{renderInline(node.children)}</Text>;
    case "emphasis":
      return <Text style={styles.italic}>{renderInline(node.children)}</Text>;
    case "link":
      return (
        <Link src={node.url} style={styles.link}>
          {renderInline(node.children)}
        </Link>
      );
    case "break":
      return "\n";
    default:
      return null;
  }
}

function Checkbox({ checked }: { checked: boolean }) {
  return <View style={styles.checkbox}>{checked && <Text style={styles.checkmark}>X</Text>}</View>;
}

function renderList(list: List, key: number): ReactNode {
  const start = list.start ?? 1;
  return (
    <View key={key}>
      {list.children.map((item, index) => {
        const isTask = typeof item.checked === "boolean";
        return (
          <View key={index} style={styles.listItem} wrap={!isTask}>
            {isTask ? (
              <Checkbox checked={item.checked === true} />
            ) : (
              <Text style={styles.listMarker}>{list.ordered ? `${start + index}.` : "•"}</Text>
            )}
            <View style={styles.listBody}>{item.children.map(renderBlock)}</View>
          </View>
        );
      })}
    </View>
  );
}

function renderTable(table: Table, key: number): ReactNode {
  return (
    <View key={key} style={styles.table}>
      {table.children.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.tableRow} wrap={false}>
          {row.children.map((cell, cellIndex) => (
            <Text
              key={cellIndex}
              style={[
                styles.tableCell,
                cellIndex === 0 ? styles.tableLabelCell : {},
                rowIndex === 0 ? styles.tableHeader : {},
              ]}
            >
              {renderInline(cell.children)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function renderBlock(node: RootContent, key: number): ReactNode {
  switch (node.type) {
    case "heading": {
      const style = node.depth === 1 ? styles.h1 : node.depth === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={style} minPresenceAhead={40}>
          {renderInline(node.children)}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInline(node.children)}
        </Text>
      );
    case "list":
      return renderList(node, key);
    case "table":
      return renderTable(node, key);
    default:
      return null;
  }
}

function MarkdownPage({ markdown }: { markdown: string }) {
  const root = parser.parse(markdown) as Root;
  return (
    <Page size="LETTER" style={styles.page}>
      {root.children.map(renderBlock)}
      {/* No page numbers: react-pdf lays out `render` text again on every page, and that second
          pass compounds the footer's line height until long documents fail to render. */}
      <Text style={styles.footer} fixed>
        Draft. {DISCLAIMER} Based on Common Paper standard terms, CC BY 4.0.
      </Text>
    </Page>
  );
}

type Props = {
  title: string;
  coverPage: string;
  standardTerms: string;
};

/** The Cover Page and the Standard Terms each start on a new page; every page notes it is a draft. */
export function DocumentPdf({ title, coverPage, standardTerms }: Props) {
  return (
    <Document title={title} creator="Prelegal" producer="Prelegal">
      <MarkdownPage markdown={coverPage} />
      <MarkdownPage markdown={standardTerms} />
    </Document>
  );
}

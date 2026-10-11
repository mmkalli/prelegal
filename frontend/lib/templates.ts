import fs from "node:fs";
import path from "node:path";

// Templates live in the repo-level templates/ directory (see catalog.json).
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

/** Reads a template synchronously so pages using it are prerendered at build time. */
export function readTemplate(filename: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8").replace(/\r\n/g, "\n");
}

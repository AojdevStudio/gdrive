import fs from "node:fs";
import path from "node:path";
import YAML from "js-yaml";
import $RefParser from "@apidevtools/json-schema-ref-parser";

type AnyObj = Record<string, unknown>;

const SPEC_DIR = path.join(process.cwd(), "specs", "openapi", "googleapis.com");

const SPEC_FILES = [
  "drive_v3.openapi.yaml",
  "sheets_v4.openapi.yaml",
  "docs_v1.openapi.yaml",
  "gmail_v1.openapi.yaml",
  "calendar_v3.openapi.yaml",
  "forms_v1.openapi.yaml",
  "script_v1.openapi.yaml",
] as const;

let _cache:
  | {
      spec: AnyObj;
      mtimeMs: number;
    }
  | undefined;

function mtimeOf(files: string[]) {
  let max = 0;
  for (const f of files) {
    const st = fs.statSync(f);
    if (st.mtimeMs > max) {
      max = st.mtimeMs;
    }
  }
  return max;
}

function readYaml(filePath: string): AnyObj {
  const raw = fs.readFileSync(filePath, "utf8");
  const doc: unknown = YAML.load(raw);
  if (!doc || typeof doc !== "object") {
    throw new Error(`Invalid YAML spec: ${filePath}`);
  }
  return doc as AnyObj;
}

export async function loadWorkspaceSpec(): Promise<AnyObj> {
  const files = SPEC_FILES.map((f) => path.join(SPEC_DIR, f));
  const mtimeMs = mtimeOf(files);
  if (_cache && _cache.mtimeMs === mtimeMs) {
    return _cache.spec;
  }

  // Dereference each spec independently to avoid component name collisions.
  const derefSpecs: AnyObj[] = [];
  for (const p of files) {
    const parsed = readYaml(p);
    const deref = (await $RefParser.dereference(parsed, {
      dereference: { circular: "ignore" },
    })) as AnyObj;
    derefSpecs.push(deref);
  }

  // Merge into a single spec surface.
  const merged: AnyObj = {
    openapi: "3.0.0",
    info: {
      title: "Google Workspace APIs (Drive/Sheets/Docs/Gmail/Calendar/Forms/Script)",
      version: "codemode-1",
    },
    servers: [{ url: "https://www.googleapis.com" }],
    paths: {},
  };

  for (const s of derefSpecs) {
    if (s?.paths && typeof s.paths === "object") {
      Object.assign(merged.paths, s.paths);
    }
  }

  _cache = { spec: merged, mtimeMs };
  return merged;
}

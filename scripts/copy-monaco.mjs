// Serve the Monaco editor from our own origin instead of a third-party CDN.
import { cpSync, existsSync, rmSync } from "node:fs";

const src = "node_modules/monaco-editor/min/vs";
const dest = "public/monaco/vs";
if (!existsSync(src)) throw new Error("monaco-editor is not installed");
rmSync("public/monaco", { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`copied Monaco -> ${dest}`);

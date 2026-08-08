import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(process.cwd(), "..", "dist");
const target = resolve(process.cwd(), "public", "app");

try {
  await access(source);
} catch {
  throw new Error("No se encontró el build de structureCo. Compila structureCo antes de publicar este sitio.");
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

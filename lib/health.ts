import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

async function probeDirectory(dir: string): Promise<void> {
  await fs.readdir(dir);
  const token = randomBytes(12).toString("hex");
  const temp = path.join(dir, `.health-${token}.tmp`);
  const renamed = path.join(dir, `.health-${token}-renamed.tmp`);
  try {
    await fs.writeFile(temp, "health", { flag: "wx", mode: 0o600 });
    await fs.rename(temp, renamed);
  } finally {
    await Promise.all([fs.rm(temp, { force: true }), fs.rm(renamed, { force: true })]);
  }
}

/** Check the actual runtime mount without returning any content or paths. */
export async function checkDataHealth(dataDir: string): Promise<void> {
  for (const dir of [dataDir, path.join(dataDir, "posts"), path.join(dataDir, "uploads")]) {
    await probeDirectory(dir);
  }
  // These files are optional on a fresh installation; malformed existing data is unhealthy.
  for (const name of ["settings.json", "projects.json", "accounts.json"]) {
    let raw: string;
    try {
      raw = await fs.readFile(
        /* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dataDir, name),
        "utf8",
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    JSON.parse(raw);
  }
}

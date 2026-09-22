import fs from 'node:fs';
import path from 'node:path';

// Opt-in distribution boundary. With no override, retain workstation behavior.
// The launcher must supply the SAME directory to every child and UI observer.
export function runtimeDataDir(legacyDirectory, env = process.env) {
  const configured = env.DAVID_DATA_DIR;
  if (configured === undefined || configured === '') return legacyDirectory;
  if (!path.isAbsolute(configured)) throw new Error('DAVID_DATA_DIR must be absolute');
  fs.mkdirSync(configured, { recursive: true });
  return path.resolve(configured);
}

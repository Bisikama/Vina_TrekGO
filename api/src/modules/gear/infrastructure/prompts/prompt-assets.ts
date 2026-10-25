import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface PromptAsset {
  version: string;
  hash: string;
  content: string;
  isAvailable: boolean;
}

export function loadPromptFile(fileName: string, version: string): PromptAsset {
  const candidatePaths = [
    path.join(__dirname, fileName),
    path.join(__dirname, '..', 'infrastructure', 'prompts', fileName),
    path.join(process.cwd(), 'src', 'modules', 'gear', 'infrastructure', 'prompts', fileName),
    path.join(process.cwd(), 'dist', 'src', 'modules', 'gear', 'infrastructure', 'prompts', fileName),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8').trim();
        const hash = createHash('sha256').update(content).digest('hex');
        return { version, hash, content, isAvailable: true };
      } catch {
        // Fall through
      }
    }
  }

  // Graceful fallback: do not throw unhandled exception at module import time
  return {
    version,
    hash: 'missing',
    content: '',
    isAvailable: false,
  };
}

export const GEAR_EXTRACTION_PROMPT = loadPromptFile('gear-extraction.v1.md', '1.0.0');
export const GEAR_ADVISOR_PROMPT = loadPromptFile('gear-advisor.v1.md', '1.0.0');

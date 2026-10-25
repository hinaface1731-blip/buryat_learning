import fs from 'node:fs';
import path from 'node:path';

import { Course, Letters, MinimalPairs, Sentences, Words } from '../../src/content/schema';
import type { Course as CourseT, Letter, MinimalPair, Sentence, Word } from '../../src/content/schema';

export const ROOT = path.resolve(__dirname, '..', '..');
export const CONTENT = path.join(ROOT, 'content');
export const SOURCES = path.join(CONTENT, 'sources');

export const contentPath = (name: string) => path.join(CONTENT, name);

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(contentPath(file), 'utf8'));
}

export function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(contentPath(file), JSON.stringify(data, null, 2) + '\n');
}

export const readWords = (): Word[] => Words.parse(readJson('words.json'));
export const readSentences = (): Sentence[] => Sentences.parse(readJson('sentences.json'));
export const readPairs = (): MinimalPair[] => MinimalPairs.parse(readJson('minimal-pairs.json'));
export const readLetters = (): Letter[] => Letters.parse(readJson('alphabet.json'));
export const readCourse = (): CourseT => Course.parse(readJson('course.json'));

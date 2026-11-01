import type { Letter, MinimalPair, Note, Sentence, VowelRowId, Word } from '@/content/schema';

/** Единица, которую учат и повторяют (SRS держится за её id). */
export type StudyItem =
  | { kind: 'word'; id: string; buryat: string; russian: string; accepted: string[]; verified: boolean; word: Word }
  | { kind: 'letter'; id: string; buryat: string; russian: string; accepted: string[]; verified: boolean; letter: Letter };

export type Stage = 'intro' | 'training' | 'application' | 'control';

type Base = { key: string; stage: Stage };

export type Exercise = Base &
  (
    | { type: 'note'; note: Note }
    | { type: 'intro'; item: StudyItem }
    | {
        type: 'multiple_choice';
        item: StudyItem;
        direction: 'bur-ru' | 'ru-bur';
        prompt: string;
        options: string[];
        answer: string;
      }
    | { type: 'picture_choice'; item: StudyItem; image: string; options: string[]; answer: string }
    | { type: 'match_pairs'; items: StudyItem[]; left: string[]; right: string[] }
    | { type: 'type_answer'; item: StudyItem; prompt: string; answers: string[] }
    | {
        type: 'minimal_pair_choose';
        pair: MinimalPair;
        target: Word;
        other: Word;
        prompt: string;
        options: string[];
        answer: string;
      }
    | { type: 'listen_and_choose'; item: StudyItem; audioId: string; options: string[]; answer: string }
    | {
        type: 'categorize';
        items: { item: StudyItem; row: VowelRowId }[];
        rows: VowelRowId[];
      }
    | { type: 'build_sentence'; sentence: Pick<Sentence, 'id' | 'buryat' | 'verified'>; prompt: string; tokens: string[]; answer: string[] }
    | { type: 'dialogue'; title: string; scene: string; art?: string; lines: DialogueLine[] }
  );

export type DialogueLine = { role: 'partner' | 'learner'; item: StudyItem; /** Варианты реплики ученика. */ options: string[] };

export type ExerciseType = Exercise['type'];

/** Ответ на упражнение: общий результат + оценки по единицам для SRS. */
export type Outcome = {
  result: 'correct' | 'almost' | 'wrong';
  /** id единицы → результат (для match/categorize — по каждой). */
  perItem: Record<string, 'correct' | 'almost' | 'wrong'>;
};

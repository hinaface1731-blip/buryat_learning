import type { Content } from '@/content/load';
import type { Letter, Word } from '@/content/schema';

import { buildCourseForms } from './check';
import type { StudyItem } from './types';

export function itemFromWord(word: Word): StudyItem {
  return {
    kind: 'word',
    id: word.id,
    buryat: word.buryat,
    russian: word.russian,
    accepted: [word.russian, ...word.alternatives],
    verified: word.verified,
    word,
  };
}

export function itemFromLetter(letter: Letter): StudyItem {
  const glyph = [letter.upper, letter.lower].filter(Boolean).join(' ');
  return { kind: 'letter', id: letter.id, buryat: glyph, russian: letter.name, accepted: [letter.name], verified: letter.verified, letter };
}

export type Pools = {
  itemById: Map<string, StudyItem>;
  /** Все единицы юнита, в котором урок: источник дистракторов. */
  unitItemsByLesson: Map<string, StudyItem[]>;
  lessonItems: Map<string, StudyItem[]>;
  unitIdByLesson: Map<string, string>;
  /** Слова, которые есть в уроках курса, по всем юнитам. */
  courseItems: StudyItem[];
  courseForms: Set<string>;
};

export function buildPools(content: Content): Pools {
  const itemById = new Map<string, StudyItem>();
  const unitItemsByLesson = new Map<string, StudyItem[]>();
  const lessonItems = new Map<string, StudyItem[]>();
  const unitIdByLesson = new Map<string, string>();
  const courseItems: StudyItem[] = [];
  for (const unit of content.course.units) {
    const unitItems: StudyItem[] = [];
    for (const lesson of unit.lessons) {
      const items = [
        ...lesson.letterIds.map((id) => itemFromLetter(content.letterById.get(id)!)),
        ...lesson.wordIds.map((id) => itemFromWord(content.wordById.get(id)!)),
      ];
      items.forEach((it) => itemById.set(it.id, it));
      lessonItems.set(lesson.id, items);
      unitIdByLesson.set(lesson.id, unit.id);
      unitItems.push(...items);
    }
    unit.lessons.forEach((l) => unitItemsByLesson.set(l.id, unitItems));
    courseItems.push(...unitItems);
  }
  // Формы для правила «почти верно»: все слова курса, включая не вошедшие в уроки.
  const courseForms = buildCourseForms(content.words.map((w) => w.buryat));
  return { itemById, unitItemsByLesson, lessonItems, unitIdByLesson, courseItems, courseForms };
}

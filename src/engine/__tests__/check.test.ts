import { buildCourseForms, checkBuryat, checkRussian, isDegradedForm, normalizeAnswer } from '../check';
import { explainPair, explainTyped } from '../feedback';

// Слова из учебника: һүн — молоко, хүн — человек, хун (в «хун шубуун» — лебедь), гэр — дом, гар — рука.
const courseForms = buildCourseForms(['һүн', 'хүн', 'хун', 'гэр', 'гар', 'өөхэн', 'һургуули', 'хун шубуун']);
const opts = { courseForms };

describe('normalizeAnswer', () => {
  it('убирает регистр, лишние пробелы и знаки', () => {
    expect(normalizeAnswer('  Һүн!  ')).toBe('һүн');
    expect(normalizeAnswer('Хун   шубуун.')).toBe('хун шубуун');
    expect(normalizeAnswer('«модон һаба»')).toBe('модон һаба');
  });
  it('не меняет ё и особые буквы', () => {
    expect(normalizeAnswer('ХОЁР')).toBe('хоёр');
    expect(normalizeAnswer('ӨӨХЭН')).toBe('өөхэн');
  });
});

describe('checkBuryat', () => {
  it('точный ответ — верно, с любым регистром и пробелами', () => {
    expect(checkBuryat('һүн', 'һүн', opts)).toBe('correct');
    expect(checkBuryat(' ҺҮН ', 'һүн', opts)).toBe('correct');
    expect(checkBuryat('хун  шубуун', 'хун шубуун', opts)).toBe('correct');
  });

  it('хүн ≠ һүн: другая буква — неверно', () => {
    expect(checkBuryat('хүн', 'һүн', opts)).toBe('wrong');
    expect(checkBuryat('һүн', 'хүн', opts)).toBe('wrong');
  });

  it('замена особых букв даёт «почти верно», если вышло не другое слово курса', () => {
    expect(checkBuryat('оохэн', 'өөхэн', opts)).toBe('almost');
    expect(checkBuryat('хургуули', 'һургуули', opts)).toBe('almost');
    expect(checkBuryat('хүн', 'һүн', opts)).toBe('wrong'); // хүн — слово курса
  });

  it('«хун» вместо «хүн» — неверно: хун есть в курсе', () => {
    expect(checkBuryat('хун', 'хүн', opts)).toBe('wrong');
  });

  it('частичная замена тоже «почти верно»', () => {
    expect(checkBuryat('оөхэн', 'өөхэн', opts)).toBe('almost');
  });

  it('обратная замена (у→ү) и другие ошибки — неверно', () => {
    expect(checkBuryat('гүр', 'гэр', opts)).toBe('wrong');
    expect(checkBuryat('гар', 'гэр', opts)).toBe('wrong');
    expect(checkBuryat('', 'гэр', opts)).toBe('wrong');
  });

  it('в strict-режиме (минимальные пары) допуска нет', () => {
    expect(checkBuryat('оохэн', 'өөхэн', { ...opts, strict: true })).toBe('wrong');
    expect(checkBuryat('өөхэн', 'өөхэн', { ...opts, strict: true })).toBe('correct');
  });

  it('принимает любой из допустимых вариантов', () => {
    expect(checkBuryat('гар', ['гэр', 'гар'], opts)).toBe('correct');
  });
});

describe('isDegradedForm', () => {
  it('только в сторону потери особых букв', () => {
    expect(isDegradedForm('ухэр', 'үхэр')).toBe(true);
    expect(isDegradedForm('үхэр', 'ухэр')).toBe(false);
    expect(isDegradedForm('үхэр', 'үхэр')).toBe(false);
    expect(isDegradedForm('ухэрр', 'үхэр')).toBe(false);
  });
});

describe('причины ошибок', () => {
  it('особая буква, другое слово, долгота', () => {
    expect(explainTyped('хургуули', 'һургуули', courseForms)).toBe('Здесь нужна буква һ, а не х.');
    expect(explainTyped('хун', 'хүн', courseForms)).toContain('другое слово');
    expect(explainTyped('зан', 'заан', courseForms)).toContain('долготу');
    expect(explainTyped('гэр', 'заан', courseForms)).toBeUndefined();
  });
  it('минимальные пары по типу различия', () => {
    expect(explainPair('length')).toContain('долготой');
    expect(explainPair('soft')).toContain('мягкости');
  });
});

describe('checkRussian', () => {
  it('основной перевод или альтернатива, без учёта регистра', () => {
    expect(checkRussian('Радуга', ['хорек', 'радуга'])).toBe('correct');
    expect(checkRussian('лиса', ['хорек', 'радуга'])).toBe('wrong');
  });
});

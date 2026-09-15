import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleUrl(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const gradeUrl = moduleUrl('../src/gradeJournal.ts');
const { gradeSubject, groupJournalGrades, mapParentGrade, gradeAverage, gradesForPeriod, journalYears, currentSchoolYear, gradeDate } = await import(gradeUrl);
const mark = (id, subject, value, date = '2026-09-12') => mapParentGrade({ id, subject, grade: value, lesson_date: date, created_at: `${date}T10:00:00Z`, teacher_name: 'Fixture teacher' });

assert.equal(gradeSubject(' Актерское  мастерство ').key, gradeSubject('Актёрское мастерство').key);
assert.equal(gradeSubject('Дефиле и подиумный шаг').label, 'Дефиле');
for (const subject of ['Стиль', 'МК по стилю', 'Мастер-класс по стилю', 'Мастер‑класс по стилю', 'мк: Стиль']) assert.equal(gradeSubject(subject).label, 'МК по стилю');
assert.equal(gradeSubject('constructor').kind, 'masterclass');
assert.equal(gradeSubject('Визаж').label, 'МК по визажу');
assert.equal(gradeSubject('Мастер класс по визажу').key, gradeSubject('Визаж').key);
assert.notEqual(gradeSubject('Стиль').key, gradeSubject('Визаж').key);
assert.notEqual(gradeSubject('Хореография').key, gradeSubject('МК: Хореография').key);
assert.notEqual(gradeSubject('МК по стилю для подростков').key, gradeSubject('Стиль').key);
assert.equal(gradeSubject('Работа с камерой').label, 'МК: Работа с камерой');

const marks = [
  mark('a', 'Хореография', 5), mark('b', 'Хореография', 4),
  mark('c', 'Хореография', null), mark('d', 'Хореография', 0),
  mark('e', 'Хореография', 6), mark('f', 'Стиль', 5), mark('g', 'Визаж', 3),
  mark('h', 'Дефиле', 4, '2026-08-31'), mark('i', 'Актёрское мастерство', 5, '2027-08-31'),
  mark('j', 'Фотопозирование', 5, '2027-09-01'), mark('k', 'Хореография', 3, '2026-10-01'),
  mark('undated', 'Стиль', 4, ''),
];
assert.equal(gradeAverage(marks.slice(0, 5)), 4.5);
assert.equal(gradeAverage([mark('empty', 'Стиль', null)]), null);
const period = gradesForPeriod(marks, 2026);
assert.deepEqual(period.map(item => item.id), ['a', 'b', 'f', 'g', 'i', 'k']);
assert.deepEqual(gradesForPeriod(marks, 2026, '09').map(item => item.id), ['a', 'b', 'f', 'g']);
assert.equal(gradesForPeriod(marks, null).length, 9);
assert.deepEqual(journalYears(marks, 2026), [2027, 2026, 2025]);
assert.equal(currentSchoolYear(new Date('2026-08-31T15:59:59Z')), 2025);
assert.equal(currentSchoolYear(new Date('2026-08-31T16:00:00Z')), 2026);
assert.match(gradeDate('2026-09-12', true), /12 сентября 2026/);
assert.equal(gradeDate('2026-02-30'), 'Дата не указана');

const grouped = groupJournalGrades(period);
assert.deepEqual(grouped.slice(0, 4).map(row => row.label), ['Хореография', 'Фотопозирование', 'Дефиле', 'Актёрское мастерство']);
assert.equal(grouped.find(row => row.key === 'mk:style').average, 5);
assert.equal(grouped.find(row => row.key === 'mk:visage').average, 3);
assert.equal(grouped.find(row => row.key === 'photoposing').average, null);
assert.equal(grouped[0].grades.length, 3, 'Two real grades on the same date must be retained');
assert.equal(groupJournalGrades(Array.from({ length: 52 }, (_, i) => mark(String(i), 'Дефиле', 5))).find(row => row.key === 'runway').grades.length, 52);
assert.equal(groupJournalGrades([]).length, 4);
assert.equal(mapParentGrade({ id: 'null', subject: 'Стиль', grade: null, lesson_date: null, created_at: null, teacher_name: null }).grade, null);

// Exercise the real dashboard mapper with a history exceeding one REST page.
const source = readFileSync(new URL('../src/openStarsApi.ts', import.meta.url), 'utf8')
  .replace('"@/gradeJournal"', JSON.stringify(gradeUrl))
  .replace("'@/homeworkMaterials'", JSON.stringify(moduleUrl('../src/homeworkMaterials.ts')));
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const store = new Map();
const payload = Buffer.from(JSON.stringify({ sub: 'fixture-parent' })).toString('base64url');
store.set('openstars_parent_session', JSON.stringify({ access_token: `fixture.${payload}.fixture`, expires_at: Math.floor(Date.now() / 1000) + 600 }));
globalThis.window = { atob: value => Buffer.from(value, 'base64').toString(), localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) } };
const rawGrades = Array.from({ length: 1003 }, (_, i) => ({ id: `grade-${i}`, subject: i % 2 ? 'Хореография' : 'Стиль', grade: i === 1002 ? null : 5, lesson_date: '2026-09-12', created_at: '2026-09-12T10:00:00Z', teacher_name: 'Fixture teacher' }));
const offsets = [];
globalThis.fetch = async url => {
  const parsed = new URL(url);
  const table = parsed.pathname.split('/').pop();
  let data = [];
  if (table === 'users_profile') data = [{ id: 'fixture-profile', full_name: 'Fixture parent' }];
  if (table === 'family_members') data = [{ family_id: 'fixture-family' }];
  if (table === 'children') data = [{ id: 'fixture-child', first_name: 'Fixture', last_name: 'Child', family_id: 'fixture-family' }];
  if (table === 'grades') {
    assert.equal(parsed.searchParams.get('child_id'), 'eq.fixture-child');
    const offset = Number(parsed.searchParams.get('offset'));
    offsets.push(offset);
    data = rawGrades.slice(offset, offset + Number(parsed.searchParams.get('limit')));
  }
  return new Response(JSON.stringify(data), { status: 200 });
};
const { fetchParentDashboard } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const dashboard = await fetchParentDashboard();
assert.deepEqual(offsets, [0, 500, 1000]);
assert.equal(dashboard.grades.length, 1003);
assert.equal(dashboard.grades[0].lessonDate, '2026-09-12');
assert.equal(dashboard.grades[1002].grade, null);
assert.equal(dashboard.progress.averageGrade, 5);
assert.equal(dashboard.quickStats.progress, 100);
console.log('PASS: subject rows, separate MK topics, averages without empty grades, school-year/month boundaries, all 52 marks, and 1003-row dashboard pagination.');

const search = document.querySelector('#search');
const topic = document.querySelector('#topic');
const follow = document.querySelector('#follow');
const dates = document.querySelector('.dates');
const resultCount = document.querySelector('#result-count');
const noResults = document.querySelector('#no-results');
const sections = [...document.querySelectorAll('.day[data-date]')];
const followStates = new Set(['待追', '语音', '圈友', '组织者']);

function normalize(text) {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
}

function formatDate(date) {
  const [, month, day] = date.split('-').map(Number);
  return `${month} 月 ${day} 日`;
}

const availableDates = new Set(sections.map(section => section.dataset.date));
const entriesByDay = sections.map(section => ({
  section,
  date: section.dataset.date,
  empty: section.querySelector('.empty'),
  entries: [...section.querySelectorAll('.qa')].map(card => ({
    card,
    text: normalize(card.textContent),
  })),
}));

const searchTopics = new Set(
  entriesByDay.flatMap(day => day.entries.map(({ card }) => card.dataset.topic)),
);
for (const subject of [...searchTopics].sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
  topic.add(new Option(subject, subject));
}

const newest = sections.at(0)?.dataset.date;
const oldest = sections.at(-1)?.dataset.date;
if (oldest && newest) {
  document.querySelector('#coverage').textContent = oldest === newest
    ? `${oldest.slice(0, 4)} 年 ${formatDate(oldest)} · 北京时间`
    : `${oldest.slice(0, 4)} 年 ${formatDate(oldest)}至${oldest.slice(0, 4) === newest.slice(0, 4) ? '' : newest.slice(0, 4) + ' 年 '}${formatDate(newest)} · 北京时间`;
}

function dateFromLocation() {
  const value = new URL(location.href).searchParams.get('date');
  return availableDates.has(value) ? value : '';
}

let selectedDate = dateFromLocation();
const dateButtons = new Map();

function filter() {
  const terms = search.value.trim().split(/\s+/).map(normalize).filter(Boolean);
  const hasOtherFilters = Boolean(terms.length || topic.value || follow.checked);
  let count = 0;
  for (const { section, date, empty, entries } of entriesByDay) {
    const dateMatches = !selectedDate || selectedDate === date;
    let visible = 0;
    for (const { card, text } of entries) {
      const matches = dateMatches
        && terms.every(term => text.includes(term))
        && (!topic.value || card.dataset.topic === topic.value)
        && (!follow.checked || followStates.has(card.dataset.state));
      card.hidden = !matches;
      if (matches) visible++;
    }
    count += visible;
    empty.hidden = visible > 0;
    section.hidden = !dateMatches || (!selectedDate && hasOtherFilters && visible === 0);
  }
  for (const [date, button] of dateButtons) {
    button.setAttribute('aria-pressed', String(date === selectedDate));
  }
  noResults.hidden = count > 0 || Boolean(selectedDate);
  resultCount.textContent = `显示 ${count} 条问答与求评`;
}

for (const date of ['', ...availableDates]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'date-button';
  button.textContent = date ? formatDate(date) : '全部日期';
  button.addEventListener('click', () => {
    if (selectedDate === date) return;
    selectedDate = date;
    const url = new URL(location.href);
    url.hash = '';
    if (date) url.searchParams.set('date', date);
    else url.searchParams.delete('date');
    if (location.protocol !== 'file:') history.pushState(null, '', url);
    filter();
  });
  dates.append(button);
  dateButtons.set(date, button);
}

for (const control of [search, topic, follow]) control.addEventListener('input', filter);
window.addEventListener('popstate', () => {
  selectedDate = dateFromLocation();
  filter();
});

let copyFeedbackTimer;
function showCopyFeedback(message) {
  const feedback = document.querySelector('#copy-status');
  feedback.textContent = message;
  clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 4000);
}

if (location.protocol === 'file:') {
  for (const link of document.querySelectorAll('.related a')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      selectedDate = new URL(link.href).searchParams.get('date');
      search.value = '';
      topic.value = '';
      follow.checked = false;
      filter();
      const cardId = link.hash.slice(1);
      location.hash = cardId;
      document.getElementById(cardId)?.scrollIntoView();
    });
  }
}

for (const link of document.querySelectorAll('a[href^="#updates"]')) {
  link.addEventListener('click', () => {
    document.querySelector(link.hash).open = true;
  });
}

for (const button of document.querySelectorAll('.keyword')) {
  button.addEventListener('click', async () => {
    const value = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      showCopyFeedback('已复制 ' + value);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(button);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      showCopyFeedback('已选中回查词，可手动复制。');
    }
  });
}

filter();
document.querySelector('#filter-box').hidden = false;
if (/^#q[\w-]+$/.test(location.hash)) {
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

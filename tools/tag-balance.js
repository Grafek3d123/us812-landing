// Проверка баланса тегов в index.html и скобок в css/style.css
// (чек-лист RSYA-аудит, Часть 27 п.14). Запуск: node tools/tag-balance.js
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
let failed = false;
for (const t of ['div', 'section', 'span', 'a', 'p', 'form', 'button', 'h1', 'h2', 'h3', 'ul', 'li']) {
    const open = (html.match(new RegExp('<' + t + '(\\s|>)', 'g')) || []).length;
    const close = (html.match(new RegExp('</' + t + '>', 'g')) || []).length;
    const ok = open === close;
    if (!ok) failed = true;
    console.log(t.padEnd(8), ok ? 'OK' : 'MISMATCH open=' + open + ' close=' + close);
}

const css = fs.readFileSync('css/style.css', 'utf8');
const o = (css.match(/{/g) || []).length;
const c = (css.match(/}/g) || []).length;
console.log('css braces', o === c ? 'OK' : 'MISMATCH ' + o + '/' + c);
if (o !== c) failed = true;

const h1 = (html.match(/<h1/g) || []).length;
console.log('h1 count = ' + h1 + (h1 === 1 ? ' OK' : ' MISMATCH'));
if (h1 !== 1) failed = true;

process.exit(failed ? 1 : 0);

const fs = require('fs');
const cs = JSON.parse(fs.readFileSync('messages/cs.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('messages/ru.json', 'utf8'));

function flatten(obj, prefix = '') {
  let result = {};
  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      Object.assign(result, flatten(obj[k], prefix + k + '.'));
    } else {
      result[prefix + k] = obj[k];
    }
  }
  return result;
}

const flatCs = flatten(cs);
const flatEn = flatten(en);
const flatRu = flatten(ru);

const allKeys = new Set([...Object.keys(flatCs), ...Object.keys(flatEn), ...Object.keys(flatRu)]);

let errors = 0;
for (const key of allKeys) {
  if (!flatCs.hasOwnProperty(key)) { console.log(`Missing in CS: ${key}`); errors++; }
  if (!flatEn.hasOwnProperty(key)) { console.log(`Missing in EN: ${key}`); errors++; }
  if (!flatRu.hasOwnProperty(key)) { console.log(`Missing in RU: ${key}`); errors++; }
}

if (errors === 0) console.log('All keys match perfectly across all 3 locales!');

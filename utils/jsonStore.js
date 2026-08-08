const fs = require('fs');
const path = require('path');

function readJson(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw);
}

function writeJson(relativePath, data) {
  const fullPath = path.join(__dirname, '..', relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readJson, writeJson };

const fs = require('fs');
const path = require('path');

function removeComments(content) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (!inString && char === '/' && nextChar === '/') {
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    if (!inString && char === '/' && nextChar === '*') {
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === '*' && content[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    
    if ((char === '"' || char === "'" || char === '`') && (i === 0 || content[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }
    
    result += char;
    i++;
  }
  
  return result.split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0 || line === '')
    .join('\n');
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = removeComments(content);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Processed: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.ts')) {
      processFile(filePath);
    }
  });
}

walkDir('src');
console.log('Done!');

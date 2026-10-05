'use strict';

const SPACE = '[ \\t\\r\\n]';
const HEADER = new RegExp(`^${SPACE}+(/?)wp:([a-z][a-z0-9_-]*(?:/[a-z][a-z0-9_-]*)?)${SPACE}+([\\s\\S]*)$`);
const INTENT = /^[ \t\r\n]*\/?wp:/;
const trimSpaces = value => value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

/** Check serialized block delimiters, not HTML or WordPress save() validation.
 * Offsets use UTF-16 code units, like VS Code TextDocument.positionAt().
 */
function checkBlocks(text, maxIssues = 100) {
  const issues = [];
  const stack = [];
  const positions = new Map();
  let truncated = false;
  let blockCount = 0;
  const add = (code, message, start, end, related) => {
    if (issues.length >= maxIssues) { truncated = true; return; }
    issues.push({ code, message, start, end, ...(related ? { related } : {}) });
  };
  let offset = 0;
  const pop = () => {
    const block = stack.pop();
    const indexes = positions.get(block.name);
    indexes.pop();
    if (!indexes.length) positions.delete(block.name);
    return block;
  };
  while (offset < text.length) {
    const start = text.indexOf('<!--', offset);
    if (start < 0) break;
    const close = text.indexOf('-->', start + 4);
    const body = text.slice(start + 4, close < 0 ? text.length : close);
    const end = close < 0 ? Math.min(start + 80, text.length) : close + 3;
    offset = close < 0 ? text.length : end;
    if (!INTENT.test(body)) continue;
    if (close < 0) {
      add('unterminated-comment', 'This WordPress block comment is missing -->.', start, end);
      break;
    }
    const header = HEADER.exec(body);
    if (!header) {
      add('malformed-delimiter', 'Malformed block comment. Use a lowercase block name and spaces around the block delimiter.', start, end);
      continue;
    }
    const [, closing, rawName, tail] = header;
    const name = rawName.includes('/') ? rawName : `core/${rawName}`;
    const trimmed = trimSpaces(tail);
    const selfClosing = !closing && trimmed.endsWith('/');
    const attrs = selfClosing ? trimSpaces(trimmed.slice(0, -1)) : trimmed;
    if (closing && trimmed) {
      add('malformed-delimiter', 'Closing block comments cannot contain attributes or a self-closing slash.', start, end);
      continue;
    }
    if (!closing && trimmed && (selfClosing
      ? !tail.endsWith('/') || (attrs && !/[ \t\r\n]\/$/.test(tail))
      : !/[ \t\r\n]$/.test(tail))) {
      add('malformed-delimiter', 'Use whitespace before --> or /-->, with no space between the self-closing slash and -->.', start, end);
      continue;
    }
    if (!closing && attrs) {
      if (!attrs.startsWith('{') || !attrs.endsWith('}')) {
        add('malformed-delimiter', 'Block attributes must be a JSON object inside the opening comment.', start, end);
        continue;
      }
      try { JSON.parse(attrs); } catch {
        add('invalid-attributes', 'The block attributes are not valid JSON. Delimiter matching continues.', start, end);
      }
    }
    if (!closing) {
      blockCount++;
      if (!selfClosing) {
        if (!positions.has(name)) positions.set(name, []);
        positions.get(name).push(stack.length);
        stack.push({ name, rawName, start, end });
      }
      continue;
    }
    const indexes = positions.get(name);
    const match = indexes ? indexes[indexes.length - 1] : -1;
    if (match < 0) {
      const top = stack[stack.length - 1];
      add('unexpected-close', `Closing block "${rawName}" has no matching opening comment.${top ? ` The open block is "${top.rawName}".` : ''}`, start, end, top);
      continue;
    }
    while (stack.length - 1 > match) {
      const unclosed = pop();
      add('unclosed-block', `Block "${unclosed.rawName}" must close before "${rawName}".`, unclosed.start, unclosed.end, { start, end });
    }
    pop();
  }
  for (const unclosed of stack) {
    add('unclosed-block', `Block "${unclosed.rawName}" has no closing comment.`, unclosed.start, unclosed.end);
  }
  issues.sort((a, b) => a.start - b.start);
  return { issues, blockCount, truncated };
}

module.exports = { checkBlocks };

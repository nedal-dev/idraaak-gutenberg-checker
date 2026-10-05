'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkBlocks } = require('../src/checker');
const codes = text => checkBlocks(text).issues.map(issue => issue.code);

test('plain HTML, unrelated comments and escaped examples have no block warnings', () => {
  assert.deepEqual(checkBlocks('<p>مرحبا</p><!-- editorial note --><pre>&lt;!-- wp:paragraph --&gt;</pre>'), { issues: [], blockCount: 0, truncated: false });
});
test('nested article with Arabic, emoji, attributes and a void block is clean', () => {
  const text = '<!-- wp:group {"layout":{"type":"constrained"}} -->\r\n<div><!-- wp:paragraph -->\n<p>أهلاً 👋</p>\n<!-- /wp:paragraph --><!-- wp:latest-posts {"postsToShow":3} /--></div><!-- /wp:group -->';
  const result = checkBlocks(text);
  assert.equal(result.blockCount, 3);
  assert.deepEqual(result.issues, []);
});
test('explicit core namespace and plugin names normalize correctly', () => {
  assert.deepEqual(codes('<!-- wp:paragraph --><!-- /wp:core/paragraph --><!-- wp:vendor/my-block_2 --><!-- /wp:vendor/my-block_2 -->'), []);
});
test('JSON strings containing braces, slashes and escaped quotes are supported', () => {
  assert.deepEqual(codes('<!-- wp:html {"x":"} /", "quote":"a\\\"b", "data":[{"n":1}]} --><!-- /wp:html -->'), []);
});
test('unclosed block range uses the opening comment after Unicode text', () => {
  const text = 'نص 👋\r\n<!-- wp:paragraph -->\n<p>Body</p>';
  const [issue] = checkBlocks(text).issues;
  assert.equal(issue.code, 'unclosed-block');
  assert.equal(issue.start, text.indexOf('<!--'));
  assert.equal(text.slice(issue.start, issue.end), '<!-- wp:paragraph -->');
});
test('closing without an opener reports the closing comment', () => {
  const text = '<p>Body</p><!-- /wp:image -->';
  const [issue] = checkBlocks(text).issues;
  assert.equal(issue.code, 'unexpected-close');
  assert.equal(text.slice(issue.start, issue.end), '<!-- /wp:image -->');
});
test('ancestor close reports the skipped inner opener and recovers for later blocks', () => {
  const text = '<!-- wp:group --><!-- wp:paragraph --><!-- /wp:group --><!-- wp:quote --><!-- /wp:quote -->';
  const result = checkBlocks(text);
  assert.deepEqual(result.issues.map(i => i.code), ['unclosed-block']);
  assert.match(result.issues[0].message, /paragraph/);
  assert.equal(text.slice(result.issues[0].related.start, result.issues[0].related.end), '<!-- /wp:group -->');
});
test('unrelated mismatched close preserves open stack', () => {
  assert.deepEqual(codes('<!-- wp:paragraph --><!-- /wp:image --><!-- /wp:paragraph -->'), ['unexpected-close']);
});
test('repeated nested names close in last-opened order', () => {
  assert.deepEqual(codes('<!-- wp:group --><!-- wp:group --><!-- /wp:group --><!-- /wp:group -->'), []);
});
test('invalid JSON warns while retaining structural matching', () => {
  assert.deepEqual(codes('<!-- wp:paragraph {"x":} --><!-- /wp:paragraph -->'), ['invalid-attributes']);
});
test('malformed names, whitespace, closing attributes and void syntax warn', () => {
  for (const text of ['<!--wp:paragraph -->', '<!-- wp:Paragraph -->', '<!-- wp:foo/bar/baz -->', '<!-- wp:paragraph-->', '<!-- wp:image {"id":1}-->', '<!-- wp:image {"id":1}/-->', '<!-- wp:image / -->', '<!-- /wp:paragraph {"x":1} -->', '<!-- /wp:image /-->']) {
    assert.deepEqual(codes(text), ['malformed-delimiter'], text);
  }
});
test('multiline whitespace and CRLF delimiters are valid', () => {
  assert.deepEqual(codes('<!--\nwp:paragraph\r\n{"x":1}\t-->text<!--\t/wp:paragraph\r\n-->'), []);
});
test('unterminated block comment is distinct from ordinary unfinished HTML comment', () => {
  assert.deepEqual(codes('<!-- wp:paragraph'), ['unterminated-comment']);
  assert.deepEqual(codes('<!-- ordinary unfinished'), []);
});
test('literal block-looking examples are deliberately checked', () => {
  assert.deepEqual(codes('<script>const sample = "<!-- wp:paragraph -->";</script>'), ['unclosed-block']);
});
test('issue count is bounded and indicates truncation', () => {
  const result = checkBlocks('<!-- /wp:paragraph -->'.repeat(120));
  assert.equal(result.issues.length, 100);
  assert.equal(result.truncated, true);
});
test('deep nesting and unmatched closes do not use recursive calls', () => {
  const count = 10000;
  const text = '<!-- wp:group -->'.repeat(count) + '<!-- /wp:image -->'.repeat(count) + '<!-- /wp:group -->'.repeat(count);
  const result = checkBlocks(text);
  assert.equal(result.blockCount, count);
  assert.equal(result.issues.length, 100);
  assert.equal(result.truncated, true);
  assert.ok(result.issues.every(i => i.code === 'unexpected-close'));
});

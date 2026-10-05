'use strict';
const assert = require('node:assert/strict');
const vscode = require('vscode');
const own = document => vscode.languages.getDiagnostics(document.uri).filter(d => d.source === 'Idraaak Gutenberg');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(condition) {
  const deadline = Date.now() + 5000;
  while (!condition()) { if (Date.now() > deadline) throw new Error('Timed out waiting for diagnostics'); await pause(30); }
}
async function run() {
  let passed = 0;
  const verify = (label, fn) => { fn(); passed++; console.log(`PASS ${label}`); };
  if (process.env.IDRAAAK_EXPECT_UNTRUSTED === '1') verify('Restricted Mode remains active', () => assert.equal(vscode.workspace.isTrusted, false));
  const config = vscode.workspace.getConfiguration('idraaakGutenberg');
  await config.update('autoCheck', true, vscode.ConfigurationTarget.Global);
  const extension = vscode.extensions.getExtension('nedal-dev.idraaak-gutenberg-checker');
  assert.ok(extension, 'extension manifest loads');
  await extension.activate();
  const text = 'نص 👋\r\n<!-- wp:group -->\r\n<!-- wp:paragraph -->\r\n<p>مرحبا</p>\r\n<!-- /wp:group -->';
  const document = await vscode.workspace.openTextDocument({ language: 'html', content: text });
  await vscode.window.showTextDocument(document);
  await waitFor(() => own(document).length === 1);
  verify('HTML auto check marks the actual inner opener', () => {
    const [issue] = own(document);
    assert.equal(issue.code, 'unclosed-block');
    assert.equal(issue.range.start.line, 2);
    assert.equal(document.getText(issue.range), '<!-- wp:paragraph -->');
    assert.equal(issue.relatedInformation[0].location.range.start.line, 4);
    assert.equal(issue.severity, vscode.DiagnosticSeverity.Warning);
  });
  await vscode.window.activeTextEditor.edit(edit => edit.insert(new vscode.Position(4, 0), '<!-- /wp:paragraph -->\r\n'));
  await waitFor(() => own(document).length === 0);
  verify('repair updates diagnostics and content is preserved', () => assert.match(document.getText(), /<p>مرحبا<\/p>/));
  const plain = await vscode.workspace.openTextDocument({ language: 'plaintext', content: '👋\n<!-- /wp:image -->' });
  await vscode.window.showTextDocument(plain);
  verify('plaintext stays quiet before manual checking', () => assert.equal(own(plain).length, 0));
  const count = await vscode.commands.executeCommand('idraaakGutenberg.check');
  verify('manual command returns issue count and UTF-16 position', () => {
    assert.equal(count, 1);
    assert.equal(own(plain)[0].range.start.line, 1);
    assert.equal(own(plain)[0].range.start.character, 0);
  });
  await vscode.commands.executeCommand('idraaakGutenberg.clear');
  verify('clear command removes active document diagnostics', () => assert.equal(own(plain).length, 0));
  await config.update('autoCheck', false, vscode.ConfigurationTarget.Global);
  const disabled = await vscode.workspace.openTextDocument({ language: 'html', content: '<!-- wp:paragraph -->' });
  await vscode.window.showTextDocument(disabled);
  await pause(300);
  verify('disabled auto check leaves new HTML documents quiet', () => assert.equal(own(disabled).length, 0));
  await vscode.commands.executeCommand('idraaakGutenberg.check');
  verify('manual command still works with automatic checks disabled', () => assert.equal(own(disabled).length, 1));
  await config.update('autoCheck', true, vscode.ConfigurationTarget.Global);
  await waitFor(() => own(disabled).length === 1);
  const ordinary = await vscode.workspace.openTextDocument({ language: 'html', content: '<p>Ordinary content</p>' });
  await vscode.window.showTextDocument(ordinary);
  verify('ordinary HTML has no checker diagnostics', () => assert.equal(own(ordinary).length, 0));
  const huge = await vscode.workspace.openTextDocument({ language: 'html', content: '<!-- wp:paragraph -->' + 'x'.repeat(2 * 1024 * 1024) });
  await vscode.window.showTextDocument(huge);
  verify('oversize documents are skipped', () => assert.equal(own(huge).length, 0));
  console.log(`INTEGRATION ${passed} checks passed; VS Code ${vscode.version}; workspace trusted: ${vscode.workspace.isTrusted}`);
}
module.exports = { run };

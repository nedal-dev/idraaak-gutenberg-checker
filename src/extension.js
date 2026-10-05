'use strict';

const vscode = require('vscode');
const { checkBlocks } = require('./checker');
const MAX_LENGTH = 2 * 1024 * 1024;

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection('Idraaak Gutenberg');
  const timers = new Map();
  const manual = new Set();
  const enabled = document => vscode.workspace.getConfiguration('idraaakGutenberg', document.uri).get('autoCheck', true);
  const eligible = document => document.languageId === 'html' || manual.has(document.uri.toString());
  function scan(document) {
    const text = document.getText();
    if (text.length > MAX_LENGTH) { diagnostics.delete(document.uri); return null; }
    const result = checkBlocks(text);
    const items = result.issues.map(issue => {
      const range = new vscode.Range(document.positionAt(issue.start), document.positionAt(issue.end));
      const item = new vscode.Diagnostic(range, issue.message, vscode.DiagnosticSeverity.Warning);
      item.source = 'Idraaak Gutenberg';
      item.code = issue.code;
      if (issue.related) {
        item.relatedInformation = [new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, new vscode.Range(document.positionAt(issue.related.start), document.positionAt(issue.related.end))),
          'Related block comment'
        )];
      }
      return item;
    });
    diagnostics.set(document.uri, items);
    return result;
  }
  function cancel(document) {
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.delete(key);
  }
  function auto(document) {
    if (enabled(document) && eligible(document)) scan(document);
  }
  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand('idraaakGutenberg.check', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document) { vscode.window.showInformationMessage('Open an article source file first.'); return null; }
      manual.add(document.uri.toString());
      cancel(document);
      const result = scan(document);
      if (!result) { vscode.window.showWarningMessage('Idraaak Gutenberg Checker skips documents larger than 2 Mi UTF-16 code units.'); return null; }
      if (result.issues.length) {
        vscode.commands.executeCommand('workbench.actions.view.problems');
        if (result.truncated) vscode.window.showWarningMessage('Showing the first 100 block issues. Correct them and check again.');
      } else {
        vscode.window.showInformationMessage(result.blockCount
          ? `Checked ${result.blockCount} blocks: no delimiter or attribute JSON issues found.`
          : 'No WordPress block comments found. Full HTML validation is outside this checker.');
      }
      return result.issues.length;
    }),
    vscode.commands.registerCommand('idraaakGutenberg.clear', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document) { cancel(document); diagnostics.delete(document.uri); manual.delete(document.uri.toString()); }
    }),
    vscode.workspace.onDidOpenTextDocument(auto),
    vscode.workspace.onDidChangeTextDocument(event => {
      const document = event.document;
      cancel(document);
      if (!enabled(document) || !eligible(document)) return;
      const key = document.uri.toString();
      timers.set(key, setTimeout(() => { timers.delete(key); if (!document.isClosed) auto(document); }, 200));
    }),
    vscode.workspace.onDidCloseTextDocument(document => { cancel(document); manual.delete(document.uri.toString()); diagnostics.delete(document.uri); }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('idraaakGutenberg.autoCheck')) return;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      diagnostics.clear();
      vscode.workspace.textDocuments.forEach(auto);
    }),
    { dispose() { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); manual.clear(); } }
  );
  vscode.workspace.textDocuments.forEach(auto);
}

module.exports = { activate };

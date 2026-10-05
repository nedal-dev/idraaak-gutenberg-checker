# Idraaak Gutenberg Checker

Find structural mistakes in WordPress block comments before pasting article
source into the Gutenberg code editor. This extension runs in VS Code-compatible
desktop editors and works with Arabic and other Unicode text.

Developed for the article workflow at [Idraaak](https://idraaak.com/).

## Use it

1. Open an article source file as **HTML**, or paste the source into a new HTML document.
2. Warnings appear in the editor and the **Problems** panel as you type.
3. For another text format, run **Idraaak: Check WordPress Block Comments** from
   the Command Palette. The command checks the active document only.
4. Correct the indicated opening or closing comment, then check again.

An HTML document without WordPress block comments receives no warnings from this
extension. Checking is debounced by 200 ms. After running the command, other text
documents also recheck on edits while they stay open.

To use only the command, turn off **Idraaak Gutenberg: Auto Check** in Settings
(`idraaakGutenberg.autoCheck`). **Idraaak: Clear Block Diagnostics** removes the
active document's current warnings; automatic HTML checking resumes on its next edit.

## Example: a missing inner closing comment

```html
<!-- wp:group -->
<div class="wp-block-group">
  <!-- wp:paragraph -->
  <p>نص تجريبي للمقال.</p>
</div>
<!-- /wp:group -->
```

The checker marks the opening `wp:paragraph`: it must close before `wp:group`.
Insert `<!-- /wp:paragraph -->` after the paragraph. The checker reports the
location but never changes your file automatically.

## Supported checks

- Missing closing comments and closing names with no matching opening comment.
- Nested blocks closing out of order, with a related location when available.
- Self-closing comments, for example `<!-- wp:latest-posts /-->`.
- Core names (`wp:paragraph` and `wp:core/paragraph`) and plugin namespaces.
- Lowercase block names and required whitespace around delimiters.
- Invalid JSON in opening attributes. Structural matching continues after this warning.

## Scope and limits

This is a **delimiter and attribute JSON checker**, not WordPress's full block
validator. A clean result does not prove that a block's saved HTML matches its
`save()` function, that a block is registered, or that an article will render
correctly. Check the article in WordPress before publishing it.

The scanner reads literal HTML comments. An unescaped block-looking comment in
a script, example or string is checked too. To display code examples inside an
article, escape the markup. It does not parse PHP, JavaScript or HTML element trees.
Completely misspelled markers such as `wpp:` are outside its scope.

At most 100 warnings are displayed per document. Fix those and run the command
again to reveal further issues. Documents larger than 2 Mi UTF-16 code units are
skipped to keep the editor responsive. No folder scanning is performed.

## Privacy

Article text stays in the editor's extension host. The extension makes no network
requests, stores no content, sends no telemetry and has no runtime dependencies.
It supports virtual documents and Restricted Mode because it only reads open text
and creates diagnostics; it does not execute project code.

## Development

```sh
npm test
npm run check
```

`test/integration.js` exports a VS Code Extension Host test runner. Run it with
`@vscode/test-electron`, passing this repository as `extensionDevelopmentPath`
and that file as `extensionTestsPath`. Tests include diagnostic ranges, edits,
manual checking, settings and clearing warnings.

The delimiter syntax was checked against the official
[WordPress block serialization grammar](https://github.com/WordPress/gutenberg/blob/trunk/packages/block-serialization-spec-parser/grammar.pegjs).
This is an independent tool, not an official WordPress, Microsoft or Eclipse product.
Code and documentation were created with AI assistance and reviewed through
automated parser tests and editor integration checks.

MIT licensed. Source and issue tracking are on
[GitHub](https://github.com/nedal-dev/idraaak-gutenberg-checker).

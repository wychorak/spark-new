// Collects user-facing Polish strings from the app source into scripts/i18n/source.json.
// Usage: node scripts/i18n-extract.cjs
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const files = [path.join(root, "App.tsx")];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) files.push(full);
  }
})(path.join(root, "src"));

const skipAttributes = new Set([
  "name", "style", "accessibilityRole", "keyboardType", "autoCapitalize", "autoComplete", "textContentType",
  "resizeMode", "contentFit", "testID", "nativeID", "mode", "icon", "iconName", "returnKeyType", "pointerEvents",
  "animationType", "presentationStyle", "key", "type", "kind", "tone", "variant", "size", "id", "href", "source",
  "importantForAccessibility", "accessibilityLabel", "accessibilityHint"
]);
const skipCallees = new Set(["require", "recordSparkError", "logSparkEvent", "trackEvent", "collection", "doc", "query", "where", "orderBy", "httpsCallable", "getItem", "setItem", "removeItem", "AsyncStorage.getItem", "AsyncStorage.setItem", "AsyncStorage.removeItem", "console.log", "console.warn", "console.error", "addEventListener", "toLocaleString", "toLocaleDateString", "toLocaleTimeString", "toLocaleLowerCase", "toLocaleUpperCase", "localeCompare", "Intl.DateTimeFormat", "Intl.NumberFormat", "split", "join", "replace", "includes", "startsWith", "endsWith", "indexOf", "test", "match", "RegExp", "openLegalDocument"]);

const polish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
function looksDisplayable(text) {
  const t = text.trim();
  if (!t || t.length < 2 || !/[A-Za-zÀ-ž]/.test(t)) return false;
  if (/^-?d+(px)? /.test(t) || /d+px/.test(t)) return false; // shadows and other style values
  if (/^(https?:|mailto:|tel:|\.\/|\/|#[0-9a-f]{3,8}$|rgba?\(|@)/i.test(t)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
  if (/^AIza|^[A-Za-z0-9_-]{24,}$/.test(t)) return false; // keys and tokens
  if (/^[a-z0-9_.:-]+$/.test(t) && !polish.test(t)) return false; // identifiers, keys, icon names
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 1 && !/[AEIOUY]/.test(t)) return false;
  if (/^[a-z]+[A-Z]\w*$/.test(t)) return false; // camelCase identifier
  return polish.test(t) || /\s/.test(t) || /^[A-ZĄĆĘŁŃÓŚŹŻ]/.test(t);
}

// React's JSX text whitespace rules (same as Babel).
function jsxTextValue(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let out = "";
  lines.forEach((line, index) => {
    let piece = line.replace(/\t/g, " ");
    if (index !== 0) piece = piece.replace(/^[ ]+/, "");
    if (index !== lines.length - 1) piece = piece.replace(/[ ]+$/, "");
    if (piece) out += (out && index !== 0 ? " " : "") + piece;
  });
  return out;
}

const found = new Map(); // text -> { files:Set, kind }
function add(text, kind, file) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!looksDisplayable(value.replace(/\{\d+\}/g, ""))) return;
  if (kind === "pattern" && !/[A-Za-zÀ-ž]{2,}/.test(value.replace(/\{\d+\}/g, ""))) return;
  const item = found.get(value) ?? { kind, files: new Set() };
  item.files.add(path.relative(root, file).replace(/\\/g, "/"));
  found.set(value, item);
}

function calleeName(node) {
  const expr = node.expression;
  return expr ? expr.getText().replace(/\s/g, "") : "";
}

function skipLiteral(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && ["color", "backgroundColor", "fontWeight", "textTransform", "fontFamily", "borderColor", "shadowColor", "tintColor", "position", "alignItems", "justifyContent", "flexDirection", "overflow", "status", "route", "category", "kind", "icon", "id", "provider", "visibility", "mode", "lens", "contentType", "type", "key", "value", "code", "name", "event", "screen"].includes(parent.name.getText())) {
    // `value`/`name`/`id` hold data; display labels live in `label`, `title`, `text`...
    return true;
  }
  if (ts.isElementAccessExpression(parent)) return true;
  if (ts.isCaseClause(parent)) return true;
  if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(parent.operatorToken.kind)) return true;
  if (ts.isJsxAttribute(parent) && skipAttributes.has(parent.name.getText())) return true;
  if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent) && skipAttributes.has(parent.parent.name.getText())) return true;
  if (ts.isCallExpression(parent) && skipCallees.has(calleeName(parent))) return true;
  if (ts.isCallExpression(parent) && /\.(includes|indexOf|startsWith|endsWith|split|replace|filter|setItem|getItem)$/.test(calleeName(parent))) return true;
  return false;
}

// "Anuluj prośbę do " + name + "?" is shown as one string: record it as a pattern.
function concatParts(node, parts) {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    concatParts(node.left, parts);
    concatParts(node.right, parts);
  } else if (ts.isParenthesizedExpression(node)) {
    concatParts(node.expression, parts);
  } else {
    parts.push(node);
  }
  return parts;
}
function isConcatRoot(node) {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return !(parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken);
}

function templatePattern(node) {
  let text = node.head.text;
  node.templateSpans.forEach((span, index) => {
    text += `{${index}}` + span.literal.text;
  });
  return text;
}

for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const children = node.children.filter((child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces));
      const hasElement = children.some((child) => !ts.isJsxText(child) && !ts.isJsxExpression(child));
      const hasExpression = children.some((child) => ts.isJsxExpression(child) && child.expression);
      const hasText = children.some((child) => ts.isJsxText(child));
      if (!hasElement && hasExpression && hasText) {
        let index = 0;
        let pattern = "";
        node.children.forEach((child) => {
          if (ts.isJsxText(child)) pattern += jsxTextValue(child.text);
          else if (ts.isJsxExpression(child) && child.expression) pattern += `{${index++}}`;
        });
        add(pattern, "pattern", file);
      }
    }
    if (isConcatRoot(node)) {
      const parts = concatParts(node, []);
      if (parts.some((part) => ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part)) && !skipLiteral(node)) {
        let index = 0;
        add(parts.map((part) => ts.isStringLiteral(part) || ts.isNoSubstitutionTemplateLiteral(part) ? part.text : `{${index++}}`).join(""), index ? "pattern" : "text", file);
      }
    }
    if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces) {
      add(jsxTextValue(node.text), "text", file);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !skipLiteral(node)) {
      add(node.text, "text", file);
    } else if (ts.isTemplateExpression(node) && !skipLiteral(node)) {
      add(templatePattern(node), "pattern", file);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const entries = [...found.entries()]
  .map(([text, info]) => ({ text, kind: info.kind, files: [...info.files] }))
  .sort((a, b) => a.files[0].localeCompare(b.files[0]) || a.text.localeCompare(b.text, "pl"));
fs.mkdirSync(path.join(root, "scripts", "i18n"), { recursive: true });
fs.writeFileSync(path.join(root, "scripts", "i18n", "source.json"), JSON.stringify(entries.map((entry) => entry.text), null, 1) + "\n");
console.log(`Extracted ${entries.length} strings (${entries.filter((entry) => entry.kind === "pattern").length} patterns) from ${files.length} files.`);
const byFile = {};
entries.forEach((entry) => entry.files.forEach((file) => { byFile[file] = (byFile[file] ?? 0) + 1; }));
console.log(byFile);

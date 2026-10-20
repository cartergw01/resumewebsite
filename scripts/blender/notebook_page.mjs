// Read the same opening essay as the website without evaluating image imports.
// Blender uses this metadata to put ink directly on its curved paper.
import { readFileSync } from "node:fs";
import ts from "typescript";

const path = new URL("../../content/portfolio.ts", import.meta.url);
const source = ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
const essays = source.statements
  .filter(ts.isVariableStatement)
  .flatMap(statement => [...statement.declarationList.declarations])
  .find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "essays");
const first = essays?.initializer && ts.isArrayLiteralExpression(essays.initializer)
  ? essays.initializer.elements[0] : undefined;
if (!first || !ts.isObjectLiteralExpression(first)) throw new Error("The notebook needs an opening essay.");
const fields = {};
for (const property of first.properties) {
  if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && ts.isStringLiteral(property.initializer))
    fields[property.name.text] = property.initializer.text;
}
for (const field of ["title", "subtitle", "date"]) {
  if (!fields[field]) throw new Error(`The notebook's opening essay is missing ${field}.`);
}
process.stdout.write(JSON.stringify({ title: fields.title, subtitle: fields.subtitle, date: fields.date }));

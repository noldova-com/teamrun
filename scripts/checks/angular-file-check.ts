/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type { CallExpression, ClassDeclaration, SourceFile } from "typescript/unstable/ast";
import { isCallExpression, isClassDeclaration, isDecorator, isIdentifier, isObjectLiteralExpression, isPropertyAssignment, isStringLiteral } from "typescript/unstable/ast/is";

import ApiException from "../api/api.exception.ts";
import type RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import type SyntaxTreeReader from "../structure/syntax-tree.reader.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class AngularFileCheck implements ICheck {
  private static readonly APP_FILE: RegExp = /^src\/(?:[^/]+\/)+src\/app\/.+\.ts$/;
  private static readonly WORD_START: RegExp = /(?<=.)(?=[A-Z])/g;
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly COMPONENT_DECORATOR: string = "Component";
  private static readonly INJECTABLE_DECORATOR: string = "Injectable";
  private static readonly COMPONENT_SUFFIX: string = ".component.ts";
  private static readonly SERVICE_SUFFIX: string = ".service.ts";
  private static readonly TEMPLATE_SUFFIX: string = ".component.html";
  private static readonly SERVICE_ROLE: string = "Service";
  private static readonly COMPONENTS_FOLDER: string = "components";
  private static readonly APP_FOLDER: string = "app";
  private static readonly TEMPLATE_URL: string = "templateUrl";
  private static readonly WORD_SEPARATOR: string = "-";
  private static readonly SEGMENT_SEPARATOR: string = "/";
  private static readonly ANONYMOUS: string = "(anonymous)";
  private static readonly PURPOSE: string = "angular-files";
  private static readonly RULE: string = "CODING-STANDARDS.md section 5 puts each component in src/app/components/<folder>/<name>.component.ts with its template beside it, and each @Injectable service in <name>.service.ts.";

  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Angular files";

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const listed = await this.files.listAsync();
    const tracked = new Set(listed);
    const files = listed.filter(t => AngularFileCheck.isAppFile(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(AngularFileCheck.PURPOSE, files, (t, u) => AngularFileCheck.inspect(t, u, tracked));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the component and service names of ${files.length} Angular files.\n`);
    return findings.length === 0;
  }

  private static isAppFile(file: string): boolean {
    return AngularFileCheck.APP_FILE.test(file)
      && !file.endsWith(AngularFileCheck.DECLARATIONS)
      && !file.split(AngularFileCheck.SEGMENT_SEPARATOR).some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspect(file: string, source: SourceFile, tracked: ReadonlySet<string>): readonly string[] {
    const fileName = path.posix.basename(file);
    const findings: string[] = [];
    let components = 0;
    let services = 0;
    for (const declaration of source.statements.filter(t => isClassDeclaration(t))) {
      const className = declaration.name?.text ?? AngularFileCheck.ANONYMOUS;
      const location = `${file}:${source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1}`;
      const component = AngularFileCheck.findDecorator(declaration, AngularFileCheck.COMPONENT_DECORATOR);
      if (component !== null) {
        components++;
        findings.push(...AngularFileCheck.inspectComponent(file, location, className, component, tracked));
      }
      if (AngularFileCheck.findDecorator(declaration, AngularFileCheck.INJECTABLE_DECORATOR) !== null && className.endsWith(AngularFileCheck.SERVICE_ROLE)) {
        services++;
        const expected = `${className.slice(0, -AngularFileCheck.SERVICE_ROLE.length).replace(AngularFileCheck.WORD_START, AngularFileCheck.WORD_SEPARATOR).toLowerCase()}${AngularFileCheck.SERVICE_SUFFIX}`;
        if (fileName !== expected)
          findings.push(`${location}: the service ${className} is not in its file ${expected}; ${AngularFileCheck.RULE}`);
      }
    }
    if (fileName.endsWith(AngularFileCheck.COMPONENT_SUFFIX) && components === 0)
      findings.push(`${file}: holds no @Component class; ${AngularFileCheck.RULE}`);
    if (fileName.endsWith(AngularFileCheck.SERVICE_SUFFIX) && services === 0)
      findings.push(`${file}: holds no @Injectable class whose name ends in Service; ${AngularFileCheck.RULE}`);
    return findings;
  }

  private static inspectComponent(file: string, location: string, className: string, component: CallExpression, tracked: ReadonlySet<string>): readonly string[] {
    const fileName = path.posix.basename(file);
    if (!fileName.endsWith(AngularFileCheck.COMPONENT_SUFFIX))
      return [`${location}: the component ${className} is not in a <name>${AngularFileCheck.COMPONENT_SUFFIX} file; ${AngularFileCheck.RULE}`];

    const name = fileName.slice(0, -AngularFileCheck.COMPONENT_SUFFIX.length);
    const findings: string[] = [];
    const expected = `${AngularFileCheck.formatPascalCase(name)}${AngularFileCheck.COMPONENT_DECORATOR}`;
    if (className !== expected)
      findings.push(`${location}: the component ${className} is not named ${expected} for its file; ${AngularFileCheck.RULE}`);
    const folder = path.posix.basename(path.posix.dirname(file));
    const segments = file.split(AngularFileCheck.SEGMENT_SEPARATOR);
    if (segments.at(-3) !== AngularFileCheck.COMPONENTS_FOLDER || segments.at(-4) !== AngularFileCheck.APP_FOLDER
      || name !== folder && !name.startsWith(`${folder}${AngularFileCheck.WORD_SEPARATOR}`))
      findings.push(`${location}: the component ${className} is not in src/app/components/<folder>/ with a file name that starts with the folder name; ${AngularFileCheck.RULE}`);
    const template = `./${name}${AngularFileCheck.TEMPLATE_SUFFIX}`;
    if (AngularFileCheck.readTemplateUrl(component) !== template)
      findings.push(`${location}: the component ${className} does not name ${template} as its templateUrl; ${AngularFileCheck.RULE}`);
    else if (!tracked.has(path.posix.join(path.posix.dirname(file), template)))
      findings.push(`${location}: the component ${className} names ${template}, which is not in the repository; ${AngularFileCheck.RULE}`);
    return findings;
  }

  private static findDecorator(declaration: ClassDeclaration, name: string): CallExpression | null {
    for (const modifier of declaration.modifiers ?? [])
      if (isDecorator(modifier) && isCallExpression(modifier.expression) && isIdentifier(modifier.expression.expression) && modifier.expression.expression.text === name)
        return modifier.expression;
    return null;
  }

  private static readTemplateUrl(component: CallExpression): string | null {
    const options = component.arguments.at(0);
    if (options === undefined || !isObjectLiteralExpression(options))
      return null;
    for (const property of options.properties)
      if (isPropertyAssignment(property) && isIdentifier(property.name) && property.name.text === AngularFileCheck.TEMPLATE_URL && isStringLiteral(property.initializer))
        return property.initializer.text;
    return null;
  }

  private static formatPascalCase(name: string): string {
    return name.split(AngularFileCheck.WORD_SEPARATOR).map(t => `${t.charAt(0).toUpperCase()}${t.slice(1)}`).join("");
  }
}

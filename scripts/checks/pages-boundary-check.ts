/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { posix } from "node:path";
import type { Writable } from "node:stream";

import ts from "typescript";

import { SourceTree } from "../structure/source-tree.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { ModuleReference } from "./module-reference.ts";

export class PagesBoundaryCheck implements ICheck {
  private static readonly SOURCE_FILE: RegExp = /^src\/.+\.[cm]?ts$/;
  private static readonly PAGES_PATH: RegExp = /^src\/[^/]+\/src\/((?:(?:app|testing)\/)?[a-z-]+\/pages\/.+?)(?:\.[cm]?[jt]s)?$/;
  private static readonly DECLARATIONS: string = ".d.ts";
  private static readonly RELATIVE: string = ".";
  private static readonly BASES: ReadonlyMap<string, string> = new Map([
    ["src/noldova.teamrun.runtime/src/exceptions/runtime.exception", "RuntimeException"],
    ["src/noldova.teamrun.window/src/app/exceptions/window.exception", "WindowException"]
  ]);
  private static readonly SCRIPT_EXTENSION: RegExp = /\.[cm]?[jt]s$/;
  private static readonly NODE: string = "node:";
  private static readonly CONTEXT: string = "@noldova/context.";
  private static readonly RUNTIME: string = "@noldova/desktop.runtime";
  private static readonly DESKTOP_PROTOCOL: string = "@noldova/desktop.protocol";
  private static readonly PROTOCOL: string = "@noldova/teamrun.protocol";
  private static readonly WINDOW_FILE: string = "src/noldova.teamrun.window/";
  private static readonly WINDOW_PACKAGES: readonly string[] = ["@angular/", "@noldova/ui.components.angular", "@noldova/desktop.window"];
  private static readonly PROTOCOL_NAMES: ReadonlySet<string> = new Set(["Page", "PageAuthor", "PageVersion", "PageView", "PageRequest", "PageListRequest",
    "PageMethodName", "PageEventName", "PageKind", "CanvasManifest", "CanvasPage", "CanvasArtboard", "CanvasNote", "CanvasMark", "CanvasGuide", "CanvasNoteKind",
    "CanvasMarkKind", "CanvasAxis"]);
  private static readonly PROTOCOL_LIST: string = [...PagesBoundaryCheck.PROTOCOL_NAMES].join(", ");
  private static readonly ENTRIES: ReadonlyMap<string, string> = new Map([
    ["services/pages/pages", "Pages"],
    ["interfaces/pages/i-pages-host", "IPagesHost"],
    ["interfaces/pages/i-pages-clock", "IPagesClock"],
    ["models/pages/page", "Page"],
    ["models/pages/page-author", "PageAuthor"],
    ["models/pages/page-version", "PageVersion"],
    ["models/pages/page-view", "PageView"],
    ["models/pages/page-request", "PageRequest"],
    ["models/pages/page-list-request", "PageListRequest"],
    ["enums/pages/page-method-name", "PageMethodName"],
    ["enums/pages/page-event-name", "PageEventName"],
    ["enums/pages/page-kind", "PageKind"],
    ["enums/pages/canvas-note-kind", "CanvasNoteKind"],
    ["enums/pages/canvas-mark-kind", "CanvasMarkKind"],
    ["enums/pages/canvas-axis", "CanvasAxis"],
    ["models/pages/canvas-manifest", "CanvasManifest"],
    ["models/pages/canvas-page", "CanvasPage"],
    ["models/pages/canvas-artboard", "CanvasArtboard"],
    ["models/pages/canvas-note", "CanvasNote"],
    ["models/pages/canvas-mark", "CanvasMark"],
    ["models/pages/canvas-guide", "CanvasGuide"],
    ["app/components/pages/page-document/page-document.component", "PageDocumentComponent"],
    ["app/services/pages/page-documents", "PageDocuments"],
    ["app/components/pages/page-card/page-card.component", "PageCardComponent"],
    ["app/components/pages/pages-view/pages-view.component", "PagesViewComponent"]
  ]);
  private static readonly COMPUTED: string = "a module named at run time";
  private static readonly RULE: string = "documents/ARCHITECTURE.md, the page tools, keeps Pages behind its module boundary: its folders take only Node, the context packages, Noldova Desktop's runtime and protocol, Pages' own protocol names, its package's base exception, and in the Window package Angular, the kit and Noldova Desktop's window, and TeamRun reaches it only through its entries.";

  private readonly listFilesAsync: () => Promise<readonly string[]>;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = "Pages boundary";

  public constructor(listFilesAsync: () => Promise<readonly string[]>, syntax: SyntaxTreeReader) {
    this.listFilesAsync = listFilesAsync;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.listFilesAsync()).filter(t => PagesBoundaryCheck.isProductionScript(t));
    const findings: string[] = [];
    findings.push(...await this.syntax.readAsync(files, (t, u) => PagesBoundaryCheck.inspect(t, PagesBoundaryCheck.referencesOf(u))));

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the imports and exports of ${files.length} production scripts against Pages' boundary.\n`);
    return findings.length === 0;
  }

  public static inspect(file: string, references: readonly ModuleReference[]): readonly string[] {
    const inside = PagesBoundaryCheck.PAGES_PATH.test(file);
    const findings: string[] = [];
    for (const reference of references) {
      const problem = inside ? PagesBoundaryCheck.inspectInside(file, reference) : PagesBoundaryCheck.inspectOutside(file, reference);
      if (problem !== null)
        findings.push(`${file}:${reference.line}: ${problem}; ${PagesBoundaryCheck.RULE}`);
    }
    return findings;
  }

  private static isProductionScript(file: string): boolean {
    return PagesBoundaryCheck.SOURCE_FILE.test(file)
      && !file.endsWith(PagesBoundaryCheck.DECLARATIONS)
      && !file.split("/").some(t => SourceTree.TEST_FOLDERS.has(t));
  }

  private static inspectInside(file: string, reference: ModuleReference): string | null {
    const specifier = reference.specifier;
    if (specifier.startsWith(PagesBoundaryCheck.RELATIVE))
      return PagesBoundaryCheck.PAGES_PATH.test(PagesBoundaryCheck.resolve(file, specifier)) || PagesBoundaryCheck.isPackageBase(file, reference) ? null
        : `takes ${specifier}, outside Pages' folders`;
    if (specifier.startsWith(PagesBoundaryCheck.NODE) || specifier.startsWith(PagesBoundaryCheck.CONTEXT) || specifier === PagesBoundaryCheck.RUNTIME
      || specifier === PagesBoundaryCheck.DESKTOP_PROTOCOL)
      return null;
    if (file.startsWith(PagesBoundaryCheck.WINDOW_FILE) && PagesBoundaryCheck.WINDOW_PACKAGES.some(t => specifier.startsWith(t)))
      return null;
    if (specifier !== PagesBoundaryCheck.PROTOCOL)
      return `takes ${specifier}, which Pages may not use`;
    const names = reference.names;
    if (names === null)
      return `takes all of ${specifier}, of which Pages may use only ${PagesBoundaryCheck.PROTOCOL_LIST}`;
    const others = names.filter(t => !PagesBoundaryCheck.PROTOCOL_NAMES.has(t));
    return others.length === 0 ? null : `takes ${others.join(", ")} from ${specifier}, of which Pages may use only ${PagesBoundaryCheck.PROTOCOL_LIST}`;
  }

  private static inspectOutside(file: string, reference: ModuleReference): string | null {
    if (!reference.specifier.startsWith(PagesBoundaryCheck.RELATIVE))
      return null;
    const target = PagesBoundaryCheck.PAGES_PATH.exec(PagesBoundaryCheck.resolve(file, reference.specifier))?.[1];
    if (target === undefined)
      return null;
    const entry = PagesBoundaryCheck.ENTRIES.get(target);
    if (entry === undefined)
      return `takes ${reference.specifier}, inside Pages, which TeamRun reaches only through its entries`;
    return reference.isLazy || reference.names?.every(t => t === entry) === true ? null : `takes more than ${entry} from ${reference.specifier}`;
  }

  private static isPackageBase(file: string, reference: ModuleReference): boolean {
    const base = PagesBoundaryCheck.BASES.get(PagesBoundaryCheck.resolve(file, reference.specifier).replace(PagesBoundaryCheck.SCRIPT_EXTENSION, ""));
    return base !== undefined && reference.names?.every(t => t === base) === true;
  }

  private static resolve(file: string, specifier: string): string {
    return posix.normalize(posix.join(posix.dirname(file), specifier));
  }

  private static referencesOf(source: ts.SourceFile): readonly ModuleReference[] {
    const references: ModuleReference[] = [];
    const visit = (node: ts.Node): void => {
      const reference = PagesBoundaryCheck.referenceOf(node);
      if (reference !== null)
        references.push(new ModuleReference(reference[0], reference[1], source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          ts.isCallExpression(node)));
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return references;
  }

  private static referenceOf(node: ts.Node): readonly [specifier: string, names: readonly string[] | null] | null {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const names = clause === undefined ? []
        : clause.name !== undefined || bindings === undefined || !ts.isNamedImports(bindings) ? null
          : bindings.elements.map(t => (t.propertyName ?? t.name).text);
      return [node.moduleSpecifier.text, names];
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.exportClause;
      return [node.moduleSpecifier.text, clause !== undefined && ts.isNamedExports(clause) ? clause.elements.map(t => (t.propertyName ?? t.name).text) : null];
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      return [PagesBoundaryCheck.textOf(node.moduleReference.expression), null];
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      return [PagesBoundaryCheck.textOf(node.arguments[0]), null];
    if (ts.isImportTypeNode(node))
      return [ts.isLiteralTypeNode(node.argument) ? PagesBoundaryCheck.textOf(node.argument.literal) : PagesBoundaryCheck.COMPUTED, null];
    return null;
  }

  private static textOf(node: ts.Node | undefined): string {
    return node !== undefined && ts.isStringLiteral(node) ? node.text : PagesBoundaryCheck.COMPUTED;
  }
}

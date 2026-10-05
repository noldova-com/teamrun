/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import {
  CommandRegistry, DataDirectory, DiagnosticRedactor, EventRegistry, type IRuntimePart, MethodRegistry, ModuleDeclaration, ModuleHost, NotificationCenter, WorkTracker
} from "@noldova/teamrun-shell-runtime";

import { RuntimePartLoaderFixture } from "./runtime-part-loader.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class ModuleHostFixture {
  public static declare(id: string, dependencies: readonly string[], runtimePackage: string | null, methods: readonly string[] = []): ModuleDeclaration {
    return new ModuleDeclaration(id, "0.0.1", id, id, dependencies, runtimePackage, new Map([["methods", [...methods, `${id}.run`]]]));
  }

  public static create(
    declarations: readonly ModuleDeclaration[],
    parts: ReadonlyMap<string, IRuntimePart | Error>,
    methods: MethodRegistry = new MethodRegistry(),
    diagnostics: TextOutputFixture = new TextOutputFixture(),
    root: string = path.resolve("teamrun-data"),
    work: WorkTracker = new WorkTracker(() => undefined)): ModuleHost {
    return new ModuleHost(
      declarations,
      new DataDirectory(root),
      methods,
      new EventRegistry({ broadcast: () => undefined }),
      new CommandRegistry(),
      new NotificationCenter(() => undefined, () => new Date(), randomUUID),
      new RuntimePartLoaderFixture(parts),
      diagnostics,
      work,
      new DiagnosticRedactor(path.resolve("home", "person")));
  }
}

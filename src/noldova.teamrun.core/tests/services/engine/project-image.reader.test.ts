/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { appendFileSync, mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProjectImageReader, SharedImages } from "@noldova/teamrun.core";
import { AttachmentContent, ErrorCode, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ProjectImageReaderTests {
  @TestMethod
  public readsAnImageInsideTheProjectByItsContent(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const png = ProjectImageReaderTests.png();
    mkdirSync(join(project, "out"));
    writeFileSync(join(project, "out", "chart.png"), png);
    writeFileSync(join(project, "out", "named.jpg"), png);
    writeFileSync(join(project, "out", "diagram.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 2 1\"/>");

    const read = ProjectImageReader.read(project, join(project, "out", "chart.png"));
    const renamed = ProjectImageReader.read(`${project}/`, join(project, "out", "named.jpg"));
    const drawn = ProjectImageReader.read(project, join(project, "out", "diagram.svg"));

    Assert.areEqual(JSON.stringify(new AttachmentContent("chart.png", "image/png", png.length, png.toString("base64")).toJson()), JSON.stringify(read.toJson()));
    Assert.areEqual("named.jpg:image/png", `${renamed.name}:${renamed.mediaType}`);
    Assert.areEqual("diagram.svg:image/svg+xml", `${drawn.name}:${drawn.mediaType}`);
  }

  @TestMethod
  public sharesARasterImageAsACopyOfItsCheckedBytesOrAsItIsAndRefusesAnSvgOrAFileOutsideTheFolder(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const png = ProjectImageReaderTests.png();
    writeFileSync(join(project, "chart.png"), png);
    writeFileSync(join(project, "diagram.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 2 1\"/>");
    writeFileSync(join(directory.path, "outside.png"), png);
    const copies = new SharedImages(join(directory.path, "shared-images"));

    const copied = ProjectImageReader.share(project, join(project, "chart.png"), copies);
    const itself = ProjectImageReader.share(project, join(project, "chart.png"), null);

    Assert.areEqual(`chart.png:image/png:${png.length}`, `${copied.name}:${copied.mediaType}:${copied.size}`);
    Assert.isTrue(copied.path.startsWith(join(directory.path, "shared-images")));
    Assert.isTrue(readFileSync(copied.path).equals(png));
    Assert.areEqual(realpathSync(join(project, "chart.png")), itself.path);
    Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.share(project, join(project, "diagram.svg"), copies)));
    Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.share(project, join(directory.path, "outside.png"), copies)));
  }

  @TestMethod
  public refusesAPathOrLinkThatLeadsOutOfTheProject(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const outside = join(directory.path, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.png"), ProjectImageReaderTests.png());
    symlinkSync(outside, join(project, "linked"), "junction");
    mkdirSync(join(directory.path, "alpha-other"));
    writeFileSync(join(directory.path, "alpha-other", "near.png"), ProjectImageReaderTests.png());

    for (const path of [join(outside, "secret.png"), join(project, "linked", "secret.png"), join(project, "..", "outside", "secret.png"),
      join(directory.path, "alpha-other", "near.png"), "secret.png", project])
      Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.read(project, path)), path);
  }

  @TestMethod
  public refusesAFileThatIsNotAnImageMissingOrOverTheCap(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    writeFileSync(join(project, "fake.png"), "<html><svg xmlns=\"http://www.w3.org/2000/svg\"/></html>");
    writeFileSync(join(project, "large.png"), ProjectImageReaderTests.png());
    truncateSync(join(project, "large.png"), ProtocolResources.maximumAttachmentReadBytes + 1);
    writeFileSync(join(project, "limit.png"), ProjectImageReaderTests.png());
    truncateSync(join(project, "limit.png"), ProtocolResources.maximumAttachmentReadBytes);

    Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.read(project, join(project, "fake.png"))));
    Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.read(project, join(project, "gone.png"))));
    Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusal(() => ProjectImageReader.read(join(directory.path, "missing"), join(project, "fake.png"))));
    Assert.areEqual(ErrorCode.TooLarge, ProjectImageReaderTests.refusal(() => ProjectImageReader.read(project, join(project, "large.png"))));
    Assert.areEqual(ProtocolResources.maximumAttachmentReadBytes, ProjectImageReader.read(project, join(project, "limit.png")).size);
  }

  @TestMethod
  public refusesAFileThatChangesOrFailsWhileItIsRead(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const path = join(project, "chart.png");
    const changes: (() => void)[] = [
      () => appendFileSync(path, "x"),
      () => {
        throw Object.assign(new Error("Simulated read failure"), { code: "EIO", syscall: "read" });
      }
    ];

    for (const [index, change] of changes.entries()) {
      writeFileSync(path, ProjectImageReaderTests.png());
      Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusalWhile([{ name: "readSync", call: 1, before: change }],
        () => ProjectImageReader.read(project, path)), String(index));
    }
    writeFileSync(path, ProjectImageReaderTests.png());
    Assert.areEqual("image/png", ProjectImageReader.read(project, path).mediaType);
  }

  @TestMethod
  public letsAnErrorThatIsNotTheFileSystemsThroughAsItIs(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const path = join(project, "chart.png");
    writeFileSync(path, ProjectImageReaderTests.png());
    const errors: unknown[] = [new TypeError("Not the file system's."), "Not an error.", Object.assign(new Error("No call named."), { syscall: 1 })];
    const thrown: unknown[] = [];
    const original = fs.readSync;
    for (const error of errors) {
      fs.readSync = () => {
        throw error;
      };
      syncBuiltinESMExports();
      try {
        ProjectImageReader.read(project, path);
      }
      catch (caught) {
        thrown.push(caught);
      }
      finally {
        fs.readSync = original;
        syncBuiltinESMExports();
      }
    }

    Assert.areEqual(JSON.stringify([true, true, true]), JSON.stringify(errors.map((t, i) => thrown[i] === t)));
    Assert.areEqual("image/png", ProjectImageReader.read(project, path).mediaType);
  }

  @TestMethod
  public refusesAFolderSwappedForALinkOutOfTheProjectAfterTheCheck(): void {
    using directory = new TemporaryDataDirectory();
    const project = ProjectImageReaderTests.project(directory);
    const outside = join(directory.path, "outside");
    const folder = join(project, "out");
    const kept = join(project, "kept");
    mkdirSync(outside);
    mkdirSync(folder);
    writeFileSync(join(outside, "chart.png"), ProjectImageReaderTests.png());
    writeFileSync(join(folder, "chart.png"), ProjectImageReaderTests.png());
    const swap = (): void => {
      renameSync(folder, kept);
      symlinkSync(outside, folder, "junction");
    };
    const back = (): void => {
      unlinkSync(folder);
      renameSync(kept, folder);
    };

    const cases: [name: string, hooks: Parameters<typeof ProjectImageReaderTests.refusalWhile>[0], restore: () => void][] = [
      ["swapped around the open", [{ name: "openSync", call: 1, before: swap, after: back }], () => undefined],
      ["swapped after the real path check and back after the open", [{ name: "realpathSync", call: 2, after: swap }, { name: "openSync", call: 1, after: back }], () => undefined],
      ["swapped before the open and left", [{ name: "openSync", call: 1, before: swap }], back]
    ];

    for (const [name, hooks, restore] of cases) {
      Assert.areEqual(ErrorCode.NotFound, ProjectImageReaderTests.refusalWhile(hooks, () => ProjectImageReader.read(project, join(folder, "chart.png"))), name);
      restore();
    }
    Assert.areEqual("image/png", ProjectImageReader.read(project, join(folder, "chart.png")).mediaType);
  }

  private static project(directory: TemporaryDataDirectory): string {
    const project = join(directory.path, "alpha");
    mkdirSync(project);
    return project;
  }

  private static png(): Buffer {
    const size = Buffer.alloc(8);
    size.writeUInt32BE(2, 0);
    size.writeUInt32BE(3, 4);
    return Buffer.concat([Buffer.from("89504e470d0a1a0a0000000d", "hex"), Buffer.from("IHDR", "latin1"), size, Buffer.alloc(5)]);
  }

  private static refusal(action: () => unknown): string {
    return Assert.throws(action, ServiceException).info.name;
  }

  private static refusalWhile(hooks: readonly { name: "readSync" | "openSync" | "realpathSync"; call: number; before?: () => void; after?: () => void }[], action: () => unknown): string {
    const originals = hooks.map(t => [t.name, fs[t.name]] as const);
    const calls = new Map<string, number>();
    for (const [name, original] of new Map(originals))
      Object.assign(fs, { [name]: new Proxy(original, { apply: (target, self, args: unknown[]): unknown => {
        const call = (calls.get(name) ?? 0) + 1;
        calls.set(name, call);
        const hook = hooks.find(t => t.name === name && t.call === call);
        hook?.before?.();
        try {
          return Reflect.apply(target, self, args);
        }
        finally {
          hook?.after?.();
        }
      } }) });
    syncBuiltinESMExports();
    try {
      return ProjectImageReaderTests.refusal(action);
    }
    finally {
      for (const [name, original] of originals)
        Object.assign(fs, { [name]: original });
      syncBuiltinESMExports();
    }
  }
}

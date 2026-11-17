/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, Message, MessageAuthor, MessageDetail, MessageStatus, Resources, WrittenImageReader } from "@noldova/teamrun.protocol";

@TestClass
export class WrittenImageReaderTests {
  @TestMethod
  public findsTheImagesAReplysChangesAddOrUpdateInItsProject(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["change", { changes: [{ path: "D:\\work\\app\\chart.png", kind: "add" }, { path: "D:\\work\\app\\notes.md", kind: "add" },
        { path: "D:\\work\\app\\old.gif", kind: "delete" }, { path: "D:\\work\\other\\logo.webp", kind: "add" }, { path: "D:\\work\\app\\icon.svg", kind: "update" }] }],
      ["edit", { tool: "Write", input: { file_path: "D:/work/app/docs/shot.JPG", content: "x" } }]
    ]), "D:\\work\\app\\");

    Assert.areEqual("D:\\work\\app\\chart.png,D:\\work\\app\\icon.svg,D:/work/app/docs/shot.JPG", paths.join(","));
  }

  @TestMethod
  public findsTheImagePathsAReplyNamesInItsTextsAndPayloadsOnce(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Saved the chart to D:\\work\\app\\out\\chart.png, and a copy at `d:/work/app/out/CHART.png`.", null],
      ["ran", { command: "python plot.py", output: ["wrote /tmp/plot.png", { file: "D:\\work\\app\\out\\plot.webp" }, "drew /work/app/logo.SVG"] }],
      ["no images", { text: "D:\\work\\app\\readme.md and D:\\work\\app.png" }],
      ["drew", { text: "D:\\work\\app\\diagram.svg" }]
    ]), "D:/work/app");

    Assert.areEqual("D:\\work\\app\\out\\chart.png,D:\\work\\app\\out\\plot.webp,D:\\work\\app\\diagram.svg", paths.join(","));
  }

  @TestMethod
  public leavesOutGeneratedImagesAndTheirBytes(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Generated image", { itemType: "imageGeneration", savedPath: "D:\\work\\app\\gen.png", imageData: "D:\\work\\app\\hidden.png" }],
      ["Generated image", { itemType: "imageGeneration", savedPath: null }],
      ["Wrote D:\\work\\app\\gen.png and D:\\work\\app\\kept.gif", null]
    ]), "D:\\work\\app");

    Assert.areEqual("D:\\work\\app\\kept.gif", paths.join(","));
  }

  @TestMethod
  public findsWhereAGeneratedImageWasSavedInItsProject(): void {
    const reader = new WrittenImageReader();
    const details = WrittenImageReaderTests.message([
      ["Generated image", { itemType: "imageGeneration", savedPath: "d:/WORK/app/out/gen.PNG", imageData: "AAAA" }],
      ["Generated image", { itemType: "imageGeneration", savedPath: "D:\\work\\other\\gen.png" }],
      ["Generated image", { itemType: "imageGeneration", savedPath: "D:\\work\\app\\..\\other\\gen.png" }],
      ["Generated image", { itemType: "imageGeneration", savedPath: "D:\\work\\app\\gen.txt" }],
      ["Generated image", { itemType: "imageGeneration", savedPath: null }],
      ["Wrote", { savedPath: "D:\\work\\app\\gen.png" }],
      ["listed", ["D:\\work\\app\\gen.png"]]
    ]).details;

    Assert.areEqual("d:/WORK/app/out/gen.PNG,,,,,,", details.map(t => reader.generatedPathOf(t, "D:\\work\\app\\") ?? String.empty).join(","));
  }

  @TestMethod
  public findsTheCopyTeamRunStoredOfAGeneratedImage(): void {
    const reader = new WrittenImageReader();
    const details = WrittenImageReaderTests.message([
      ["Generated image", { itemType: "imageGeneration", savedPath: "C:\\Users\\me\\gen.png", storedPath: "C:\\data\\images\\m-0.png", imageData: null }],
      ["Generated image", { itemType: "imageGeneration", storedPath: "C:\\data\\images\\m-1.bin" }],
      ["Generated image", { itemType: "imageGeneration", storedPath: null }],
      ["Wrote", { storedPath: "C:\\data\\images\\m-3.png" }]
    ]).details;

    Assert.areEqual("C:\\data\\images\\m-0.png,,,", details.map(t => reader.storedPathOf(t) ?? String.empty).join(","));
  }

  @TestMethod
  public leavesOutStoredCopiesAndPathsThatClimbOutOfTheProject(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Generated image", { itemType: "imageGeneration", savedPath: null, storedPath: "D:\\work\\app\\.data\\images\\m-0.png" }],
      ["Wrote D:\\work\\app\\.data\\images\\m-0.png, D:\\work\\app\\..\\secret.png and D:\\work\\app\\out\\kept.png", null]
    ]), "D:\\work\\app");

    Assert.areEqual("D:\\work\\app\\out\\kept.png", paths.join(","));
  }

  @TestMethod
  public findsTheImagePathBesideAnImagesBytesScanningEachPieceOnlyUpToItsLastExtension(): void {
    const bytes = Buffer.from(Array.from({ length: 1_300_000 }, (_, i) => (i * 7919 + (i >> 8)) % 256)).toString("base64");
    const message = WrittenImageReaderTests.message([
      ["Generated autumn.jpg", { tool: "other", content: [{ type: "image", data: bytes, mimeType: "image/jpeg" }] }],
      ["Copied it", { rawOutput: `${bytes.slice(0, 200_000)} copied to D:\\work\\app\\images\\autumn.jpg ${bytes.slice(0, 200_000)}.png` }]
    ]);
    const search = Resources.writtenImagePathSearch;
    const counting = new RegExp(search.source, search.flags);
    let scanned = 0;
    Object.defineProperty(counting, Symbol.matchAll, {
      value: (text: string) => {
        scanned += text.length;
        return search[Symbol.matchAll](text);
      }
    });
    Object.defineProperty(Resources, "writtenImagePathSearch", { value: counting });
    let paths: readonly string[];
    try {
      paths = new WrittenImageReader().pathsOf(message, "D:/work/app");
    }
    finally {
      Object.defineProperty(Resources, "writtenImagePathSearch", { value: search });
    }

    Assert.areEqual("autumn.jpg".length + "D:\\work\\app\\images\\autumn.jpg".length + 200_000 + ".png".length, scanned);
    Assert.areEqual("D:\\work\\app\\images\\autumn.jpg", paths.join(","));
  }

  @TestMethod
  public findsWhatOnePlainSearchOfTheWholeTextFindsInEveryShortTextAndManyLongerOnes(): void {
    const tokens = ["C:\\", "/", "x:/", " ", "\n", "\"", "<", "|", "*", "`", ".png", ".jpeg", ".pngx", ".GIF", "a", "+", ".."];
    const texts = [[String.empty]];
    for (let length = 1; length <= 3; length++)
      texts.push(texts.at(-1)!.flatMap(t => tokens.map(u => `${t}${u}`)));
    let seed = 314;
    const next = (count: number): number => (seed = seed * 48_271 % 2_147_483_647) % count;
    const longer = Array.from({ length: 1_000 }, () => Array.from({ length: 4 + next(9) }, () => tokens[next(tokens.length)]).join(String.empty));
    const reference = (text: string, root: string): string[] => {
      const found = new Map<string, string>();
      for (const [path] of text.matchAll(Resources.writtenImagePathSearch)) {
        const slashed = path.replaceAll("\\", "/");
        const key = root === "/" ? slashed : slashed.toLowerCase();
        if (key.startsWith(root) && !key.split("/").includes("..") && !found.has(key))
          found.set(key, path);
      }
      return [...found.values()];
    };

    for (const text of [...texts.flat(), ...longer])
      for (const root of ["C:/", "/"])
        Assert.areEqual(`${text} → ${reference(text, root.toLowerCase()).join(",")}`,
          `${text} → ${new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([[text, null]]), root).join(",")}`);
  }

  @TestMethod
  public findsTheImageFileAMarkdownImagesAddressNamesInsideTheProject(): void {
    const reader = new WrittenImageReader();
    const found = (root: string, ...sources: readonly string[]): string => sources.map(t => reader.markdownImagePathOf(t, root) ?? "null").join(",");

    Assert.areEqual("/work/app/out/chart.png,/work/app/out/my chart.png,/work/app/a.SVG,/work/app/out/./b.gif",
      found("/work/app/", " ./out/chart.png ", "out/my%20chart.png", "/work/app/a.SVG", "././out/./b.gif"));
    Assert.areEqual("D:\\work\\app\\out\\shot.jpg,D:/WORK/app/x.webp,D:\\work\\app\\50%.png",
      found("D:\\work\\app", "out\\shot.jpg", "D:/WORK/app/x.webp", "50%.png"));
  }

  @TestMethod
  public findsNoFileForAnAddressWithASchemeOrOutsideTheProjectOrNotAnImage(): void {
    const reader = new WrittenImageReader();
    const refused = ["http://example.com/a.png", "https://example.com/a.png", "HTTPS://example.com/a.png", "data:image/png;base64,AAAA.png",
      "javascript:alert(1)//.png", "file:///work/app/a.png", "//server/share/a.png", "\\\\server\\share\\a.png", "D:a.png", "C:/work/app/a.png",
      "../other/a.png", "out/../../a.png", "out\\..\\..\\a.png", "%2E%2E/a.png", "..%2Fa.png", "out%2F..%2F..%2Fa.png", "/work/other/a.png",
      "notes.md", "a.png?size=2", "a%0A.png", "a\u0000.png", "", "  "];

    Assert.areEqual(refused.map(() => "null").join(","), refused.map(t => reader.markdownImagePathOf(t, t.startsWith("C:") || t.startsWith("D:") ? "D:\\work\\app" : "/work/app") ?? "null").join(","));
  }

  @TestMethod
  public listsTheImagesAReplysMarkdownDrawsOnceAndLeavesThemOutOfItsWrittenImages(): void {
    const reader = new WrittenImageReader();
    const message = WrittenImageReaderTests.message([
      ["Here is ![the chart](./out/chart.png \"Chart\"), ![b](<out/my chart.png>), ![c](out/chart\\_2.png), ![web](https://example.com/a.png), ![again](./out/chart.png) and ![case](OUT/CHART.png).", null],
      ["Saved /work/app/kept.gif and drew ![shot](/work/app/shot.jpg) and ![up](../up.png).\n\n[ref]: out/ref.webp \"Ref\"\n  [far]:\n  <out/far away.svg>", null],
      ["![](out/ignored.txt)", { text: "![payload](out/payload.png)" }],
      ["As code: `![span](/work/app/span.png)`, ``![double `tick`](out/double.png)``, and\n```md\n![fenced](out/fenced.png)\n````\n"
        + "~~~\n![unclosed](out/unclosed.png)", null]
    ]);

    Assert.areEqual("/work/app/out/chart.png,/work/app/out/my chart.png,/work/app/out/chart_2.png,/work/app/OUT/CHART.png,/work/app/shot.jpg,/work/app/out/ref.webp,"
      + "/work/app/out/far away.svg",
      reader.markdownImagePathsOf(message, "/work/app").join(","));
    Assert.areEqual("/work/app/kept.gif,/work/app/span.png", reader.pathsOf(message, "/work/app").join(","));
  }

  @TestMethod
  public listsTheAddressesAReplysMarkdownDrawsImagesFromWhateverTheyNameOnceEach(): void {
    const message = WrittenImageReaderTests.message([
      ["![a](out/a%20b.png) ![web]( https://example.com/a.png ) ![data](data:image/png;base64,AAAA) ![again](out/a%20b.png) ![c](out/c\\_d.png)", null],
      ["`![span](span.png)`\n\n[ref]: data:image/gif;base64,R0lG", null]
    ]);

    Assert.areEqual("out/a%20b.png|https://example.com/a.png|data:image/png;base64,AAAA|out/c_d.png|data:image/gif;base64,R0lG",
      new WrittenImageReader().markdownImageSourcesOf(message).join("|"));
  }

  @TestMethod
  public endsACodeSpanAtABlankLine(): void {
    Assert.areEqual("/work/app/out/chart.png", WrittenImageReaderTests.drawn("Use the ` key.\n\n![chart](out/chart.png)\n\nThen press ` again."));
    Assert.areEqual("/work/app/out/chart.png", WrittenImageReaderTests.drawn("Use the ` key.\r\n \r\n![chart](out/chart.png)\r\n\r\nThen press ` again."));
  }

  @TestMethod
  public skipsIndentedCodeButNotALineThatContinuesAParagraph(): void {
    Assert.areEqual("/work/app/out/after.png", WrittenImageReaderTests.drawn("Text.\n\n    ![code](out/code.png)\n\tmore ![tab](out/tab.png)\n\n![after](out/after.png)"));
    Assert.areEqual("/work/app/out/kept.png", WrittenImageReaderTests.drawn("Paragraph\n    ![kept](out/kept.png)"));
  }

  @TestMethod
  public skipsAListItemsIndentedFenceAndCodeButNotItsParagraphs(): void {
    Assert.areEqual("/work/app/out/item.png,/work/app/out/lazy.png,/work/app/out/out.png", WrittenImageReaderTests.drawn("1. A step:\n\n   ![item](out/item.png)\n\n"
      + "    ```md\n    ![fenced](out/fenced.png)\n    ```\n   lazy ![lazy](out/lazy.png)\n\n       ![coded](out/coded.png)\n\n![out](out/out.png)"));
  }

  @TestMethod
  public readsAListItemsParagraphsUnderItsContentAndAfterANestedList(): void {
    Assert.areEqual("/work/app/out/shot.png", WrittenImageReaderTests.drawn("10. Step:\n\n    ![shot](out/shot.png)"));
    Assert.areEqual("/work/app/out/a.png", WrittenImageReaderTests.drawn("1. Install:\n   - run it\n\n   Output:\n\n    ![out](out/a.png)"));
    Assert.areEqual("", WrittenImageReaderTests.drawn("- a\n  - b\n\n  text\n\n      ![code](out/code.png)"));
  }

  @TestMethod
  public closesAFenceOnlyAtLessThanTheCodeIndent(): void {
    Assert.areEqual("/work/app/out/after.png", WrittenImageReaderTests.drawn("```md\n    ```\n![in](out/in.png)\n```\n![after](out/after.png)"));
  }

  @TestMethod
  public skipsIndentedCodeRightAfterAHeadingOrAFence(): void {
    Assert.areEqual("/work/app/out/y.png", WrittenImageReaderTests.drawn("# Files\n    ![x](out/x.png)\n```\ncode\n```\n    ![z](out/z.png)\n![y](out/y.png)"));
  }

  @TestMethod
  public findsTheProjectFileALinksTargetNamesWithoutItsLineSuffix(): void {
    const reader = new WrittenImageReader();
    const found = (root: string, ...targets: readonly string[]): string => targets.map(t => reader.linkedPathOf(t, root) ?? "null").join(",");

    Assert.areEqual("/work/app/out/notes.md,/work/app/src/a.ts,/work/app/src/a.ts,/work/app/src/a.ts,/work/app/src/b.ts,/work/app/README.md,/work/app/a%20b.txt,"
      + "/work/app/my file.txt", found("/work/app", "out/notes.md", "./src/a.ts:42", "src/a.ts:42:7", "src/a.ts#L10-L20", "src/b.ts#L3C2",
      "/work/app/README.md", "a%20b.txt", "my file.txt"));
    Assert.areEqual("D:\\work\\app\\docs\\guide.md,D:/work/app/x.txt", found("D:\\work\\app\\", "docs\\guide.md", "D:/work/app/x.txt"));
    Assert.areEqual("d:/WORK/App/a.txt,C:/Work/App/b.txt,null,null,/home/a/app/c.txt,/home/a/app/OUT/d.txt",
      found("D:\\work\\app", "d:/WORK/App/a.txt") + "," + found("C:/work/app", "C:/Work/App/b.txt") + ","
      + found("/home/a/app", "/home/a/App/notes.txt", "/HOME/a/app/x.txt", "/home/a/app/c.txt", "OUT/d.txt"));
  }

  @TestMethod
  public findsNoFileForALinkWithASchemeOrOutsideTheProject(): void {
    const reader = new WrittenImageReader();
    const refused = ["", "  ", ":42", "https://example.com/a.txt", "file:///work/app/a.txt", "mailto:me@example.com", "//server/a.txt", "\\\\server\\a.txt",
      "../a.txt", "out/../../a.txt", "/work/other/a.txt", "C:/work/app/a.txt", "a\u0000.txt", "a\n.txt"];

    Assert.areEqual(refused.map(() => "null").join(","), refused.map(t => reader.linkedPathOf(t, "/work/app") ?? "null").join(","));
  }

  @TestMethod
  public findsTheProjectFileALinksTargetNamesWithASlashBeforeItsDrive(): void {
    const reader = new WrittenImageReader();

    Assert.areEqual("D:/work/app/x.txt,D:\\work\\app\\y.png,null", ["/D:/work/app/x.txt", "\\D:\\work\\app\\y.png:12", "/C:/work/app/z.txt"]
      .map(t => reader.linkedPathOf(t, "D:\\work\\app") ?? "null").join(","));
  }

  @TestMethod
  public findsTheLocalFileALinksAbsolutePathNamesInsideAProjectOrNot(): void {
    const reader = new WrittenImageReader();
    const targets = ["/home/a/Pictures/portrait.png", "C:\\Users\\a\\Pictures\\portrait.png", "C:/Users/a/x.png:12", "/C:/Users/a/Pictures/portrait.png",
      "\\D:\\x.txt", "/work/app/notes.md#L3", "/work/other/../a.txt"];

    Assert.areEqual("/home/a/Pictures/portrait.png,C:\\Users\\a\\Pictures\\portrait.png,C:/Users/a/x.png,C:/Users/a/Pictures/portrait.png,D:\\x.txt,"
      + "/work/app/notes.md,/work/other/../a.txt", targets.map(t => reader.localPathOf(t) ?? "null").join(","));
  }

  @TestMethod
  public findsNoLocalFileForARelativeLinkOrOneWithASchemeOrANetworkPath(): void {
    const reader = new WrittenImageReader();
    const refused = ["", "  ", ":42", "out/a.png", "./a.png", "../a.png", "C:a.png", "https://example.com/a.png", "file:///C:/a.png", "mailto:me@example.com",
      "//server/a.png", "\\\\server\\a.png", "/a\u0000.png", "/a\n.png"];

    Assert.areEqual(refused.map(() => "null").join(","), refused.map(t => reader.localPathOf(t) ?? "null").join(","));
  }

  @TestMethod
  public listsTheImageFilesAReplysMarkdownLinksToOnce(): void {
    const message = WrittenImageReaderTests.message([
      ["See [the chart](out/chart.png), [notes](out/notes.md), [web](https://example.com/a.png), ![drawn](out/drawn.png), [up](../up.png) and "
        + "[spaced](out/my%20chart.png).", null],
      ["[line](out/plot.svg:3), `[code](out/code.png)`, [again](./out/chart.png), [escaped](out/a\_b.gif)\n\n[ref]: <out/ref one.webp>", null]
    ]);

    Assert.areEqual("/work/app/out/chart.png,/work/app/out/my chart.png,/work/app/out/plot.svg,/work/app/out/a_b.gif,/work/app/out/ref one.webp",
      new WrittenImageReader().markdownLinkImagePathsOf(message, "/work/app").join(","));
  }

  @TestMethod
  public leavesOutTheImagesACopilotSearchOrReadStepNamesBesideTheOnesTheReplyWrites(): void {
    const listing = ["4k", "opaque", "transparent", "wide"].map(t => `D:\\work\\app\\images\\${t}.png`);
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Finding files matching **/*", { kind: "search", toolCallId: "s1", status: "completed", files: [], tool: "search",
        rawInput: { pattern: "**/*" }, rawOutput: { files: listing }, content: [{ type: "content", content: { type: "text", text: listing.join("\n") } }] }],
      ["Viewing D:\\work\\app\\images\\wide.png", { kind: "read", toolCallId: "r1", files: ["D:\\work\\app\\images\\wide.png"], tool: "read" }],
      ["Fetching https://example.com/sky.png", { kind: "fetch", toolCallId: "f1", rawOutput: "saved nothing to D:\\work\\app\\sky.png", tool: "fetch" }],
      ["Creating images/autumn.png", { kind: "edit", files: ["D:\\work\\app\\images\\autumn.png"], tool: "edit",
        changes: [{ path: "D:\\work\\app\\images\\autumn.png", kind: "add", diff: "" }] }],
      ["Running convert", { kind: "execute", rawOutput: "wrote D:\\work\\app\\images\\autumn.svg", tool: "execute" }],
      ["I made D:\\work\\app\\images\\autumn.png from the search's D:\\work\\app\\images\\4k.png.", null]
    ]), "D:\\work\\app");

    Assert.areEqual("D:\\work\\app\\images\\autumn.png,D:\\work\\app\\images\\autumn.svg,D:\\work\\app\\images\\4k.png", paths.join(","));
  }

  @TestMethod
  public leavesOutTheImagesClaudeCodesReadingToolsAndTheirResultsAndCodexsReadOnlyStepsName(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Glob **/*.png", { tool: "Glob", input: { pattern: "**/*.png" }, toolUseId: "u1" }],
      ["/work/app/a.png\n/work/app/b.png", { toolUseId: "u1", isError: false }],
      ["Read /work/app/c.png", { tool: "Read", input: { file_path: "/work/app/c.png" }, toolUseId: "u2" }],
      ["Grep", { tool: "Grep", input: { pattern: "png", path: "/work/app/d.png" }, toolUseId: "u3" }],
      ["$ python draw.py", { tool: "Bash", input: { command: "python draw.py" }, toolUseId: "u4" }],
      ["wrote /work/app/drawn.png", { toolUseId: "u4", isError: false }],
      ["$ rg --files\n/work/app/e.png", { command: "rg --files", cwd: "/work/app", exitCode: 0, status: "completed", readOnly: true }],
      ["Web search: /work/app/f.png", { readOnly: true }],
      ["$ magick a.png /work/app/g.png", { command: "magick a.png /work/app/g.png", cwd: "/work/app", exitCode: 0, status: "completed", readOnly: false }]
    ]), "/work/app");

    Assert.areEqual("/work/app/drawn.png,/work/app/g.png", paths.join(","));
  }

  @TestMethod
  public keepsAnImageTheReplyWroteWhenAReadOrSearchStepAlsoNamesIt(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["Write /work/app/out.png", { tool: "Write", input: { file_path: "/work/app/out.png", content: "x" }, toolUseId: "u1" }],
      ["Read /work/app/out.png", { tool: "Read", input: { file_path: "/work/app/out.png" }, toolUseId: "u2" }],
      ["Finding files matching *.png", { toolCallId: "s1", tool: "search", rawOutput: { files: ["/work/app/out.png", "/work/app/old.png"] } }],
      ["$ magick in.png /work/app/drawn.png", { command: "magick in.png /work/app/drawn.png", exitCode: 0, status: "completed" }],
      ["$ ls\n/work/app/drawn.png", { command: "ls", exitCode: 0, status: "completed", readOnly: true }]
    ]), "/work/app");

    Assert.areEqual("/work/app/out.png,/work/app/drawn.png", paths.join(","));
  }

  @TestMethod
  public keepsTheImagesACodexToolNamedReadSearchOrFetchNamesAndLeavesOutOnlyAnAcpStepsOfThoseKinds(): void {
    const paths = new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([
      ["MCP tool img/read (completed)", { server: "img", tool: "read", status: "completed", output: "wrote /work/app/h.png" }],
      ["Tool search (completed)", { tool: "search", status: "completed", output: "wrote /work/app/i.png" }],
      ["Tool fetch (completed)", { tool: "fetch", status: "completed", toolCallId: 3, output: "wrote /work/app/j.png" }],
      ["Viewing /work/app/k.png", { kind: "read", toolCallId: "r1", tool: "read" }]
    ]), "/work/app");

    Assert.areEqual("/work/app/h.png,/work/app/i.png,/work/app/j.png", paths.join(","));
  }

  @TestMethod
  public findsNothingInAReplyWithoutImages(): void {
    Assert.areEqual(0, new WrittenImageReader().pathsOf(WrittenImageReaderTests.message([["done", null], ["listed", [1, true, null]]]), "/home/me/app").length);
  }

  private static drawn(text: string): string {
    return new WrittenImageReader().markdownImagePathsOf(WrittenImageReaderTests.message([[text, null]]), "/work/app").join(",");
  }

  private static message(details: readonly (readonly [string, JsonValue])[]): Message {
    return new Message("m", "c", 0, MessageAuthor.User, null, MessageStatus.Completed,
      details.map(([text, payload], i) => new MessageDetail(i, DetailKind.FileChange, text, payload, "t")), null, "t", null, "t");
  }
}

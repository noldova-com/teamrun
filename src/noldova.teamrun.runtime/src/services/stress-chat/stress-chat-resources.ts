/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { StressChatImage } from "../../models/stress-chat/stress-chat-image.js";

export class StressChatResources {
  public static readonly moduleId: string = "teamrun";
  public static readonly defaultPairs: number = 5000;
  public static readonly maximumPairs: number = 5000;
  public static readonly pairsOption: string = "--pairs";
  public static readonly pairsPattern: RegExp = /^[1-9][0-9]*$/;
  public static readonly usageExitCode: number = 2;
  public static readonly failureExitCode: number = 1;
  public static readonly usage: string = "Usage: npm run seed:stress [-- --pairs <count>], with a count from 1 to 5000; 5000 when left out.\n";
  public static readonly manifestFileName: string = "package.json";
  public static readonly desktopField: string = "desktop";
  public static readonly productField: string = "product";
  public static readonly dataDirectoryVariableField: string = "dataDirectoryVariable";
  public static readonly dataFolderField: string = "dataFolder";
  public static readonly dataFolderSeparator: string = "/";
  public static readonly developmentDataFolder: readonly string[] = ["_build", "data"];
  public static readonly projectFolderName: string = "stress-chat";
  public static readonly sourceFolderName: string = "src";
  public static readonly imagesFolderName: string = "images";
  public static readonly pngMediaType: string = "image/png";
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly base64Encoding: BufferEncoding = "base64";
  public static readonly asciiEncoding: BufferEncoding = "ascii";
  public static readonly pngSignature: readonly number[] = [137, 80, 78, 71, 13, 10, 26, 10];
  public static readonly pngHeaderChunk: string = "IHDR";
  public static readonly pngDataChunk: string = "IDAT";
  public static readonly pngEndChunk: string = "IEND";
  public static readonly pngHeaderLength: number = 13;
  public static readonly pngBitDepth: number = 8;
  public static readonly pngTruecolor: number = 2;
  public static readonly pngTruecolorWithAlpha: number = 6;
  public static readonly pngUpFilter: number = 2;
  public static readonly colorChannels: number = 3;
  public static readonly colorWithAlphaChannels: number = 4;
  public static readonly channelMaximum: number = 255;
  public static readonly imageBands: number = 8;
  public static readonly images: readonly StressChatImage[] = [
    new StressChatImage("opaque.png", 1280, 720, false),
    new StressChatImage("transparent.png", 512, 512, true),
    new StressChatImage("wide.png", 3000, 600, false),
    new StressChatImage("4k.png", 3840, 2160, false)
  ];
  public static readonly exampleFileName: string = "example.ts";
  public static readonly addedFileName: string = "added.ts";
  public static readonly removedFileName: string = "removed.ts";
  public static readonly renamedFileName: string = "renamed.ts";
  public static readonly exampleSource: string = "export function total(values: number[]): number {\n  return values.reduce((sum, value) => sum + value, 0);\n}\n";
  public static readonly addedSource: string = "export const isSynthetic = true;\nexport const purpose = \"trying the app at size\";\n";
  public static readonly renamedSource: string = "export const renamed = true;\n";
  public static readonly extraSources: ReadonlyMap<string, string> = new Map([
    ["extra-1.ts", "export const example1 = 1;\n"],
    ["extra-2.ts", "export const example2 = 2;\n"],
    ["extra-3.ts", "export const example3 = 3;\n"]
  ]);
  public static readonly projectFiles: ReadonlyMap<string, string> = new Map([
    [StressChatResources.exampleFileName, StressChatResources.exampleSource],
    [StressChatResources.addedFileName, StressChatResources.addedSource],
    [StressChatResources.renamedFileName, StressChatResources.renamedSource],
    ...StressChatResources.extraSources
  ]);
  public static readonly kind: string = "Synthetic";
  public static readonly model: string = "stress-chat";
  public static readonly pairIntervalMilliseconds: number = 120_000;
  public static readonly replyDelayMilliseconds: number = 1_000;
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly tokenDigits: number = 5;
  public static readonly tokenPadding: string = "0";
  public static readonly numberFormat: Intl.NumberFormat = new Intl.NumberFormat("en-US");
  public static readonly atlasId: string = "stress-chat-atlas";
  public static readonly atlasName: string = "Atlas";
  public static readonly novaId: string = "stress-chat-nova";
  public static readonly novaName: string = "Nova";
  public static readonly completedStatus: string = "completed";
  public static readonly workingTreeSource: string = "workingTree";
  public static readonly addKind: string = "add";
  public static readonly updateKind: string = "update";
  public static readonly deleteKind: string = "delete";
  public static readonly moveKind: string = "move";
  public static readonly shortReplyScenario: string = "Short reply";
  public static readonly longProseScenario: string = "Long prose";
  public static readonly headingsScenario: string = "Headings and emphasis";
  public static readonly listsScenario: string = "Lists and checklists";
  public static readonly tablesScenario: string = "Tables";
  public static readonly typeScriptScenario: string = "TypeScript";
  public static readonly pythonScenario: string = "Python";
  public static readonly csharpScenario: string = "C#";
  public static readonly jsonScenario: string = "JSON and YAML";
  public static readonly sqlScenario: string = "SQL and shell";
  public static readonly longLinesScenario: string = "Long code lines";
  public static readonly tallCodeScenario: string = "Tall code block";
  public static readonly plainCodeScenario: string = "Plain code";
  public static readonly attachedImagesScenario: string = "Attached images";
  public static readonly writtenImagesScenario: string = "Written images";
  public static readonly stepsScenario: string = "Reasoning and tool results";
  public static readonly commandScenario: string = "Command output";
  public static readonly diffScenario: string = "Diff changes";
  public static readonly editScenario: string = "Edit changes";
  public static readonly fileOperationsScenario: string = "File operations";
  public static readonly failedScenario: string = "Failed reply";
  public static readonly cancelledScenario: string = "Cancelled reply";
  public static readonly mentionsScenario: string = "Mentions";
  public static readonly unicodeScenario: string = "Unicode and links";
  public static readonly showcaseScenario: string = "Full showcase";
  public static readonly shortReply: string = "Done. A deliberately short reply.";
  public static readonly longProseParagraphs: number = 12;
  public static readonly tallCodeLines: number = 200;
  public static readonly headings: string = "# Heading one\n## Heading two\n### Heading three\n\n**Bold**, *emphasis*, ~~struck out~~ and `inline code`.\n\n"
    + "> A block quote over two lines.\n> It stays readable at narrow widths.\n\n---";
  public static readonly lists: string = "1. Open the chat.\n2. Open the steps.\n   - Look at a command.\n   - Look at a file change.\n3. Go back to the latest reply.\n\n"
    + "- [x] Synthetic history written\n- [x] No provider called\n- [ ] Scrolled through by hand";
  public static readonly table: string = "| Control | Try it | What you see |\n| :-- | :-- | :-- |\n| Copy | Copy a code block | A check mark |\n"
    + "| Word wrap | Wrap a long line | The text fits its block |\n| Steps | Open and close them | The steps show and hide |\n"
    + "| File change | Open a file | Its added and removed lines |\n| Going back | Leave and come back | The same place in the chat |";
  public static readonly typeScriptCode: string = "```typescript\nexport function binarySearch<T>(items: readonly T[], target: T, compare: (a: T, b: T) => number): number {\n"
    + "  let low = 0;\n  let high = items.length - 1;\n  while (low <= high) {\n    const middle = Math.floor((low + high) / 2);\n"
    + "    const order = compare(items[middle]!, target);\n    if (order === 0)\n      return middle;\n    if (order < 0)\n      low = middle + 1;\n"
    + "    else\n      high = middle - 1;\n  }\n  return -1;\n}\n```";
  public static readonly pythonCode: string = "```python\nfrom dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Sample:\n    name: str\n    value: int\n\n"
    + "def total(samples: list[Sample]) -> int:\n    return sum(sample.value for sample in samples)\n\nprint(total([Sample('alpha', 3), Sample('beta', 5)]))\n```";
  public static readonly csharpCode: string = "```csharp\npublic sealed record Sample(string Name, int Value);\n\npublic static class Samples\n{\n"
    + "    public static int Total(IEnumerable<Sample> values)\n    {\n        return values.Sum(value => value.Value);\n    }\n}\n```";
  public static readonly sqlCode: string = "```sql\nSELECT conversationId, COUNT(*) AS messages\nFROM messages\nGROUP BY conversationId\nORDER BY messages DESC;\n```\n\n"
    + "```bash\n# A synthetic example; nothing ran.\nprintf '%s\\n' 'stress chat'\nnode --version\ngit status --short\n```";
  public static readonly longLineWord: string = "wrap-this-long-line-without-losing-any-characters";
  public static readonly longLineWords: number = 40;
  public static readonly plainCode: string = "```\nA code block with no language\n  keeps its indentation\n\n  and its blank line\n\tand a tab\n```\n\n"
    + "```stress-language\nA language TeamRun doesn't know\nstill offers Copy and Word wrap\n```";
  public static readonly attachedImages: string = "The four attached images: an opaque one, a transparent one, a wide one and one at 4K.";
  public static readonly writtenImages: string = "Wrote four images in the project's images folder.";
  public static readonly reasoning: string = "A synthetic reasoning step\nCompare the layout with the request, and keep the message being read in place while the rows around it are measured.";
  public static readonly toolResult: string = "Example result one\nExample result two";
  public static readonly toolNames: readonly string[] = ["Grep", "Glob", "WebSearch", "WebFetch", "Task"];
  public static readonly toolQuery: string = "stress chat";
  public static readonly commentary: string = "A commentary between two groups of steps.";
  public static readonly readTool: string = "Read";
  public static readonly commandTool: string = "Bash";
  public static readonly command: string = "npm test -- --stress";
  public static readonly commandChecks: number = 45;
  public static readonly commandExit: string = "Exit code 0\n45 synthetic checks";
  public static readonly diffChanges: string = "Changed 6 files";
  public static readonly exampleDiff: string = "--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1,3 +1,4 @@\n export function total(values: number[]): number {\n"
    + "-  return 0;\n+  const result = values.reduce((sum, value) => sum + value, 0);\n+  return result;\n }";
  public static readonly longDiffWords: string = "long diff content ";
  public static readonly longDiffRepeats: number = 30;
  public static readonly removedSource: string = "export const old = true;\n";
  public static readonly editTool: string = "Edit";
  public static readonly multiEditTool: string = "MultiEdit";
  public static readonly writeTool: string = "Write";
  public static readonly editBefore: string = "return 0;";
  public static readonly editAfter: string = "return values.reduce((sum, value) => sum + value, 0);";
  public static readonly multiEditPairs: readonly (readonly [before: string, after: string])[] = [
    ["const label = \"before\";", "const label = \"after\";"],
    ["const count = 1;", "const count = 2;"]
  ];
  public static readonly fileOperations: string = "The working tree's changes";
  public static readonly failedCommand: string = "$ stress-tool --fail";
  public static readonly failedResult: string = "A synthetic failure: the example file was not found.\nNo command ran.";
  public static readonly failedError: string = "**A synthetic failure.** This reply ends as Failed on purpose; no provider failed.";
  public static readonly cancelledText: string = "Starting on the request";
  public static readonly cancelledNote: string = "Stopped\nA synthetic stop; no process ran.";
  public static readonly mentionsReply: string = "@Atlas and @Nova are mentioned in the request. They are names in a synthetic chat, not live teammates.";
  public static readonly unicode: string = "Unicode: Hello · Bună ziua · 日本語 · العربية · Ελληνικά · 👋 🌊 ✅\n\nEscapes: `<tag>` & `a < b && b > c`.\n\n"
    + "[A link](https://example.com) · `src/example.ts`";
  public static readonly closing: string = "This synthetic reply is finished. Open its steps and files to try their controls. **No agent made any change.**";
  public static readonly showcaseScenarios: readonly string[] = [
    StressChatResources.headingsScenario, StressChatResources.listsScenario, StressChatResources.tablesScenario, StressChatResources.typeScriptScenario,
    StressChatResources.longLinesScenario, StressChatResources.writtenImagesScenario, StressChatResources.stepsScenario,
    StressChatResources.commandScenario, StressChatResources.diffScenario, StressChatResources.unicodeScenario
  ];

  public static formatToken(turn: number): string {
    return `TURN-${String(turn).padStart(StressChatResources.tokenDigits, StressChatResources.tokenPadding)}`;
  }

  public static formatTitle(pairs: number): string {
    return `${StressChatResources.numberFormat.format(pairs * 2)} messages`;
  }

  public static formatIntroduction(pairs: number, scenarios: number): string {
    const count = StressChatResources.numberFormat.format(pairs);
    return `**${StressChatResources.formatToken(1)}** · ${StressChatResources.shortReplyScenario}\n\n## ${StressChatResources.formatTitle(pairs)}\n\n`
      + `This chat holds **${count} pairs** of a person's message and a reply, from ${scenarios} repeating scenarios, which \`npm run seed:stress\` wrote. `
      + "Everything in it is synthetic.\n\n"
      + "- Scroll slowly across short replies, very tall replies, images and code.\n"
      + "- Open **Worked for** to see a reply's steps, then open a step.\n"
      + "- Try Copy and Word wrap on code, the file changes, and the Changes and Activity panels.\n"
      + `- Search for **${StressChatResources.formatToken(Math.ceil(pairs / 2))}** to jump to the middle, or **${StressChatResources.formatToken(1)}** for the start.\n\n`
      + "Every reply has finished. No provider or provider session is attached to this chat or its replies, "
      + `and the names it mentions, @${StressChatResources.atlasName} and @${StressChatResources.novaName}, are not live teammates.`;
  }

  public static formatRequest(turn: number, scenario: string): string {
    return `**${StressChatResources.formatToken(turn)}** · ${scenario}\n\nShow the ${scenario.toLowerCase()} example. This is synthetic test data.`;
  }

  public static formatMentionRequest(turn: number, scenario: string): string {
    return `**${StressChatResources.formatToken(turn)}** · ${scenario}\n\n@${StressChatResources.atlasName} and @${StressChatResources.novaName}, `
      + "look at this request together. This is synthetic test data.";
  }

  public static formatHeading(scenario: string): string {
    return `**${scenario}**`;
  }

  public static formatParagraph(turn: number, paragraph: number): string {
    return `Paragraph ${paragraph} of turn ${turn}. The reader stays on the same text while the rows around it are measured. `
      + "Short requests and long explanations take turns with code, tables, images and recorded steps. "
      + "**This is synthetic content**, with `inline code` and enough words to wrap at several panel widths.";
  }

  public static formatProse(turn: number, paragraphs: number): string {
    return Array.from({ length: paragraphs }, (_, index) => StressChatResources.formatParagraph(turn, index + 1)).join("\n\n");
  }

  public static formatJson(turn: number): string {
    return `\`\`\`json\n{\n  "synthetic": true,\n  "turn": ${turn},\n  "values": [1, 2, 3],\n  "metadata": { "title": "Stress chat", "optional": null }\n}\n\`\`\`\n\n`
      + "```yaml\nsynthetic: true\nchecks:\n  - scrolling\n  - word-wrap\n  - images\nlimits:\n  messages: 10000\n```";
  }

  public static formatLongLines(turn: number): string {
    const line = Array.from({ length: StressChatResources.longLineWords }, () => StressChatResources.longLineWord).join(" ");
    return `\`\`\`typescript\nconst turn = ${turn};\nconst longText = "${line}";\nconst again = "${line}";\n\`\`\``;
  }

  public static formatTallCode(turn: number): string {
    const lines = Array.from({ length: StressChatResources.tallCodeLines }, (_, index) => `export const value${index + 1} = { line: ${index + 1}, turn: ${turn} };`);
    return `\`\`\`typescript\n${lines.join("\n")}\n\`\`\``;
  }

  public static formatCommandOutput(): string {
    const checks = Array.from({ length: StressChatResources.commandChecks },
      (_, index) => `PASS check-${String(index + 1).padStart(2, StressChatResources.tokenPadding)}: synthetic output, not a test that ran`);
    return `$ ${StressChatResources.command}\n${checks.join("\n")}`;
  }

  public static formatLongDiff(): string {
    return `${StressChatResources.exampleDiff}\n+// ${StressChatResources.longDiffWords.repeat(StressChatResources.longDiffRepeats).trim()}`;
  }

  public static formatReadStep(path: string): string {
    return `Read ${path}`;
  }

  public static formatToolStep(tool: string): string {
    return `${tool}: a synthetic step\n${StressChatResources.toolResult}`;
  }

  public static formatEditStep(tool: string, path: string): string {
    return `${tool} ${path}`;
  }

  public static formatToolUseId(tool: string, turn: number): string {
    return `${tool.toLowerCase()}-${turn}`;
  }

  public static formatSourcePath(root: string, name: string): string {
    return join(root, StressChatResources.sourceFolderName, name);
  }

  public static formatImagePath(root: string, name: string): string {
    return join(root, StressChatResources.imagesFolderName, name);
  }

  public static formatRelativeFolder(variable: string, folder: string): string {
    return `${variable} names "${folder}", which is not an absolute folder; name the development data folder by its absolute path.`;
  }

  public static formatInstalledFolder(folder: string, variable: string): string {
    return `${folder} is the installed TeamRun's data folder; the stress chat goes only into a development data folder, app/_build/data or another one ${variable} names.`;
  }

  public static formatOwned(folder: string): string {
    return `TeamRun is running on ${folder}; quit it and run the command again.`;
  }

  public static formatSeeded(pairs: number, folder: string, milliseconds: number): string {
    return `Wrote the chat "${StressChatResources.formatTitle(pairs)}" into the project ${folder} in ${StressChatResources.numberFormat.format(milliseconds)} ms.\n`;
  }
}

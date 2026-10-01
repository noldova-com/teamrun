/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import DocumentLinkValidator from "../../documents/document-link.validator.ts";
import MarkdownDocument from "../../documents/markdown-document.ts";

class DocumentLinkValidatorTests {
  private static readonly FILES: readonly string[] = [
    "README.md",
    "LICENSE",
    "docs/TESTING.md",
    "docs/space name.md",
    ".github/CONTRIBUTING.md",
    "src/modules/checkpoints/README.md",
    "scripts/test.ts",
    "notes/unparsed.md"
  ];

  public static register(): void {
    test("links to existing files, folders and headings in the repository pass", () => {
      const findings = DocumentLinkValidatorTests.validate("docs/TESTING.md", [
        "# Testing",
        "## 6. Verification scope",
        "[Same document](#6-verification-scope) [Root readme](../README.md) [License](/LICENSE) [Folder](../src/modules/)",
        "[Contributing](../.github/CONTRIBUTING.md#before-making-a-change) [Space](space%20name.md) [Repository root](../)",
        "[Root by slash](/) [Root twice](//) [Module](../src/modules/checkpoints/README.md#checkpoints) [Script](../scripts/test.ts#L3)",
        "[Blob](https://github.com/noldova-com/teamrun/blob/main/docs/TESTING.md#testing)",
        "[Tree](https://github.com/noldova-com/teamrun/tree/main/src/modules) [Issues](https://github.com/noldova-com/teamrun/issues/5)",
        "[Web](https://example.com/page?q=1#part) [Plain](http://example.com) [Mail](mailto:team@example.com)"
      ]);

      assert.deepEqual(findings, []);
    });

    test("missing files, missing headings, escaping paths and unsupported links are reported with their lines", () => {
      const findings = DocumentLinkValidatorTests.validate("docs/TESTING.md", [
        "# Testing",
        "[Missing](missing.md) [Heading](#absent) [Other heading](../README.md#absent)",
        "[Outside](../../outside.md) [Parent](..%2F..) [Encoding](bad%E0%A4%A.md)",
        "[Case](../readme.md) [Unparsed](../notes/unparsed.md#any)",
        "[Blob](https://github.com/noldova-com/teamrun/blob/main/docs/missing.md)",
        "[Blob heading](https://github.com/noldova-com/teamrun/blob/main/README.md#absent)",
        "[Blob encoding](https://github.com/noldova-com/teamrun/blob/main/bad%E0%A4%A.md)",
        "[Script](javascript:void) [Broken](https://[bad) [File](file:///etc/passwd)"
      ]);

      assert.deepEqual(findings, [
        "docs/TESTING.md:2: the link \"missing.md\" points to a missing file.",
        "docs/TESTING.md:2: the link \"#absent\" points to a missing heading \"#absent\".",
        "docs/TESTING.md:2: the link \"../README.md#absent\" points to a missing heading \"#absent\".",
        "docs/TESTING.md:3: the link \"../../outside.md\" points outside the repository.",
        "docs/TESTING.md:3: the link \"..%2F..\" points outside the repository.",
        "docs/TESTING.md:3: the link \"bad%E0%A4%A.md\" has an invalid percent-encoded path.",
        "docs/TESTING.md:4: the link \"../readme.md\" points to a missing file.",
        "docs/TESTING.md:4: the link \"../notes/unparsed.md#any\" points to a missing heading \"#any\".",
        "docs/TESTING.md:5: the link \"https://github.com/noldova-com/teamrun/blob/main/docs/missing.md\" points to a missing file.",
        "docs/TESTING.md:6: the link \"https://github.com/noldova-com/teamrun/blob/main/README.md#absent\" points to a missing heading \"#absent\".",
        "docs/TESTING.md:7: the link \"https://github.com/noldova-com/teamrun/blob/main/bad%E0%A4%A.md\" has an invalid percent-encoded path.",
        "docs/TESTING.md:8: the link \"javascript:void\" uses an unsupported protocol.",
        "docs/TESTING.md:8: the link \"https://[bad\" is not a valid URL.",
        "docs/TESTING.md:8: the link \"file:///etc/passwd\" uses an unsupported protocol."
      ]);
    });
  }

  private static validate(documentPath: string, lines: readonly string[]): readonly string[] {
    const document = new MarkdownDocument(documentPath, lines.join("\n"));
    const documents = [
      document,
      new MarkdownDocument("README.md", "# TeamRun\n## Modules\n"),
      new MarkdownDocument("docs/space name.md", "# Space\n"),
      new MarkdownDocument(".github/CONTRIBUTING.md", "## Before making a change\n"),
      new MarkdownDocument("src/modules/checkpoints/README.md", "# Checkpoints\n")
    ];
    return new DocumentLinkValidator(DocumentLinkValidatorTests.FILES, documents).validate(document);
  }
}

DocumentLinkValidatorTests.register();

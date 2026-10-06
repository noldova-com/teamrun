/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LanguageInput } from "@shikijs/primitive/types";

import "@noldova/teamrun-foundation-core";

export class CodeLanguage {
  public static readonly all: readonly CodeLanguage[] = [
    new CodeLanguage("typescript", ["ts"], () => import("@shikijs/langs/typescript")),
    new CodeLanguage("javascript", ["js", "mjs", "cjs"], () => import("@shikijs/langs/javascript")),
    new CodeLanguage("tsx", [], () => import("@shikijs/langs/tsx")),
    new CodeLanguage("jsx", [], () => import("@shikijs/langs/jsx")),
    new CodeLanguage("json", [], () => import("@shikijs/langs/json")),
    new CodeLanguage("jsonc", [], () => import("@shikijs/langs/jsonc")),
    new CodeLanguage("yaml", ["yml"], () => import("@shikijs/langs/yaml")),
    new CodeLanguage("toml", [], () => import("@shikijs/langs/toml")),
    new CodeLanguage("shellscript", ["shell", "bash", "sh", "zsh"], () => import("@shikijs/langs/shellscript")),
    new CodeLanguage("powershell", ["ps1", "pwsh"], () => import("@shikijs/langs/powershell")),
    new CodeLanguage("bat", ["batch", "cmd"], () => import("@shikijs/langs/bat")),
    new CodeLanguage("python", ["py"], () => import("@shikijs/langs/python")),
    new CodeLanguage("go", ["golang"], () => import("@shikijs/langs/go")),
    new CodeLanguage("rust", ["rs"], () => import("@shikijs/langs/rust")),
    new CodeLanguage("java", [], () => import("@shikijs/langs/java")),
    new CodeLanguage("kotlin", ["kt", "kts"], () => import("@shikijs/langs/kotlin")),
    new CodeLanguage("c", [], () => import("@shikijs/langs/c")),
    new CodeLanguage("csharp", ["c#", "cs"], () => import("@shikijs/langs/csharp")),
    new CodeLanguage("swift", [], () => import("@shikijs/langs/swift")),
    new CodeLanguage("php", [], () => import("@shikijs/langs/php")),
    new CodeLanguage("sql", [], () => import("@shikijs/langs/sql")),
    new CodeLanguage("html", [], () => import("@shikijs/langs/html")),
    new CodeLanguage("css", [], () => import("@shikijs/langs/css")),
    new CodeLanguage("scss", [], () => import("@shikijs/langs/scss")),
    new CodeLanguage("markdown", ["md"], () => import("@shikijs/langs/markdown")),
    new CodeLanguage("xml", [], () => import("@shikijs/langs/xml")),
    new CodeLanguage("docker", ["dockerfile"], () => import("@shikijs/langs/docker")),
    new CodeLanguage("diff", ["patch"], () => import("@shikijs/langs/diff")),
    new CodeLanguage("ini", [], () => import("@shikijs/langs/ini")),
    new CodeLanguage("graphql", ["gql"], () => import("@shikijs/langs/graphql")),
    new CodeLanguage("lua", [], () => import("@shikijs/langs/lua")),
    new CodeLanguage("r", [], () => import("@shikijs/langs/r")),
    new CodeLanguage("make", ["makefile"], () => import("@shikijs/langs/make"))
  ];

  private static readonly byName: ReadonlyMap<string, CodeLanguage> = new Map(CodeLanguage.all.flatMap(t => [t.id, ...t.aliases].map((name): [string, CodeLanguage] => [name, t])));

  public readonly id: string;
  public readonly aliases: readonly string[];
  public readonly load: LanguageInput;

  private constructor(id: string, aliases: readonly string[], load: LanguageInput) {
    this.id = id;
    this.aliases = aliases;
    this.load = load;
  }

  public static named(name: string | null): CodeLanguage | null {
    return Object.isNull(name) ? null : CodeLanguage.byName.get(name.trim().toLowerCase()) ?? null;
  }
}

# TeamRun coding standards

**Scope:** Source code, tests, scripts, and generated-code ownership, in the shell and in every module

These rules are self-contained; architecture and product decisions have separate owners. Never overcode: use the simplest implementation that preserves correctness, ownership and clarity. Add code, files or abstractions only for a present requirement.

## 1. Ownership and design principles

Every behavior has one named owner responsible for its state and invariants. Apply SOLID through cohesive responsibilities, valid objects, explicit dependencies, small APIs and genuine polymorphism. Apply DRY to duplicated knowledge and behavior, not merely similar code; it does not justify premature base classes or ownerless abstractions.

Place behavior with its owner:

1. The host provides it: use that form, except for section 3's foundation conventions.
2. One package needs it: use a method of its owning concept.
3. Several packages need it: place it in the lowest package that owns the concept, preserving dependency direction.

Do not create `helper`, `helpers`, `util`, `utils`, `utility`, `common`, `shared` or `misc` buckets, `Helper`/`Utility` classes, static grab bags or unrelated free functions. Renaming a bucket does not establish ownership; incidental words in precise domain terms are allowed. An independent responsibility becomes a named concept, such as a reader, parser, tracker or policy. Free functions are allowed only where required by a language, framework or platform; their substantive behavior remains class-owned.

### Lifetime and performance

Review speed and memory from the first line:

- Keep builders, buffers and worklists local. Results must not unnecessarily retain producer machinery; shared data retains its contracted lifetime.
- Own retained objects, callbacks, subscriptions, timers, processes and caches, including release. Review references escaping through returns, fields, closures and package boundaries; document non-obvious retention.
- Copy only when an independent snapshot is needed. Shallow copies share elements; views and stored callbacks require explicit retention, mutation and lifetime contracts.
- `readonly`, concrete types and a local variable's last use prove neither exclusive ownership nor deep immutability. Never invalidate data on those assumptions.
- Bound collections that grow with history, including transcripts, events and logs.
- Avoid hot-path allocation, repeated scans, reparsing and unnecessary copies. Pool or batch only for a demonstrated need.
- Garbage collection does not replace cleanup. Close processes, files, sockets and databases on normal and exceptional exits under their owner's contract; one caller finishing does not end a shared resource's lifetime.

## 2. Resources

Canonical package values belong in `Resources`: messages, report labels, protocol tokens, file extensions, environment/command names, regular expressions, formatting values and policy limits. Self-evident local algorithm literals, such as incrementing by `1`, may stay inline; timeouts and size limits need names. Semantic alternatives use enums or concrete value objects.

Use one `src/resources.ts` containing one `Resources` class with camelCase `static readonly` members, without resource directories or parallel classes. Code left out of packaged builds, such as the kit's Gallery, keeps its strings in its own resources class next to it, reached only from that code, because a bundler cannot drop members of a class the packaged build still uses; the [architecture](ARCHITECTURE.md#build-inputs) names the check. Static formatters combine owned text with runtime values. Exceptions use owning resources or diagnostic templates; do not duplicate catalog-owned text.

Enums own their values. Empty values, ES module specifiers, declarations and configuration keep their required language/toolchain form. Test inputs, expected results and fixtures remain independent of production `Resources` so output changes cannot also change the expected answer.

Scripts keep canonical text and structural values as constants on their owning class, without a shared `scripts/resources.ts`. Shared script behavior/data and test fixtures, builders, fakes and hosts follow section 1's ownership rules.

## 3. Object-oriented design

Production behavior belongs to classes representing named concepts under section 1's ownership rules.

- Constructors establish valid objects, validating before assignment. Separate checks (including `super`) from assignments with one blank line; omit it when there are no checks.
- Declare fields explicitly; do not use constructor parameter properties.
- Prefer instance methods for owned state. Static methods/classes must represent a cohesive concept needing no instance state.
- ES modules and namespaces are not surrogate objects for unrelated functions. Prefer composition when delegating a distinct responsibility.
- Add behavior to the concrete type instead of `if` or `switch` ladders over kind tags. A dispatcher is permitted only at a genuine runtime-dynamic boundary (parsing an external tool's events, decoding wire messages) and is narrow, named, and tested as such.
- Declaration merging and prototype additions are confined to `src/foundation`. Reuse its existing behavior; review and test additions here, without requiring an external private repository.
- Production packages use the foundation Core's additions to the global `Object` and `String` constructors: value checks are `Object.isUndefined`, `Object.isNull`, `Object.isNullOrUndefined`, `Object.isString`, `Object.isNumber`, `Object.isBoolean`, `Object.isObject`, `Object.isFunction`, `String.isNullOrEmpty`, and `String.isNullOrWhitespace`; the empty string is `String.empty`. Production consumers use these instead of `=== undefined`, `=== null`, `typeof x === "..."`, or `""`. A file that uses them starts its imports with `import "@noldova/teamrun-foundation-core";`. The foundation implementations themselves use the host language's operations, and their declarations must preserve TypeScript narrowing. Import and verify the required foundation package before importing its consumers. Automation scripts use native checks as specified in section 11.

Methods return concrete classes, primitives, enums or concrete runtime collections. Structured results use named classes; polymorphic results use meaningful base/abstract classes. Interfaces describe consumed or implemented contracts, not results. Do not return interfaces, shape aliases, anonymous objects, tuples or property bags, except at the wire boundary below.

### The wire contract

Each protocol message/model owns its wire form: its constructor validates invariants, `toJson()` returns explicitly typed plain JSON, and `static fromJson(value: unknown)` uses `JsonReader` and names invalid fields in a protocol error. Required fields and known values are validated; optional fields define absence/default semantics. Plain JSON is confined to serialization/deserialization, without wrappers added solely to satisfy the result-type rule. Domain operations use validated instances. Each table's owner provides one row-mapping class producing those same domain classes.

Declare supported versions and any capability negotiation. Reject incompatible versions and unsupported operations before execution. Ignore additional informational fields only where explicitly allowed. Security-sensitive schemas reject unsupported authorization options. Test that an unsupported version is refused, and test required fields, optional additions and incompatible changes. Data that outlives a build, such as persisted records, keeps compatibility tests with its older and newer forms; round trips alone do not prove compatibility.

## 4. Types and APIs

- Every TeamRun TypeScript project uses the strict repository profile in the root `tsconfig.base.json`.
- Declare explicit access modifiers and return types.
- Do not use `any`, double casts, or unchecked assertions to bypass a missing model. An external declaration that requires `any` keeps it at that boundary; TeamRun code accepts and narrows `unknown`.
- The `Reflect` API is not used to bypass typing, visibility, construction, invocation, or invariants, and neither are `any`, casts, `Object` APIs, or call indirection used to evade this rule.
- Narrow untrusted values at their boundary: IPC payloads, runtime messages, events from external tools, persisted rows, environment input, and repository content are untrusted. Inside, trust declared types; do not repeat them with `typeof`, `instanceof`, `Array.isArray`, or null guards. Semantic invariants the type system cannot express (ranges, ordering, non-empty values, cross-field consistency) are validated once by their owner, expressed in the type where possible, and never replaced by non-null assertions or silent fallbacks.
- `undefined` means missing; `null` means explicitly set to nothing. A value that may be absent is an optional member or parameter (`?`); a value that is known and empty is `T | null`; no member or parameter is `T | null | undefined`. On the wire an absent key is `undefined` and a JSON `null` is `null`, and `fromJson` keeps the distinction. `exactOptionalPropertyTypes` is on, so optional members are never assigned `undefined` explicitly.
- Declare every public interface and type alias in its owning source code.
- Prefer immutable and `readonly` data when mutation is not part of the concept; copy caller-owned collections when an independent snapshot is required; do not freeze objects at runtime.
- Keep public APIs small and intentional; internal mechanics remain private.

## 5. Classes and files

- Each implementation file declares one named concept (class, interface, alias or enum) and is named for it. Related, subordinate and private concepts use separate files and imports, located by domain and responsibility.
- Source interfaces live beneath `interfaces/`, grouped by domain when needed.
- Do not declare an empty constructor when the implicit one is the complete contract.
- Prefer small, cohesive classes and files; no god objects or generic context/state containers. Split a file only when a subordinate concept can be named independently. Cohesion outranks a line limit; file length is a review signal, not permission to extract ownerless behavior.

### Package organization

Application icons and fonts live in `assets/icons` and `assets/fonts`, with their license notices. A module's own assets live in `src/modules/<id>/assets`. Shared styles, including font-face declarations, live in `src/shell/ui/src/styles`.

The application icon is `icon-dark`: a white shape with a dark outline, which suits light and dark backgrounds alike. PNG names include their square pixel size, such as `icon-dark-128.png` or `icon-dark-512.png`. Purpose-specific icons use a descriptive variant, such as `icon-dock-512.png`; ICO files contain multiple resolutions and omit a single-size suffix.

A package's `package.json` sits at the package root, with the `src/` and `tests/` folders beside it. Each folder has its own TypeScript configuration at its root, and `resources.ts` sits at the root of `src/`; tests mirror the full path.

Package source trees use the concept categories `api`, `decorators`, `enums`, `exceptions`, `extensions`, `interfaces`, `intrinsics`, `models`, `services`, and `types`; create only those the package uses. Domain subfolders are optional and added only when they make current navigation clearer. Models hold state, identities, options, and results; services own operations such as tracking, supervising, dispatching, parsing, reading, writing, and verifying. Decorators hold TypeScript decorators, extensions hold foundation's additions to existing types, and intrinsics hold language-level primitives such as `nameof`. The [architecture](ARCHITECTURE.md#2-components-and-dependency-direction) owns which packages the shell and a module consist of.

The Angular parts (the shell's `window`/`ui` and module window parts) keep `src/` and `tests/` without a `package.json`, because the Angular project in `src/` compiles them from source ([architecture](ARCHITECTURE.md#2-components-and-dependency-direction)). They place services and models under `src/app`. Components pair `<name>.component.ts` and `<name>.component.html` through `templateUrl`; `<Name>Component` lives under `src/app/components/<name>/`. Services end in `.service.ts`. Shell selectors start with `tr-`, module selectors with `tr-<module id>-`; the architecture's [identity check](ARCHITECTURE.md#3-vocabulary-and-identity) enforces complete-name uniqueness. Each package owns `resources.ts`; templates access its text through a `resources` field. Section 13 owns test placement.

## 6. Methods and control flow

- Methods perform one coherent operation at the abstraction level of their owner, with direct, readable control flow and inputs, outputs, mutation, and failure visible in the API.
- Do not rely on ambient mutable state, hidden fallback, or distant side effects, and avoid boolean flags that make one method perform unrelated operations.
- Omit braces around a control-flow body of exactly one statement; use them for multiple statements.
- Name a single identifier arrow parameter `t` and omit its parentheses when untyped: `values.filter(t => t.isValid)`. Keep parentheses for zero or multiple parameters, type annotations, destructuring, defaults, or rest parameters.
- Stream potentially unlimited text or enforce a documented size limit before retaining it. Arrays of chunks also consume memory; they do not make unbounded input safe. For bounded accumulation, join chunks once when appropriate and keep small, bounded concatenation direct.

Handwritten TypeScript prefers 160 columns as a soft signal, not a gate; a cohesive signature, indivisible string, pattern, URL, or test input may exceed it. Never shorten names, add wrappers, or extract code to satisfy width. Multiline parameter and argument lists have no trailing comma; the closing parenthesis follows the final item:

```ts
public constructor(
  name: string,
  value: number) {
}

this.write(
  name,
  value);
```

## 7. Failure behavior

- Fail explicitly with a domain-specific error class that names what went wrong.
- Do not replace missing knowledge with zero, an empty value, a guessed match, or a silent fallback; a requested setting is never reported as the observed one.
- Reject invalid input under section 4's boundary-validation rules.
- Preserve the original cause when translating errors between layers, and redact secrets before an error is stored or shown.

Repair the cause a failure reveals. Do not add a guard, retry, fallback, skipped step or widened type whose only purpose is to hide an unexplained defect. Do not weaken an assertion, silently remove a failing case or narrow a verification scope to make a gate pass. When an accepted requirement changes, update its owning contract and tests deliberately; a failed check alone does not establish that its expectation is wrong.

Recovery is valid for a modeled condition: a classified transient network failure, a supported session-recovery path of an external tool or a documented user cancellation. State when recovery applies, preserve the failure evidence, and verify the resulting behavior. It must obey the lifetime and retry rules below and must not guess that an uncertain side effect did not occur. Boundary-validation tests may deliberately supply malformed input; do not invent impossible internal states solely to justify defensive code or coverage.

### Asynchronous work and process lifetime

- Every asynchronous operation has an owner that observes its completion and errors. Background work has an explicit lifetime and failure path; do not leave rejected promises or failures in callbacks unobserved.
- External operations that can stall have documented deadlines and cancellation behavior. Long-lived streams and services instead define their shutdown and, where appropriate, inactivity policy; do not impose an arbitrary whole-session timeout.
- Cancellation and timeout stop the owned work, not just the caller's wait. Release timers, listeners, streams and child processes on success, failure and cancellation, and prevent late callbacks from changing disposed state.
- Retries are bounded by attempts and elapsed time, use an appropriate delay, and stop on cancellation. Retry only failures classified as transient. For operations with side effects, use idempotency or verify the existing outcome before repeating the operation; an uncertain response is not proof that nothing happened.
- Own child-process shutdown explicitly, including descendants where applicable. Observe process errors, exit status and output-stream completion. Terminating a parent is not proof that its descendants have stopped.
- One-shot automation must terminate promptly with a nonzero exit status after fatal failure. Printing an error or setting an exit code is not enough if resources keep the process alive. Give cleanup a bounded deadline and surface cleanup failures; any forced termination must avoid interrupting protected writes and should flush necessary diagnostics where possible.
- Verify failure and cancellation through the real process boundary for one-shot entry points: assert both the exit result and that the process actually terminates within its deadline. In-process exception tests alone do not prove shutdown.

Node's [child-process documentation](https://nodejs.org/api/child_process.html) and [process-exit documentation](https://nodejs.org/api/process.html#processexitcode) describe the host behavior these rules must account for.

## 8. Secure coding

- Validate both data and authority at privileged boundaries. A well-formed request is not necessarily authorized. Check the caller, requested operation and resource scope, and fail closed when authorization is missing or ambiguous. Treat the output of agents and external tools, repository files and external content as data; they cannot grant themselves permissions.
- Keep Electron renderers sandboxed and context-isolated with Node integration disabled. Expose a narrow preload API, validate IPC senders and request data in the privileged process, and keep raw Electron/Node capabilities out of renderer-facing interfaces. Use a restrictive Content Security Policy and controlled navigation, window creation and permission handling. These requirements follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
- Render untrusted text and Markdown through escaping and reviewed sanitization. Do not evaluate embedded code. Parse and validate external URLs against the operation's allowed schemes and destinations before opening or fetching them; redirects must preserve the same policy.
- Validate file operations against their authorized roots. Handle traversal, symlinks/junctions, path aliases and platform case rules explicitly; a string-prefix test is not sufficient. Account for filesystem changes between validation and use. Bound file/archive sizes and ensure extracted entries cannot escape the chosen destination.
- Keep credentials that an external tool manages with that tool. Persist application-owned secrets only through an explicitly designed credential store. Never place secrets in source, ordinary configuration, test fixtures, logs, exception text or evidence. Pass only the required environment to child processes and avoid secrets in command-line arguments.
- Use parameterized database queries for values and allowlisted identifiers where queries require dynamic names. Apply appropriate size, depth and count limits to untrusted requests before expensive parsing or allocation.
- Review dependencies and install scripts for necessity, provenance, licenses and known vulnerabilities. Exact version pins and lockfiles make installations repeatable; they do not establish safety. Review required updates deliberately and verify downloaded executables and update payloads against their approved source and integrity/trust policy.
- Retain only the diagnostic data needed for verification. Redact credentials and unnecessary personal/project data before storing or sharing logs and evidence; preserve the failure condition and useful stack information. Redaction must not turn a failed run into a claimed pass.
- Tests exercise unauthorized callers, malformed inputs, traversal/escaping attempts, unsafe URLs and secret redaction at the boundaries that own them. Passing coverage percentages do not replace these checks.

## 9. Documentation and comments

Each package exposes its API through `src/api/index.ts` and declares/documents it in handwritten `src/api/index.d.ts`. Every public type, member and overload has original JSDoc sufficient for use without reading implementation. IntelliSense and reference pages derive from these declarations using compiler-aware tooling, never text/regex extraction or a second documentation copy; private details are excluded. Shell declarations are the module contract; module declarations are its published API.

The Angular parts are not packages, but the kit and the window are APIs other parts build on, so each declares and documents its `src/api/index.ts` in a handwritten `src/api/index.d.ts` beside it, under this section's JSDoc and example rules; their examples import the part by its path alias. `npm test` compares each declared part with its implementation, as it does a package. A part's classes are not meant to be subclassed, so their protected members are template wiring, not API, and its declarations leave them out. A member that only its own class's template and host bindings use is protected, so it stays out of the API, and specs reach it through the rendered element. A package declares its protected members, because its classes can be extended. An export that only development builds or the build's generated source use stays out of `src/api/index.ts` and has its own entry; the [architecture](ARCHITECTURE.md#2-components-and-dependency-direction) names them. The Angular parts' source carries no JSDoc and no comments.

Every public callable signature documents:

- `@param` for each parameter: purpose, accepted inputs, constraints, units, defaults and callback obligations as applicable, beyond its name/type.
- `@returns` for non-void results: meaning, ownership, ordering, absence and asynchronous completion as applicable; omitted for constructors. A `never` result or an `asserts` signature needs a `@throws` instead, and may also have a `@returns`.
- `@throws` for contractual failures: type, trigger and synchronous throw versus promise rejection; no invented contracts or empty tags.
- `@example` for normal and boundary usage. Overloads of one callable share their examples; examples compile or run during verification. Each `@example` is a ```` ```ts ```` code block that imports the package by name, as a consumer does; an expected-error example marks the line that must fail with `// @ts-expect-error`. `npm test` compiles every example, including those of classes, interfaces and types, and requires one for each public callable.

Document relevant generic roles, property meaning, mutation, lifecycle, performance and deprecation. Use `@remarks` and symbol links where useful; keep conceptual guides separate and linked. Avoid repetitive prose without omitting argument documentation.

Source, tests, scripts and styles carry only the license header, with no JSDoc, rationale or summary comments. Rename or restructure code that needs explanation; put rationale in the issue, PR or owning document.

External references may establish behavior; their prose is not copied. Every JSDoc uses the multiline form with separate opening and closing lines; parameter tags use `@param name description`, without a hyphen after the name:

```ts
/**
 * Describes the public contract.
 */
```

Automated checks compare packaged declarations with implementation: exports, constructors, parameter/property types, optionality/nullability, generic constraints, overloads, visibility and returns. `npm test` checks each declaration file against this section's JSDoc presence, `@param`, `@returns` and form rules, and also refuses an empty JSDoc, an empty tag, a `{@link}` that doesn't resolve and a `@throws` type that doesn't resolve. Humans review meaning. Compile positive and expected-error consumer examples against the package and test its installed runtime behavior. Breaking changes require an explicit version/compatibility decision.

## 10. Naming and formatting

- Package names are `@noldova/teamrun-<name>`, joining the lowercase kebab-case package path beneath `src/` with hyphens: `src/modules/terminal/window` becomes `@noldova/teamrun-modules-terminal-window`. Paths must not produce colliding names.
- A fixture module's package is the exception: under `src/shell/desktop/tests/e2e/fixtures/modules/`, its name joins the path below that folder, so `notes/runtime` becomes `@noldova/teamrun-fixture-notes-runtime`. Only a [test build](TESTING.md#desktop-ui-automation) builds fixture modules; a regular build only type-checks their packages, and no other package may depend on one.
- The root manifest's application version owns the product's version and its packages' versions, except a module's part packages, which take the version in the module's `module.json` ([architecture](ARCHITECTURE.md#modules-and-versions)). Package manifests under `src/` use `__VERSION__` for their own version and references to other TeamRun packages; the build stamps each with its package's version. External dependency versions are exact pins from the registry, never ranges, tags, aliases, paths, Git or URL sources, and each folder with a lockfile keeps `save-exact=true` in its `.npmrc`; the Dependency pins check enforces both. The root manifest declares the protocol version separately from the application version, and each data format's owner declares that format's version; neither copies the application version. A package's `resources.ts` receives the protocol version through `__PROTOCOL_VERSION__`. The product version and the build's fingerprint reach the shell through the build's product file, never through a package, so a package is rebuilt only when its own source, its version or a package it depends on changes.
- The shell takes the product's identity only from the root manifest's `teamrun.product` ([architecture](ARCHITECTURE.md#10-build-installation-and-updates)). The runtime, the desktop and the command line read it at start from the build's product file through the runtime's `ProductInfo`. The desktop's and the command line's `Resources` expose the values they use, and anything composed from them, as static getters; the runtime's `Resources`, whose field names `ProductInfo` reads, never import it, so its messages take the values as arguments of their `format` methods. The window reads the product name from the build's generated `src/generated/product.ts`. Messages that name the product compose it from these values. The Product identity check refuses any identity value spelled in the shell's production source; scripts read the identity through `ProductIdentity`.
- Concept directories use lowercase kebab-case. A type's filename preserves the words in its name: neither adds a word the other lacks.
- Use a dot before a final role word in a type's filename: `node`, `parser`, `lexer`, `reader`, `validator`, `exception`, or `service`. For example, `ArgumentException` lives in `argument.exception.ts`, `SourceReader` in `source.reader.ts`, and `BinarySearchService` in `binary-search.service.ts`. Other words remain lowercase kebab-case, as in `snapshot-tracker.ts` for `SnapshotTracker`. A single-word type keeps its name, such as `exception.ts` for `Exception`; do not add `.model`, `.enum`, or `.interface` markers.
- Supporting files use their kind suffix: `.test.ts`, `.extensions.ts`, `.fixture.ts`, and `.d.ts`. `.extensions.ts` marks foundation's additions to existing types. Package entry points (`api/index.ts`), `resources.ts`, manifests, TypeScript configuration and scripts keep their fixed names. Angular filenames follow section 5.
- Classes, abstract classes, enums, type aliases and other named types use descriptive PascalCase; interfaces use `I` plus PascalCase (`IProviderAdapter`); decorators use PascalCase.
- Name a type for its responsibility. A name such as `SourceReader`, `SnapshotTracker`, or `DiagnosticCollector` needs no additional `Service` suffix. Use `Service` only when a more specific role does not describe the type; retain established API names such as `Assert`.
- `Component` is reserved for Angular UI building blocks.
- `Module` alone means a TeamRun module. Write `ES module` for the language's unit, `NgModule` for Angular's, and name TypeScript's `module` and `moduleResolution` settings explicitly.
- Methods, properties, parameters, locals, and fields use camelCase; private fields have no leading underscore.
- A method name is a verb phrase naming its action (`readString`, `formatChildPath`, `throwWrongTypeException`, `fromValue`); a property or accessor is a noun. A `Resources` method that composes a message starts with `format`. Booleans use predicate forms (`isEmpty`, `hasValue`, `canRead`).
- Generic type parameters use `T` or `T` plus role (`TKey`, `TValue`).
- Internal constants use UPPER_SNAKE_CASE; `Resources` members and state fields stay camelCase. Literal placement follows section 2, including local algorithm values and constants owned by scripts.
- Test filenames and classes follow section 13.
- Two-space indentation; semicolons; explicit names rather than abbreviations, and no adoption of an external tool's own abbreviations.
- Enum members use PascalCase, and TeamRun-owned string values exactly match their member names (`InvalidParams = "InvalidParams"`). Values fixed by an external compatibility contract keep that spelling. Use explicit string values by default and explicit numeric values only when numeric meaning or representation is required, such as bit flags, binary formats or native interop; never mix strings and numbers or rely on implicit ordering. The enum owns its literals, not `Resources`.
- API declarations mirror enum values exactly, and tests keep independent expected literals. Before changing values, inspect comparisons, reverse lookups and serialization dependencies; update declarations, consumers and tests together. A casing change also changes serialized values.
- Member order in a class or interface: public static fields first, then the other fields grouped by visibility, private first, then protected, then public, static members before instance members within a group; then the constructor; then accessors and public methods; then protected methods; then private methods. A public static field that builds itself from its own class, by naming the class in a call, a constructor or another static member, stays after the statics it needs, because a class's static fields initialize in declaration order; the Field order check enforces both rules. Fields of one group have no blank line between them; one blank line separates groups and every other member. Enum members have no blank lines between them. Handwritten declarations follow the same rules; generated outputs use the verified generator's formatting and are not edited by hand.
- Every text file ends with exactly one newline, the terminator of its last line, and no blank line after it. Use LF line endings and require `.gitattributes` to enforce them with `* text=auto eol=lf`; the Documents check fails without that line.
- Keep formatting mechanical and consistent; automate it when tooling exists.

Imports are grouped by origin:

1. Host built-in ES modules, such as `node:fs/promises`.
2. Package imports, including `@noldova/...` and external packages.
3. Relative imports, including parent and sibling paths.

Separate non-empty groups with one blank line and add no blank lines within a group. Type-only, value, namespace and side-effect imports belong to their origin group. Within each group, sort declarations and named imports consistently with VS Code's Organize Imports. Required side-effect initialization order takes precedence, including the foundation initialization required by section 3; formatting must not change initialization behavior.

## 11. Automation and scripts

Keep runnable entry points and bootstrap configuration directly in `scripts/`. Group supporting implementations by responsibility, such as `scripts/build/` and `scripts/packaging/`; their tests mirror those paths under `scripts/tests/`, with fixtures beside the tests they support.

Standalone automation uses TypeScript for builds, tests, packaging, generation, fixtures, live checks and developer tools; no other-language scripts or wrappers. These standards apply to scripts. npm commands expose TypeScript entry points with arguments, not inline shell. Spawn subprocesses without a shell using argument arrays; validate the executable, arguments, working directory and environment. Section 7 governs deadlines, retries and shutdown. Dependencies need an explicit decision, exact pins and a present need. Scripts use native value checks so they can run before foundation is built.

GitHub configuration uses YAML under `.github`. Files in `.github/workflows` may use small inline scripts, toolchain commands and existing npm entry points under the same security and failure rules; [TESTING.md](TESTING.md#5-coverage-requirements) owns how inline scripts are tested. Pass untrusted event data through environment variables or API responses, never script interpolation. Pin Actions to full commit SHAs and record release versions.

Linux runtime startup and AppImage restart may use fixed Bash programs under their launch owner to close inherited descriptors. Pass paths/arguments positionally, never as interpolated code. Runtime startup disables Bash startup files and inherited shell options. This exception permits no general shell-based execution or standalone shell scripts.

Shells: on Windows, explicitly use Git for Windows Bash (plain `bash.exe` launches WSL; enter WSL only through `wsl.exe` for Linux-native work). On Linux and macOS use Bash from PATH. Do not substitute PowerShell, `cmd.exe`, or batch for repository operations, and never encode machine-specific paths in workflows.

## 12. License header

TeamRun's own code is intended for distribution under the MIT license. The root `LICENSE` file must contain that license before distribution and is the license authority; this standards document does not replace it. Every repository-owned source, test, script, style, template, workflow and generated file that supports comments begins with this exact notice, in the comment form of its format; generators emit it themselves, and formats without comments (such as JSON) are excluded. TypeScript, JavaScript, CSS and SCSS use the block comment:

```ts
/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
```

HTML templates use the markup comment:

```html
<!--
@license
Copyright (c) Noldova.

This source code is licensed under the license found in the
LICENSE file in the root directory of this source tree.
-->
```

YAML configuration uses `#` comments:

```yaml
# @license
# Copyright (c) Noldova.
#
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.
```

`npm test` refuses a tracked file of these formats that does not start with its header. Third-party material is never copied in without checking its license and recording any obligation; AGPL-licensed references are read, not copied.

## 13. Tests

Foundation-tested packages keep separately compiled `src/` and `tests/` siblings beside the package's `package.json` (section 5). Tests mirror source paths, replacing `.ts` with `.test.ts` and preserving role suffixes:

```text
src/services/snapshot-tracker.ts
tests/services/snapshot-tracker.test.ts
```

Never change production code solely to accommodate tests or coverage: no widened APIs, weakened visibility, test-only paths, or altered ownership. A test uses an accepted product boundary or is redesigned around one.

Every executable production file has its mirrored test file under the path rule above. A file is executable when it has a function body: a constructor, method, accessor, function or arrow function. A file that only declares types, interfaces, enums, values, re-exports or abstract members, and a `.d.ts` file, is not executable; it may still have a test. Every `.test.ts` file under a package's `tests`, and every Angular `.spec.ts` file under `tests`, mirrors a production file that exists; files under `tests/fixtures`, setup and configuration files directly under `tests`, and Playwright workflows are not tests of one file and are exempt. A file that [TESTING.md](TESTING.md#5-coverage-requirements) excludes from coverage needs no mirrored test, because no package test can measure it. A file that the package's public API (`src/api/index.ts`) does not export is tested through that API, and no export is added for the test. Foundation test classes append `Tests` to the production type; method names describe the behavior proved.

Angular specs mirror paths relative to `src` beneath sibling `tests`, replacing `.ts` with `.spec.ts`: `src/app/services/layout-store.service.ts` maps to `tests/app/services/layout-store.service.spec.ts`. A stylesheet whose behavior its package owns may have a spec that mirrors it the same way, replacing `.scss` with `.spec.ts`. Shared fixtures use `tests/fixtures`; environment configuration lives directly under `tests`.

Playwright workflows use `src/shell/desktop/tests/e2e` or `src/modules/<id>/e2e`, with adjacent `fixtures` that also hold any fixture modules the workflows use. Their `.spec.ts` files have descriptive titles, no test classes or one-to-one production mapping, and a separate TypeScript project and runner.

Tests exercise observable behavior, branches, boundaries and failures through the owning public API. Doubles of external tools are named fakes with scripted behavior. Regression tests record required behavior; tests against a live external service are labelled and excluded from the default gate.

[TESTING.md](TESTING.md) owns execution, coverage and evidence; sections 9 and 7 own API checks and failure handling.

## 14. Enforcement

Standards that can be checked mechanically receive an automated guard when tooling exists; a guard enforces the rule's intent, not a filename spelling. Exceptions require an explicit reviewed change to this document, never an allowlist that silently weakens it.

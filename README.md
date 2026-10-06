# TeamRun

TeamRun is designed to bring your coding agents, conversations and tools together.
The main app is the window and the workspace.
Everything you do in it comes from a module, so TeamRun grows by adding modules.

## Work with your agents

Whether you use one coding agent or several, they can all work in the same conversation.
It doesn't matter which provider a model comes from, and later it won't matter which computer it runs on.
TeamRun is built around a straightforward workflow:

1. **Start where you work.**
   Connect a conversation to the local folder you're working on, or start one without a project.
2. **Choose who helps.**
   Pick a provider you're signed in to, or create named teammates with their own roles and model preferences.
3. **Work in conversation.**
   Describe a task, share files or images, and follow replies and project changes.
4. **Review and continue.**
   Respond to permission requests, inspect the results and return to the conversation when you need it.

## Modules

Conversations, providers, terminals, editors and diffs are modules.
Every module is built in: Noldova writes it and delivers it with TeamRun.
Installing modules yourself and modules by other authors are separate future capabilities.

## Platforms

TeamRun targets Windows, macOS and Linux on x64 and ARM64.

## Build from source

You need Git, Node.js 26.7.0 or a later 26.x release, and npm 11.19.0.
In a clone of the repository, run:

```bash
npm ci
npm run build
npm test
```

`npm ci` installs the exact tool versions the repository pins and warns when your Node.js or npm version differs from the required one.
`npm run build` builds the packages under `src/`, writes the declarations of the modules the build lists, installs the Angular project in `src/` from its own lockfile, downloads the headless Chromium its tests run in and installs Electron's binary when it is missing, trying up to four times.
`npm test` runs the complete set of checks: the documents' format and links, the license headers, the fixed pauses in tests, the pinned GitHub Actions, the module folders, the architecture's dependency and naming rules, the product identity, the build of every package and its tests, the API declarations, their documentation and their examples, the type check and tests of the repository's scripts, and the Angular tests, each with full coverage.
`npm test -- documents` runs only the document checks.
`npm test -- --filter <text>` runs only the tests that the text selects, and `--repeat <count>` repeats a run on a test machine; the [testing contract](docs/TESTING.md#2-discovery-and-selection) says how filters select.
`npm run test:ui` runs the desktop UI workflows: it builds the test builds, prepares the development app described below and drives it in a window, so it needs a display.

To run TeamRun from your build, run `npm start`.
It starts a copy of Electron's program that carries TeamRun's name and icon, in `_build/development-app`, and prepares the copy again when Electron, the version or the icons change.

To use the `teamrun` command line from your build, run `npm run teamrun -- <command>`, for example `npm run teamrun -- status`.
[The command line's document](src/shell/cli/README.md) describes its commands, options and exit codes.

Some Linux systems restrict unprivileged user namespaces, as Ubuntu does since 23.10.
There, Chromium's sandbox needs its helper owned by root with the setuid bit, and `npm start` stops and prints the commands instead of starting.
Run them once, and again after the copy is prepared again:

```bash
sudo chown root:root _build/development-app/chrome-sandbox && sudo chmod 4755 _build/development-app/chrome-sandbox
```

## Questions, ideas and pull requests

Have a question, found a bug or want to suggest a feature?
Search [GitHub Issues](https://github.com/noldova-com/teamrun/issues), then open an issue describing what you need.
For security concerns, follow the [private reporting guidance](.github/SECURITY.md).

Issues are welcome from anyone.
Pull requests come only from the team; the [contribution guide](.github/CONTRIBUTING.md) describes both.

For a closer look at the project, read the [architecture](docs/ARCHITECTURE.md), [coding standards](docs/CODING-STANDARDS.md), [UI standards](docs/UI-STANDARDS.md) and [testing approach](docs/TESTING.md).

## License

TeamRun is a NOLDOVA project.
Its own code and documentation are licensed under the [MIT License](LICENSE).
Third-party components and assets retain their respective licenses.

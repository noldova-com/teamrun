# TeamRun app

**Scope:** The app that runs TeamRun's module on Noldova Desktop, `app/`, started in development.

## What it is

`app/` is a project of its own: its `package.json` declares the app under `desktop`, as Noldova Desktop's [BUILD.md](https://github.com/noldova-com/desktop/blob/main/documents/BUILD.md#an-apps-inputs) says, and lists the modules `desktop.modules` names, this repository's `@noldova/teamrun` among them, as modules from packages, as Noldova Desktop's [MODULES.md](https://github.com/noldova-com/desktop/blob/main/documents/MODULES.md#modules-from-packages) says.
The terminal's view joins the bottom dock after Activity when the person opens a terminal.
It installs Noldova Desktop's packages, the other modules and `@noldova/desktop.build` at exact versions from the registry, and TeamRun's packages from the checkout's build at the version it pins, and `@noldova/desktop.build` builds and starts it from those.
`src/noldova.teamrun.window.app/` is the window app, the npm workspace `package.json` names: its entry, `src/main.ts`, starts the window with what the build generates in `_build/generated/`.
It also gives the window the kit's code highlighting worker, from `src/code-highlighting.worker.ts`, which the window app's `tsconfig.app.json` lists beside the entry so the build bundles it.
`tsconfig-base.json` holds the strict TypeScript options the window app's `tsconfig.json` extends; `@noldova/desktop.build` also hashes it, with `package.json` and `package-lock.json`, which `npm run lock:app` writes, into its build inputs, and fails when one is missing.
`assets/icons` holds the app's icons, which `desktop.product.icons` names, and `assets/dictionaries` the spelling dictionaries Electron's spell checker reads: the en-US Hunspell dictionary from SCOWL, under the terms in `en-US-SCOWL.txt` and `HUNSPELL-DICTIONARIES-COPYING.txt` beside it, as the root [README](../README.md#license) says.

## Starting it in development

The app takes TeamRun's packages from the checkout's build, never from a release, so it starts from the repository's root, after the build, as the root [README](../README.md#starting-the-app) says:

```bash
npm start
```

That installs the app with `npm run install:app`, which also runs `npm run install:window` here, and builds it with `npm run build` here.
`npm run install:window` installs the window app's workspace, `src/noldova.teamrun.window.app/`, and `npm run build` installs the module's packages into it, checks the modules' declarations, writes `_build/product.json` and the generated window sources, and builds the window into `_build/window`.
`npm start` then runs the app from that build on a copy of Electron's program that carries TeamRun's name, version and icon, in `_build/development-app`.
On a Linux system that restricts unprivileged user namespaces, it prints the commands Chromium's sandbox needs instead of starting, as Noldova Desktop's [README](https://github.com/noldova-com/desktop#starting-an-app-in-development) says.

## A chat at size

To try the app with a long history, write a synthetic chat of 10,000 messages into the development data folder, from the repository's root, after the build:

```bash
npm run seed:stress
```

That installs the app with `npm run install:app` and runs `npm run seed:stress` here, which runs `seed-stress.ts` with the arguments that follow `npm run seed:stress --`; `-- --pairs <count>` writes from 1 to 5,000 pairs instead of 5,000.
It writes into the development data folder only: `_build/data` here, or the absolute folder `TEAMRUN_DATA_DIR` names, and it refuses the installed app's data folder, `.noldova/teamrun` in the home folder.
It refuses while TeamRun is running on that folder, so quit the app first; then it takes the folder as Noldova Desktop's runtime does, migrates the module's database as the app does, and writes through TeamRun's own services, the projects, chats, messages and attachments services, never SQL of its own.
The chat goes into a project of its own, `modules/teamrun/stress-chat` in the data folder, which holds the source files and the four images its replies name; a rerun forgets that project and its chats and writes them again, and leaves every other project as it was.

Each pair is a person's message and its finished reply, two minutes apart, from 25 scenarios repeated in order: short and very tall replies, Markdown, code in several languages and with long lines, images (opaque, transparent, wide and 4K) as attachments and as files a reply wrote, file changes for Changes, steps for Worked for, a failed and a cancelled reply, mentions, Unicode and a showcase of them all.
Each person's message carries a unique token, `TURN-00001` to `TURN-05000`, to search for, and the first one says what the chat holds.
The content is synthetic: the images and files are generated, no provider, provider session or teammate is attached, and the mentioned names, @Atlas and @Nova, are not live teammates, so they show like a former teammate's.

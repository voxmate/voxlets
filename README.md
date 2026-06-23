# voxlets

Example [Voxmate](https://voxmate.com) voxlets — audio-first apps for blind users — that the Voxmate
platform builds and hosts **by github ident**.

A voxlet is a single-bundle JS app (`main.js` built from TypeScript) that runs inside the Voxmate engine.
The platform's build pipeline fetches this repo, runs `npm install` + esbuild, and serves the artifact. No
local toolchain needed to ship one — push to GitHub, reference it by ident.

## Idents

The platform addresses a voxlet in this repo as:

```
github.com/gleno/voxlets/mathdoku
```

`…/<folder>` selects the voxlet; an optional `@<ref>` pins a tag/branch/SHA
(`github.com/gleno/voxlets/mathdoku@v1`). A different ref is simply a different voxlet — it builds once and
is stored under its own key.

## Layout

```
voxlets/
  package.json     runtime deps for every voxlet here (resolved during build)
  common/          the voxmate/* library, vendored — what voxlets import
  mathdoku/        a voxlet: an arithmetic/logic puzzle, Sudoku-like
    main.ts        entry — the engine resolves exported entry fns from the bundle
    voxlet.json    manifest (name, description, settings schema)
    activities/    ORC activities (speech + input loops)
    assets/        bundled media (sha-addressed at build time)
```

Each voxlet imports the shared library as `voxmate/*`; at build time that alias resolves to `common/`.
Runtime npm dependencies (e.g. `kengen`, `dayjs`) are declared in the root `package.json` so the build
container can `npm install` them once for the whole repo.

> `common/` is a vendored snapshot of the engine's shared library. One import in `common/orc/RollActivity.ts`
> was repointed to `common/utility/time.ts` so the library is self-contained (upstream reaches into a
> sibling voxlet for it).

## Building locally

The platform builds this in a container, but the same build runs locally with the Voxmate builder:

```bash
npm install
node <voxmate>/platform/builder/src/cli.ts ./mathdoku --common=./common --out=./mathdoku
```

Output is `main.js` + `main.js.map` (an IIFE bundle, names preserved) — the artifact the engine loads.

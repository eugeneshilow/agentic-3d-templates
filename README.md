# Agentic 3D Templates

Two interactive 3D scenes in three.js, each packaged as a standalone Next.js
template. Built by OpenAI Codex (GPT-6 Astra) from a prompt, ported to
Next.js by Claude.

| template                                                        | live demo                                              | 21st.dev component                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [V8 Engine — Interactive 3D](v8-engine-3d/)                     | [open the demo](https://v8-engine-3d.vercel.app)       | [@eugeneshilow/v8-engine-3d](https://21st.dev/@eugeneshilow/components/v8-engine-3d)             |
| [Agentic Factory — Interactive 3D Machine](agentic-factory-3d/) | [open the demo](https://agentic-factory-3d.vercel.app) | [@eugeneshilow/agentic-factory-3d](https://21st.dev/@eugeneshilow/components/agentic-factory-3d) |

## V8 Engine — Interactive 3D

![V8 Engine — Interactive 3D](v8-engine-3d/public/preview.png)

A fully procedural V8: pistons, rods, a cross-plane crankshaft, camshafts,
valves with springs on their real timing, a flywheel and a timing belt.
Assembled, cutaway, exploded and single-cylinder views, five cameras, an rpm
slider, a live firing order and live pressure and valve-timing charts.

## Agentic Factory — Interactive 3D Machine

![Agentic Factory — Interactive 3D Machine](agentic-factory-3d/public/preview.png)

A short-video factory that AI agents build, as one machine: order → script →
video → post → payment. Four modes, five cameras, hover and click stations,
and an embed mode (`?embed=1`) with a `postMessage` API for a landing-page
hero.

## Use a template

Each folder is its own project: Next.js 16, React 19, TypeScript, three.js.
No backend, no environment variables.

```bash
cd v8-engine-3d        # or agentic-factory-3d
pnpm i
pnpm dev               # http://localhost:3000
```

Every template README covers the controls, the file layout, where to change
things, and how it was made, with the original prompt.

## Or add a scene as a React component

Both scenes are also published on 21st.dev as one-file React components, in
the [agentic 3d](https://21st.dev/@eugeneshilow/library/agentic-3d) library:

```bash
npx @21st-dev/cli add @eugeneshilow/v8-engine-3d
npx @21st-dev/cli add @eugeneshilow/agentic-factory-3d
```

Each component is a default export that fills its box (`height`, default
`100vh`) and needs only `react` and `three`. The factory also takes `embed`
(the clean hero), `onStation` and `onReady`.

Made with AI agents · [vibecoding.tech](https://vibecoding.tech)

## License

Licensed for use in your own projects, personal or commercial, including
sites you build for clients. Redistributing or reselling the templates
themselves, as templates or starters, is not permitted.

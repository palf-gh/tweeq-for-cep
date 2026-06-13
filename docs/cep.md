# Tweeq for CEP

A fork of [baku89/tweeq](https://github.com/baku89/tweeq) for **Adobe CEP** panels (Chromium Embedded Framework inside After Effects, Premiere Pro, etc.).

Upstream Tweeq targets modern browsers. CEP ships an older Chromium build where several APIs behave differently or are missing. This fork includes compatibility fixes for that environment.

## What differs from upstream

| Area | Change |
|---|---|
| **Colour canvas** | Canvas 2D instead of WebGL/regl (CEF WebGL is unreliable) |
| **`useDrag`** | CEP mode (default when `window.cep` / `__adobe_cep__` is present): absolute pointer tracking, window-level move/up listeners, no pointer lock, tolerant `setPointerCapture` |
| **Popover** | Falls back to `display: none` when Popover API is broken |
| **InputNumber scrub overlay** | JS `scrubScaleStyle()` instead of CSS `pow()` / `color-mix()` |
| **InputColorPad** | `transform: rotate()` instead of CSS `rotate` property; defensive clipboard |
| **InputColorChannelSlider** | Optional `vertical` prop for hue sliders |
| **`useCopyPaste`** | try/catch around clipboard operations |

Pass `cep: false` to `useDrag` to restore browser behaviour when developing docs locally.

## Install

```json
"tweeq": "https://github.com/palf-gh/tweeq-for-cep.git#<commit>"
```

Pin a commit hash in production. If the repo is private, configure CI credentials for `git ls-remote`.

## Upstream

MIT-licensed original by [Baku Hashimoto](https://github.com/baku89). Cite the [UIST 2025 paper](https://doi.org/10.1145/3746059.3747723) when referencing Tweeq academically.

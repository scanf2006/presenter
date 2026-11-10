# 0.3.228

- Version: 0.3.228
- Build date: 2026-11-09
- Installer: `churchdisplay-pro_0.3.228_x64-setup.exe` (zh-CN, x64 NSIS)

## This is a diagnostic build, not a release

It paints the text-fitting measurements in the top-left corner of the projector
output. **Do not use it for a service.** The next version removes the overlay.

Reported after 0.3.227: a long passage at a large font is still projected
**completely unscaled** and clipped at both ends.

Static review has been exhausted. Confirmed by reading the code: the component
does handle Bible content (`isTextualSlideType` includes `bible`), all three
measurement refs are attached, the transform expression is correct, and no CSS
rule overrides it. Confirmed by measuring a faithful copy of the DOM in a real
browser engine: the arithmetic is right, and a 5472px block fitted into a 1031px
band at scale 0.188.

So the fault is in a value the running projector window produces, and no test
here can see it: jsdom performs no layout, so `scrollHeight` and `clientHeight`
are always zero in the test environment. That is precisely why this bug has now
survived three attempts. Rather than guess a fourth time, this build reports the
figures it actually measured.

## What to do with it

Project a long passage at a large font, then read the green box:

| Line | Meaning |
| --- | --- |
| `type` | the slide type that reached the fitting code |
| `box` | the container's measured height |
| `padding` | top plus bottom padding subtracted from it |
| `reserved` | height reserved for the reference line |
| `available` | what the text was allowed to use |
| `content` | the text's measured natural height |
| `measured` | whether the container had a layout |
| `SCALE` | the scale that was applied |

`SCALE 1` with `content` larger than `available` would mean the arithmetic is
not being reached. `measured false` would mean the container never gets a
layout. `content` far too small would mean the text is being measured on the
wrong element. Each points somewhere different.

## Validation Evidence

- `npm test`: 133 pass · `npm run lint`: clean · `npm run build`: succeeds
- The overlay is the only behavior change; the fitting logic is untouched since
  0.3.227.

## Rollback

- Previous version: 0.3.227
- Set `SHOW_FIT_DIAGNOSTIC` to false in
  `src/components/projector/ProjectorTextLayer.jsx`, or revert this commit.

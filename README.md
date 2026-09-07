# personal-website

My site, resume and portfolio. Plain HTML and CSS, no build step, no framework.

**Live:** [personal-website-miramsalp.vercel.app](https://personal-website-miramsalp.vercel.app)

## What's here

Three documents that share one stylesheet's worth of design decisions — neutral palette, one
typeface, thin rules — so the site and the PDFs a reader receives look like the same person made
them.

| | |
|---|---|
| `index.html` | The site: experience, selected work, and the smaller things. |
| `resume.html` | One-page resume. Print styles are tuned so it lands on a single A4 page. |
| `portfolio.html` | Six-page portfolio. Each `.page` is a fixed A4 sheet. |

Both PDFs in the repo root are generated from those two HTML files — the HTML is the source, the
PDF is the artifact.

```
├── index.html          site
├── resume.html         → Thanapat_Aupprathumwipanon_Resume.pdf
├── portfolio.html      → Thanapat_Aupprathumwipanon_Portfolio.pdf
├── style.css           site styles (the documents carry their own print CSS)
├── assets/             screenshots
└── scripts/
    └── export-pdf.mjs  HTML → PDF
```

## Rebuilding the PDFs

```bash
node scripts/export-pdf.mjs                                                  # resume
node scripts/export-pdf.mjs portfolio.html Thanapat_..._Portfolio.pdf        # portfolio
```

No dependencies and no `npm install`. The script launches whatever Chrome or Edge is already on
the machine in headless mode, drives it over the DevTools Protocol, and calls `Page.printToPDF`
with `preferCSSPageSize` — so the `@page` rules in the HTML decide the paper size, and the output
stays text-selectable rather than becoming an image. It prints the resulting page count, and warns
when the resume stops fitting on one page.

Set `CHROME_PATH` if the browser lives somewhere unusual.

## A note on the layout constraints

Both documents are size-constrained in a way that does not announce itself:

- The resume sits at about 96% of one A4 page. Adding a bullet can silently push it to two.
- Each portfolio `.page` is a fixed 297mm with `overflow: hidden`, so content that outgrows a page
  is clipped rather than reflowed onto the next one.

Line breaks in the source say nothing about how many lines actually render, so changes here are
worth measuring — load the file under Chrome's print emulation and compare each page's
`scrollHeight` against its `clientHeight` — rather than eyeballing.

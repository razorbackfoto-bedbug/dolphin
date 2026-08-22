# Dolphin site bug audit

## Fixed on `bugfix/site-audit`

- Removed the duplicate Jekyll GitHub Pages workflow. The repository already has a static-site deployment workflow, so the generic Jekyll workflow was redundant and could conflict with deployment.

## Still under review

- The current `index.html` begins with the `<title>` element rather than a complete HTML document structure. This needs to be repaired carefully after reviewing the complete file so the existing page markup is not accidentally damaged.
- Responsive/mobile behavior should be checked after the document structure is corrected.
- Booking controls and JavaScript behavior need a functional audit.
- Navigation targets and external links need verification.

This file is temporary audit documentation and can be removed before merging if desired.

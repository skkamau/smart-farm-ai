# Design QA

Reference:
- `work/reference/figma-dashboard.png`
- `work/reference/figma-login-stable.png`

Prototype:
- `work/qa/local-dashboard-viewport.png`
- `work/qa/local-login.png`

Viewport:
- 390 x 844 mobile

Findings:
- P0: None.
- P1: None.
- P2: None.
- P3: Reference uses emoji-style visual badges in some cards while the app uses Lucide icon badges for consistency and accessibility.
- P3: Reference copy/data differs from the real app because the app renders stored MongoDB records.

Checks:
- Mobile dashboard begins with the greeting and alert card like the reference.
- Farm overview uses a two-column rounded card grid with soft off-white surfaces.
- Bottom navigation matches the reference structure: Home, Animals, QR Scan, Crops, More.
- Quick actions, AI recommendations, activity, and finance summary are present and functional.
- Login screen uses the photo header, glass logo tile, rounded sheet, pill inputs, and green gradient action.

Final result: passed.

# Homepage integration (local merge resolution)

The integration combines `origin/main` at `c1b4aed` with
`origin/feature/homepage` at `b296a6b` on `feature/homepage-integration`.
Neither source branch is modified. The merge is intentionally left uncommitted.

## Navigation and preserved features

`App.tsx` retains main's hash-based feature routes: `#profile`, `#matches`, and
`#planner`. Matching still requires a completed Housing Profile envelope and all
six section validations. RootSpace remains lazy-loaded. Home and section anchors
(`#home`, `#top`, `#browse`, `#community`, `#how-it-works`, `#share-space`, `#safety`)
render the authored landing page and scroll to the appropriate section. Browser
back/forward works through hashchange. The profile-to-matching continuation stays.

Browse Rooms and Community remain explicitly labeled fictional previews. No live
listings, forum, posting, or new backend functionality has been introduced.
Matching, profile, and planner cards link to the existing working features.
The original feature folders, package manifests, server, and lockfiles are unchanged.

`Homepage.tsx` preserves the incoming homepage sections and interactive preference
and community examples. `SiteNavigation.tsx` retains its branding and navigation
appearance while adding the real RootSpace route and current-page indicators.

## Layout and hover root cause

The incoming `.card-art img` used absolute positioning without a positioned
`.card-art` parent. The images could attach to the viewport and cover unrelated
content. A hovered card's transform created a new containing block, making the
image jump between the viewport and the card. Fixed card containers now establish
positioning consistently, with a 16:10 aspect ratio and local decorative clipping.
The modest card hover effect remains inside this stable container.

The hero additionally had contradictory grid/flex overrides, several minimum
heights and aspect ratios, `!important` containment rules, and final rules hiding
all hero artwork. The incoming JSX omitted the hero image. These obsolete rules
were removed. The existing `roomroot-interior.svg` is restored inside one figure
with a 960×760 viewBox, intrinsic dimensions, width:100%, and height:auto.
The hero is a two-column grid on desktop and stacks below 900px. It has no hover
transform, animation, or independent furniture layers. All geometry scales together.

Homepage typography, variables, buttons, and illustrations are scoped to
`.rr-homepage`; no homepage heading styles reach the other feature roots.
`index.css` keeps main's neutral baseline. `App.css` contains shared shell styles
only. Navigation wraps without hiding links and becomes non-sticky on small screens
so zoomed content is not covered. Reduced-motion disables homepage transitions and
animations. Headlines can wrap at extreme effective viewport widths.

The unrelated `Microsoft/Windows/PowerShell/ModuleAnalysisCache` is excluded from
the merge result. All legitimate incoming SVG assets are retained.

## Preview and verification

Run `npm run dev` from `website/`, then open the URL Vite prints (currently
`http://127.0.0.1:5175/` for the existing workspace server). Other preview servers
running archived branches do not show these edits.

Checks: `npx --no-install tsc -b`, `npm run lint`, `npm run build`, and the existing
RootSpace standalone build. Run the existing Housing Profile data/browser suites,
Matching adapter/discovery tests, RootSpace suites, and server matching/provider
unit tests. With Node 24, Matching's existing TypeScript tests run directly with
`node --test src/features/roommate-matching/tests/*.test.ts` if the optional local
`tsx` binary is absent; no installation is needed.

The new browser review uses an isolated Chrome debugging profile:

`CHROME_URL=http://127.0.0.1:9224 VITE_URL=http://127.0.0.1:5175 node website/tests/homepage-integration.mjs`

It covers all five widths (1440, 1024, 768, 390, 320) crossed with zoom-layout
conditions 50%, 75%, 100%, 125%, and 150%. CDP adjusts CSS viewport width/height and
pixel ratio together, reproducing browser zoom layout conditions; it does not test
the browser chrome's zoom UI. It checks proportional SVG sizing, sample-image
containing blocks, hover bounds, document overflow, wrapped navigation, reduced
motion, profile validation gates, community topics, Matching Save/Like and AI
failure handling, and integrated RootSpace 2D/3D/style isolation. Screenshots go to
`/tmp/roomroot-homepage-review`, outside the repository.

Matching HTTP requests are intercepted in the isolated browser: deterministic
responses use the actual server scoring engine, while AI returns a deliberate
unavailable response. This verifies UI integration without provider keys or paid
requests. It is not a live AI or deployed-backend connectivity test. Express is not
installed in this checkout; no dependencies are installed by this integration task.

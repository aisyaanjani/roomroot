# RootSpace · Stages 1–4

The feature is isolated to this folder. No shared application entry points change.

## Standalone preview

From `website/`, run `npm run dev`, then open
`http://localhost:5173/src/features/room-planner/preview.html`.
Use the port Vite prints if 5173 is busy.

Build the standalone entry (the normal build only bundles the shared app):

`npx --no-install vite build --config src/features/room-planner/vite.preview.config.ts`

Output: `website/dist/rootspace/`. Serve from `website/` with
`npx --no-install vite preview --outDir dist/rootspace`, then open
`/src/features/room-planner/preview.html` on the printed URL.

Future integration: import `RoomPlanner` from this folder's `index.ts`.
Its CSS is scoped under `.rootspace`. The 3D tab lazy-loads the interactive viewer.

## Shared model

All dimensions and positions are feet. Room origin: northwest floor corner;
+x east, +z south, +y up. Furniture x/z represents the footprint center and y
is floor elevation (0). Width follows local x; depth follows local z; height
is vertical. Clockwise plan rotation is degrees: 0/90/180/270.
A Three.js renderer can use these positions and dimensions directly, setting
`rotation.y = -rotation * Math.PI / 180`. Centered box geometry is rendered
at y + height/2. The saved model needs no conversion.

Rotation preserves furniture dimensions; rotations that cannot fit are refused
with a notice. Shrinking rooms clamps positions and reduces oversized dimensions
with a notice. Catalog footprints are realistic starting sizes, not manufacturer
specifications. Furniture overlap is allowed.

## Controls and saving

Click library items to add. Select on canvas or via the piece list. Drag to move;
property controls commit dimensions on blur or Enter, with inline validation.
Wheel zooms around the pointer. Toolbar zoom centers on the viewport. Pan mode
supports mouse and one-finger touch dragging. Fit room restores a centered view.

Layouts save after a 100 ms quiet period under `roomroot:rootspace:layout:v1`.
Malformed/unsupported layouts and duplicate IDs are rejected gracefully; positions
are normalized into bounds. Storage failures display a status without preventing
editing. Reset requires native confirmation. Selection and viewport are transient.
Data is stored only in this browser and origin.

## Verification

From `website/`:

- `npx --no-install tsc -b`
- `npm run lint`
- `npm run build`
- The standalone build command above
- `node src/features/room-planner/tests/model-review.mjs` (Node 24)

For browser tests, start Vite and an isolated Chrome instance with
`--headless=new --remote-debugging-port=9223 --user-data-dir=/tmp/rootspace-browser-review`.
Then run (adjust the Vite port):

`VITE_URL=http://127.0.0.1:5173 node src/features/room-planner/tests/browser-review.mjs`

Tests reset feature storage in that isolated profile. They cover all catalog items,
canvas selection/drag/bounds, dragging after zoom/pan, rotation, sizing, color,
duplicate/delete, saved restoration, dimension limits, malformed data, confirmed
and cancelled reset, mobile overflow, and uncaught runtime errors.

## Stage boundary

No custom wall drawing, automatic collision avoidance, or cloud storage.
The standalone build produces a >500 kB chunk-size warning for React/Konva and Three.js;
this does not fail the build.


## Stage 2 viewer

`RoomViewer3D.tsx` renders the same layout prop; there is no second layout state
and keeps the original schema fields. Stage 3 adds optional fields. `Furniture3D.tsx` provides memoized normalized geometry for all
ten catalog types, scaled with saved width/height/depth and rotated as documented.
Selection remains in RoomPlanner, so the same property controls edit both views.
Beds have mattresses/pillows; tables and desks have legs; the chair has a back,
base, and arms; sofas have cushions and arms; storage has drawers or shelves.

The floor has procedural neutral wood planks (no textures or remote assets).
Walls are 8 ft tall; the two camera-facing walls disappear as the camera orbits.
Hemisphere and directional lights provide warm illumination and shadow mapping.
OrbitControls supports drag orbit, scroll/pinch zoom, right-drag/two-finger pan.
Camera distance, pan target, and polar angle are constrained; Reset Camera fits
room bounds plus furniture height with aspect-aware framing. Room/viewport size
changes refit the camera. Switching into 3D starts with a fitted camera.

The viewer renders on demand with capped pixel ratio; OrbitControls damping
requests frames only while moving. Fiber disposes declarative resources when
unmounted. Loading and WebGL/context-loss fallbacks leave the 2D editor and data
available. Selection outlines can overlap when pieces occupy the same place.

Run the browser suites sequentially (not concurrently: they use
the same origin's localStorage):

`VITE_URL=http://127.0.0.1:5173 node src/features/room-planner/tests/viewer-review.mjs`

For a headless GPU-less environment, launch isolated Chrome with
`--enable-unsafe-swiftshader --use-angle=swiftshader` as test-only flags.
`CHROME_URL` can override the debugging endpoint (default localhost:9223).
`SCREENSHOT_PATH` optionally saves a desktop screenshot. The suite inspects actual
Fiber scene transforms/materials, clicks projected furniture on the canvas,
edits properties, checks view switching, orbits/zooms/pans/resets, loads all ten
models, restores saved data, resizes to mobile, and simulates context loss.


## Stage 3: moving, openings, finishes, and history

`useFurnitureDrag.ts` raycasts against the horizontal y=0 floor plane and preserves
the pointer grab offset. Left mouse or one-finger dragging selects and moves a
piece. `fitFurniture` clamps the rotated footprint; size, rotation, and y remain
unchanged. OrbitControls is disabled while captured and restored on release,
cancellation, lost capture, window blur, or component unmount. Drag on empty space
to orbit. Two fingers/right mouse remain camera gestures. Simultaneous multi-touch
furniture manipulation is not supported.

`collisions` checks exact rotated footprints for the model's quarter-turn rotations.
Touching edges do not count as collisions. Amber outlines and a shared warning
identify overlaps in either view, including during dragging. No collision response
moves furniture automatically. These warnings cover furniture footprints, not
door swing clearances, accessibility clearances, or full 3D object intersections.

`RoomOptions.tsx` provides collapsible finishes and opening controls. North is the
top edge of the 2D plan. Each opening stores id, door/window type, wall, start
position, width, height, and sill (all feet). N/S positions run west to east; E/W
positions run north to south. Defaults: a 3×7 ft door at floor level, or a 3×4 ft
window with a 3 ft sill. Up to 100 openings are supported. Openings must fit in
an 8 ft wall and cannot share an overlapping horizontal wall interval (even when
at different heights). Add, edit, and delete are supported. Resizing a room that
would cut off an opening is refused with a notice; openings are never relocated.
`Architecture3D.tsx` builds actual wall segments around the openings, with closed
door panels and framed glass windows. Cutaway walls and their openings disappear
on the near side as the camera orbits. Both are always shown in the 2D plan.

Optional `openings` and `appearance` fields extend the existing version-1 Layout.
Absent values mean no openings and the original default finishes. The storage key
and original furniture schema are unchanged. `parseLayout` validates both legacy
and extended saves. Appearance includes wallColor, floorColor, and floorMaterial
(wood/tile/plain). Both renderers use these values without external assets.

`history.ts` holds at most 60 immutable layout snapshots. All changes, including
opening edits, room dimensions, reset, and finishes, are undoable. A drag transaction
records the start and final positions as one step; selection clicks and no-op
updates add no entries. Toolbar buttons and Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z work in
both views. Text/numeric/select controls retain their native editing shortcuts.
History is session-only and is not saved across refresh; the current layout is.
New edits after undo discard the redo branch.

Additional verification (from `website/`):

- `node src/features/room-planner/tests/stage3-model-review.mjs`
- `CHROME_URL=http://127.0.0.1:9224 VITE_URL=http://127.0.0.1:5175 node src/features/room-planner/tests/stage3-browser-review.mjs`

The model suite checks rotated overlaps/touching boundaries, invalid placements,
old/new storage, malformed options, protected resizing, bounded history, and drag
transactions. The browser suite checks live architecture colors/materials,
opening add/edit/validation, keyboard undo/redo, mouse dragging from two camera
quadrants, wall clamping, camera locking/release/cancellation, one-step drag undo,
view switching, saved restoration, mobile layout, and touch dragging. The existing
Stage 2 camera test now orbits from empty space, because furniture now captures
left-button dragging by design. All tests use an isolated browser profile.


## Stage 4: visual polish and practical measurements

`cameraFit.ts` replaces the bounding sphere with perspective constraints for all
room-envelope corners, including a 0.25 ft margin for walls and trim. It fits the
horizontal and vertical frusta, centers the projected bounds, and keeps the camera
target inside the room. The camera reserves 12% horizontal and 18% vertical margin
for controls. Reset, room/height changes, and viewport changes share this fit.
The data model and storage key do not change.

Furniture has layered mattresses and bedding, tonal sofa cushions, five chair
spokes/casters and arms, recessed storage fronts/handles, aprons and drawer detail,
and varied books on visible shelves. Detail geometry stays inside the stored unit
box before feet-based scaling. The ten-model test scene uses about 1,930 triangles;
these are stylized procedural models, not downloaded photorealistic assets.
Geometry JSX is memoized by type/color so dragging only changes transforms.
Selection outlines use explicit box edges instead of triangular wireframes, and
translucent floor highlighting keeps the selected footprint readable.

`finishes.ts` defines six named wall colors and six floor colors, alongside the
existing unrestricted color pickers. Swatches and material preview buttons are
keyboard-accessible and report pressed state; the native material selector remains
available. Wood uses alternating plank tones and a small procedural grain texture;
tile uses a repeating grout/speckle texture at a 2 ft spacing; solid has a matte,
untextured surface. `surfaceTexture.ts` creates local 64×64 RGBA maps (16 KiB raw)
and releases GPU resources on replacement/unmount. No network assets or keys.
`Architecture3D` is memoized using room, openings, and appearance props so furniture
movement does not rerender the architecture.

`SelectionMeasurements.tsx` shows width/depth/height plus perpendicular clearance to
all four walls. `measurements.ts` derives these from the rotated footprint without
changing saved data. Clearances do not account for other furniture or door swings.
`PlanMeasurements.tsx` adds screen-sized selected-footprint dimensions in 2D; the
workspace footer shows actual furniture dimensions in both views. Room dimensions
and area stay visible in the workspace header. Labels round to 0.01 ft; stored
measurements retain full precision.

Panel spacing, contrast, focus states, hover states, touch targets, empty states,
and control tooltips have been refined. Small screens retain stacked panels with
larger action targets. Reduced-motion preferences disable decorative transitions.

### Bundle investigation

`konva.ts` uses ReactKonvaCore and explicitly registers Rect, Line, Text, and Circle.
Unused shapes, filters, and Transformer are excluded. Register new shapes here if
future code needs them. The 2D entry shrank from roughly 576 kB at Stage 3 to
514 kB minified (about 159 kB gzip), despite the additional polish. OrbitControls
uses Drei's focused entry; the 3D viewer remains a lazy-loaded chunk, roughly
940 kB minified / 250 kB gzip. The module graph fell from 645 to about 362 modules.

Inspect contributors with:

`ROOTSPACE_ANALYZE=1 npx --no-install vite build --config src/features/room-planner/vite.preview.config.ts`

The optional report prints the largest modules and does not create extra artifacts.
React DOM/reconciler and Konva dominate 2D; Three's renderer/core and Fiber dominate
3D. Reported per-module rendered sizes are before minification, not transfer sizes.
Chunk-size warnings remain visible. Safe future opportunities include lazy-loading
the entire planner when integrating the shared app, long-lived caching for vendor
chunks, and gzip/Brotli delivery at hosting. Vendor chunk splitting can improve
cache reuse but does not reduce total download size. A custom minimal Fiber root
could reduce Three's registered constructors but would require separate rendering
regression work; it is not part of this polish milestone.

### Additional verification

Run every earlier suite plus:

- `node src/features/room-planner/tests/stage4-model-review.mjs`
- `CHROME_URL=http://127.0.0.1:9224 VITE_URL=http://127.0.0.1:5175 node src/features/room-planner/tests/stage4-browser-review.mjs`

The math suite projects every envelope corner for 72 combinations of room sizes,
heights, and viewport aspects, verifies fitted occupancy, and checks clearances and
texture size. Browser tests check actual cameras at 5×5, 5×40, 40×5, 40×40, and
12×14 ft; keyboard swatches; preset undo/redo; all ten furniture bounds and triangle
budget; all three finishes; dimensions; save restoration; and mobile framing.
Existing browser tests inspect the same versioned Fiber module URL as the app,
so Vite dependency optimization does not create a second diagnostic root store.

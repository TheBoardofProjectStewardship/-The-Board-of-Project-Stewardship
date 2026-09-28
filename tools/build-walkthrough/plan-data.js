/**
 * Original illustrative two-storey plan for the Board of Project Stewardship
 * Build Walkthrough. Coordinates are meters. +x east, +z north.
 * This is an educational diagram, not a survey or permit set.
 */

export const PLAN_W = 16.4;
export const PLAN_D = 10.4;
export const MAIN_W = 10.8;
export const GH = 2.7;
export const FH = 2.5;

export const GROUND_ROOMS = [
  { id: "entry", name: "ENTRY", x: 0, z: 0, w: 3.6, d: 3.2, pad: "default", label: [1.8, 1.55] },
  { id: "powder", name: "POWDER", x: 3.6, z: 0, w: 2.6, d: 3.2, pad: "wet", label: [4.9, 1.7] },
  { id: "stair", name: "STAIR", x: 6.2, z: 0, w: 2.2, d: 6.8, pad: "stair", label: [7.3, 3.3] },
  { id: "laundry", name: "LAUNDRY", x: 8.4, z: 0, w: 2.4, d: 6.8, pad: "wet", label: [9.6, 3.5] },
  { id: "pantry", name: "PANTRY", x: 0, z: 3.2, w: 2.4, d: 3.6, pad: "default", label: [1.2, 5.0] },
  { id: "kitchenA", name: "KITCHEN", x: 2.4, z: 3.2, w: 3.8, d: 3.6, pad: "kitchen", label: false },
  { id: "kitchenB", name: "KITCHEN", x: 0, z: 6.8, w: 6.2, d: 3.6, pad: "kitchen", label: [3.4, 8.15] },
  { id: "family", name: "FAMILY / DINING", x: 6.2, z: 6.8, w: 4.6, d: 3.6, pad: "default", label: [8.55, 8.7] },
  { id: "garage", name: "GARAGE", x: 10.8, z: 0, w: 5.6, d: 6.8, pad: "garage", label: [13.6, 3.3] },
  { id: "patio", name: "PATIO", x: 10.8, z: 6.8, w: 5.6, d: 3.6, pad: "patio", outdoor: true, omit: ["e"], label: [13.7, 8.6] },
];

export const FIRST_ROOMS = [
  { id: "hall", name: "HALL", x: 0, z: 0, w: 6.2, d: 3.4, pad: "default", label: [3.0, 1.6] },
  { id: "stair2", name: "STAIR", x: 6.2, z: 0, w: 2.2, d: 6.8, pad: "stair", label: [7.3, 2.4] },
  { id: "nook", name: "NOOK", x: 8.4, z: 0, w: 2.4, d: 3.4, pad: "wet", label: [9.6, 1.7] },
  { id: "bed3", name: "BEDROOM", x: 0, z: 3.4, w: 3.6, d: 3.4, pad: "default", label: [1.8, 5.15] },
  { id: "bath", name: "BATH", x: 3.6, z: 3.4, w: 2.6, d: 3.4, pad: "wet", label: [4.9, 4.5] },
  { id: "bed2", name: "BEDROOM", x: 8.4, z: 3.4, w: 2.4, d: 3.4, pad: "default", label: [9.6, 5.15] },
  { id: "primary", name: "PRIMARY", x: 0, z: 6.8, w: 10.8, d: 3.6, pad: "default", label: [3.3, 8.7] },
];

/** Openings. c is the center along the wall axis. side +1 swings toward +axis normal. */
export const OPENINGS = [
  { floor: 0, axis: "h", fixed: 0, c: 1.75, w: 0.96, kind: "door", hinge: "lo", side: 1 },
  { floor: 0, axis: "h", fixed: 0, c: 4.9, w: 1.05, kind: "window" },
  { floor: 0, axis: "h", fixed: 0, c: 9.6, w: 1.15, kind: "window" },
  { floor: 0, axis: "h", fixed: 0, c: 13.6, w: 4.4, kind: "garage" },
  { floor: 0, axis: "v", fixed: 3.6, c: 1.55, w: 0.82, kind: "door", hinge: "lo", side: 1 },
  { floor: 0, axis: "h", fixed: 3.2, c: 3.05, w: 0.9, kind: "door", hinge: "lo", side: 1 },
  { floor: 0, axis: "v", fixed: 2.4, c: 4.9, w: 0.78, kind: "door", hinge: "lo", side: 1 },
  { floor: 0, axis: "h", fixed: 6.8, c: 4.3, w: 3.8, kind: "void" },
  { floor: 0, axis: "h", fixed: 6.8, c: 7.3, w: 1.55, kind: "cased" },
  { floor: 0, axis: "h", fixed: 6.8, c: 9.6, w: 0.82, kind: "door", hinge: "hi", side: 1 },
  { floor: 0, axis: "v", fixed: 6.2, c: 8.55, w: 1.9, kind: "cased" },
  { floor: 0, axis: "v", fixed: 0, c: 8.55, w: 1.7, kind: "window" },
  { floor: 0, axis: "h", fixed: 10.4, c: 2.35, w: 1.7, kind: "window" },
  { floor: 0, axis: "h", fixed: 10.4, c: 8.5, w: 1.55, kind: "window" },
  { floor: 0, axis: "v", fixed: 10.8, c: 1.7, w: 0.9, kind: "door", hinge: "lo", side: 1 },
  { floor: 0, axis: "v", fixed: 10.8, c: 8.55, w: 1.85, kind: "slider" },
  { floor: 0, axis: "v", fixed: 16.4, c: 3.3, w: 1.2, kind: "window" },

  { floor: 1, axis: "h", fixed: 0, c: 2.3, w: 1.45, kind: "window" },
  { floor: 1, axis: "h", fixed: 0, c: 9.6, w: 1.05, kind: "window" },
  { floor: 1, axis: "h", fixed: 3.4, c: 1.55, w: 0.82, kind: "door", hinge: "lo", side: 1 },
  { floor: 1, axis: "h", fixed: 3.4, c: 4.85, w: 0.76, kind: "door", hinge: "lo", side: 1 },
  { floor: 1, axis: "v", fixed: 8.4, c: 1.55, w: 0.76, kind: "door", hinge: "lo", side: 1 },
  { floor: 1, axis: "v", fixed: 8.4, c: 5.05, w: 0.8, kind: "door", hinge: "hi", side: 1 },
  { floor: 1, axis: "v", fixed: 0, c: 5.05, w: 1.35, kind: "window" },
  { floor: 1, axis: "v", fixed: 10.8, c: 5.05, w: 1.15, kind: "window" },
  { floor: 1, axis: "h", fixed: 6.8, c: 7.3, w: 1.6, kind: "cased" },
  { floor: 1, axis: "h", fixed: 10.4, c: 2.2, w: 1.6, kind: "window" },
  { floor: 1, axis: "h", fixed: 10.4, c: 8.15, w: 1.7, kind: "window" },
];

export const FURNITURE = [
  { floor: 0, type: "counter", x: 0.22, z: 9.62, w: 5.55, d: 0.62 },
  { floor: 0, type: "counter", x: 0.22, z: 7.05, w: 0.62, d: 2.5 },
  { floor: 0, type: "island", x: 2.45, z: 7.75, w: 2.05, d: 0.95 },
  { floor: 0, type: "sink", x: 2.55, z: 9.93 },
  { floor: 0, type: "range", x: 0.34, z: 7.85, w: 0.4, d: 0.7 },
  { floor: 0, type: "fridge", x: 0.22, z: 6.95, w: 0.7, d: 0.72 },
  { floor: 0, type: "shelf", x: 0.18, z: 3.45, w: 2.05, d: 0.32 },
  { floor: 0, type: "shelf", x: 0.18, z: 4.15, w: 2.05, d: 0.32 },
  { floor: 0, type: "shelf", x: 0.18, z: 4.85, w: 2.05, d: 0.32 },
  { floor: 0, type: "toilet", x: 4.35, z: 0.48 },
  { floor: 0, type: "sink", x: 5.55, z: 2.55 },
  { floor: 0, type: "appliance", x: 8.62, z: 0.28, w: 0.85, d: 0.7 },
  { floor: 0, type: "appliance", x: 9.55, z: 0.28, w: 0.85, d: 0.7 },
  { floor: 0, type: "table", x: 7.15, z: 8.05, w: 1.7, d: 0.95 },
  { floor: 0, type: "chair", x: 7.25, z: 7.62, w: 0.38, d: 0.38 },
  { floor: 0, type: "chair", x: 7.85, z: 7.62, w: 0.38, d: 0.38 },
  { floor: 0, type: "chair", x: 8.4, z: 7.62, w: 0.38, d: 0.38 },
  { floor: 0, type: "chair", x: 7.25, z: 9.05, w: 0.38, d: 0.38 },
  { floor: 0, type: "chair", x: 7.85, z: 9.05, w: 0.38, d: 0.38 },
  { floor: 0, type: "chair", x: 8.4, z: 9.05, w: 0.38, d: 0.38 },
  { floor: 0, type: "sofa", x: 9.35, z: 7.15, w: 1.15, d: 1.55 },
  { floor: 0, type: "table", x: 12.35, z: 8.05, w: 1.35, d: 0.8 },
  { floor: 0, type: "chair", x: 12.15, z: 7.65, w: 0.36, d: 0.36 },
  { floor: 0, type: "chair", x: 13.55, z: 7.65, w: 0.36, d: 0.36 },
  { floor: 0, type: "stair", x: 6.42, z: 0.35, w: 1.76, d: 6.15, step: 0.3 },

  { floor: 1, type: "stair", x: 6.42, z: 0.35, w: 1.76, d: 6.15, step: 0.3 },
  { floor: 1, type: "bed", x: 0.45, z: 4.15, w: 2.05, d: 1.55 },
  { floor: 1, type: "bed", x: 8.62, z: 4.2, w: 1.95, d: 1.45 },
  { floor: 1, type: "bed", x: 3.55, z: 7.45, w: 2.15, d: 1.7 },
  { floor: 1, type: "tub", x: 3.75, z: 5.85, w: 2.25, d: 0.8 },
  { floor: 1, type: "toilet", x: 4.15, z: 3.6 },
  { floor: 1, type: "sink", x: 5.55, z: 6.35 },
  { floor: 1, type: "vanity", x: 4.85, z: 6.15, w: 1.2, d: 0.48 },
  { floor: 1, type: "appliance", x: 8.62, z: 0.28, w: 0.85, d: 0.68 },
  { floor: 1, type: "appliance", x: 9.55, z: 0.28, w: 0.85, d: 0.68 },
];

export const STAGES = [
  {
    id: "discovery",
    short: "Discovery",
    status: "Discovery: flat plan and room names",
    blurb: "Before drawings: capture vision, budget reality, and site constraints.",
    focus: "Focus: project brief and one-house massing.",
    context: "Context: future work stays faint so the house remains recognizable.",
    checks: ["Vision and non-negotiables", "Budget reality check", "Site constraints noted", "Proposal readiness"],
  },
  {
    id: "plans",
    short: "Plans",
    status: "Plans: sheets side by side",
    blurb: "Layouts and elevations turn discovery into a shared spatial story.",
    focus: "Focus: footprint, attached garage, porch, ridge, and room intent.",
    context: "Context: foundation and framing are diagrammed, not approved documents.",
    checks: ["Floor plans reviewed", "Elevations coordinated", "Long-lead items flagged", "Educational sheets only"],
  },
  {
    id: "permits",
    short: "Permits",
    status: "Permits: sheet marked educational",
    blurb: "Verify permit pathways, licensing, access, and review responsibilities before work starts.",
    focus: "Focus: the approved scope boundary around the same house.",
    context: "Context: pale construction layers remain illustrative.",
    checks: ["Permit path confirmed", "License re-checked", "Access and right-of-way plan", "Review inboxes confirmed"],
  },
  {
    id: "site-prep",
    short: "Site prep",
    status: "Site prep: footprint on the lot",
    blurb: "Access, erosion controls, temporary utilities, and staging prepare the lot.",
    focus: "Focus: construction access and protected work zones.",
    context: "Context: the future foundation remains a faint alignment guide.",
    checks: ["Fencing and access", "Erosion controls", "Temporary utilities", "Plans available on site"],
  },
  {
    id: "foundation",
    short: "Foundation",
    status: "Foundation: slab in place",
    blurb: "Excavation, forms, concrete, waterproofing, and backfill establish the load path.",
    focus: "Focus: main slab, stem walls, garage slab, and porch piers.",
    context: "Context: underground plumbing is shown faintly for coordination.",
    checks: ["Layout and excavation", "Underground rough-ins", "Forms and concrete", "Waterproofing and backfill"],
  },
  {
    id: "framing",
    short: "Framing",
    status: "Framing: walls up, floors stacked",
    blurb: "Studs, joists, headers, rafters, and plates turn the footprint into a readable volume.",
    focus: "Focus: dense structural rhythm and opening locations.",
    context: "Context: the roof covering stays faint so the 8/12 form is legible.",
    checks: ["Walls plumb and braced", "Openings framed", "Joists and rafters set", "Shear and hold-down review"],
  },
  {
    id: "roofing",
    short: "Roofing",
    status: "Roofing: roof set as a lift-off piece",
    blurb: "Decking, underlayment, flashing, and roof covering complete dry-in from above.",
    focus: "Focus: main gable, attached garage gable, and porch roof.",
    context: "Context: wall sheathing stays faint beneath the roof work.",
    checks: ["Roof deck checked", "Underlayment installed", "Flashings detailed", "Dry-in confirmed"],
  },
  {
    id: "siding",
    short: "Siding",
    status: "Siding: windows and doors set",
    blurb: "Sheathing, weather barrier, openings, trim, and cladding close the exterior envelope.",
    focus: "Focus: a complete, recognizable exterior shell.",
    context: "Context: framing is removed from view so material edges read clearly.",
    checks: ["Sheathing and weather barrier", "Windows and doors", "Cladding and trim", "Weather protection complete"],
  },
  {
    id: "plumbing",
    short: "Plumbing",
    status: "Plumbing: supply and waste lines",
    blurb: "Water, waste, and vent paths coordinate through open framing before cavities close.",
    focus: "Focus: red, blue, and white plumbing paths rendered through the shell.",
    context: "Context: roof, framing, sheathing, and siding become a pale X-ray envelope.",
    checks: ["Water and waste rough-ins", "Vent routing", "Pressure and leak tests", "Rough inspection"],
  },
  {
    id: "electrical",
    short: "Electrical",
    status: "Electrical: branch circuit lines",
    blurb: "Panel, branch circuits, device boxes, and low-voltage paths rough into the open walls.",
    focus: "Focus: amber wiring paths and device boxes.",
    context: "Context: plumbing remains faint while the same envelope stays translucent.",
    checks: ["Panel and circuits", "Device and data boxes", "Electrical rough-in", "Cover sequencing"],
  },
  {
    id: "hvac",
    short: "HVAC",
    status: "HVAC: duct and equipment lines",
    blurb: "Ducts, equipment, returns, and fresh-air paths coordinate before insulation.",
    focus: "Focus: cyan mechanical trunks, branches, and equipment.",
    context: "Context: earlier rough-ins stay faint inside the translucent shell.",
    checks: ["Equipment and duct layout", "Supply and return paths", "Mechanical tests", "Rough inspection"],
  },
  {
    id: "insulation",
    short: "Insulation",
    status: "Insulation: cavity fill",
    blurb: "Cavity fill and envelope continuity follow completed rough inspections.",
    focus: "Focus: filled wall bays against readable framing.",
    context: "Context: exterior cladding stays faint so cavity work remains visible.",
    checks: ["Rough inspections passed", "Wall and roof cavities filled", "Air-control continuity", "Insulation inspection"],
  },
  {
    id: "drywall",
    short: "Drywall",
    status: "Drywall: rooms closed in",
    blurb: "Wallboard, finishing, primer, and paint turn the shell into rooms that can be walked.",
    focus: "Focus: interior wall planes, partitions, and ceilings.",
    context: "Context: insulation remains faint behind the finished surfaces.",
    checks: ["Board hung", "Tape and finish", "Primer and paint", "Testing pathway confirmed"],
  },
  {
    id: "cabinets",
    short: "Cabinets",
    status: "Cabinets: kitchen and bath millwork",
    blurb: "Cabinet boxes, millwork, counters, and alignment bring homeowner-visible craft forward.",
    focus: "Focus: kitchen wall run, island, and bath vanity.",
    context: "Context: finished flooring and fixtures remain faint until later stages.",
    checks: ["Layout re-checked", "Boxes leveled", "Counters templated and set", "Allowances documented"],
  },
  {
    id: "tile",
    short: "Tile",
    status: "Tile: wet-area surfaces",
    blurb: "Wet-area waterproofing, tile, grout, and flooring transitions complete durable surfaces.",
    focus: "Focus: bath floor, shower wall, and kitchen backsplash.",
    context: "Context: cabinets and completed rooms stay fully recognizable.",
    checks: ["Waterproofing verified", "Tile and grout", "Floor transitions", "Trim and fixture handoff"],
  },
  {
    id: "punch",
    short: "Punch",
    status: "Punch: review the finished house",
    blurb: "The nearly complete house is checked for gaps, touch-ups, operation, and final signoffs.",
    focus: "Focus: visible red review markers inside and outside.",
    context: "Context: all completed work remains fully rendered.",
    checks: ["Owner punch walk", "Final inspections", "Touch-ups completed", "Closeout packet assembled"],
  },
  {
    id: "handoff",
    short: "Handoff",
    status: "Handoff: finished house",
    blurb: "Warranty contacts, systems orientation, maintenance habits, and records support long-term stewardship.",
    focus: "Focus: the complete exterior and finished interior of the same house.",
    context: "Context: construction markers are removed for a clean final read.",
    checks: ["Warranty information delivered", "Systems orientation", "Named contact for follow-up", "Records organized and retained"],
  },
];

function quant(v) {
  return Math.round(v * 1000) / 1000;
}

function roomEdges(room) {
  const omit = new Set(room.omit || []);
  const edges = [];
  const pushH = (z, side) => {
    if (omit.has(side)) return;
    edges.push({ axis: "h", fixed: quant(z), lo: quant(room.x), hi: quant(room.x + room.w), room: room.id });
  };
  const pushV = (x, side) => {
    if (omit.has(side)) return;
    edges.push({ axis: "v", fixed: quant(x), lo: quant(room.z), hi: quant(room.z + room.d), room: room.id });
  };
  pushH(room.z, "s");
  pushH(room.z + room.d, "n");
  pushV(room.x, "w");
  pushV(room.x + room.w, "e");
  return edges;
}

function mergeLine(segments) {
  const events = [];
  segments.forEach((s) => {
    events.push({ t: s.lo, d: 1, room: s.room });
    events.push({ t: s.hi, d: -1, room: s.room });
  });
  events.sort((a, b) => a.t - b.t || b.d - a.d);
  const active = new Map();
  const out = [];
  let i = 0;
  while (i < events.length) {
    const t = events[i].t;
    while (i < events.length && Math.abs(events[i].t - t) < 0.0005) {
      const e = events[i++];
      if (e.d === 1) active.set(e.room, (active.get(e.room) || 0) + 1);
      else {
        const n = (active.get(e.room) || 0) - 1;
        if (n <= 0) active.delete(e.room);
        else active.set(e.room, n);
      }
    }
    const next = i < events.length ? events[i].t : null;
    if (next !== null && next - t > 0.03 && active.size) {
      out.push({
        lo: quant(t),
        hi: quant(next),
        rooms: [...active.keys()],
        exterior: active.size === 1,
      });
    }
  }
  return out;
}

export function buildWalls(rooms) {
  const horiz = new Map();
  const vert = new Map();
  rooms.forEach((room) => {
    roomEdges(room).forEach((edge) => {
      const map = edge.axis === "h" ? horiz : vert;
      if (!map.has(edge.fixed)) map.set(edge.fixed, []);
      map.get(edge.fixed).push(edge);
    });
  });
  const walls = [];
  horiz.forEach((list, fixed) => {
    mergeLine(list).forEach((seg) => walls.push({ axis: "h", fixed, ...seg }));
  });
  vert.forEach((list, fixed) => {
    mergeLine(list).forEach((seg) => walls.push({ axis: "v", fixed, ...seg }));
  });
  return walls;
}

function splitWall(wall, openings) {
  const hits = [];
  openings.forEach((op) => {
    if (op.axis !== wall.axis) return;
    if (Math.abs(op.fixed - wall.fixed) > 0.04) return;
    const a = Math.max(wall.lo, op.c - op.w / 2);
    const b = Math.min(wall.hi, op.c + op.w / 2);
    if (b - a < 0.04) return;
    if (op.c < wall.lo - 0.05 || op.c > wall.hi + 0.05) return;
    hits.push({ a: quant(a), b: quant(b), op });
    op._used = true;
  });
  const points = [wall.lo, wall.hi];
  hits.forEach((h) => points.push(h.a, h.b));
  points.sort((a, b) => a - b);
  const uniq = [];
  points.forEach((p) => {
    if (!uniq.length || p - uniq[uniq.length - 1] > 0.02) uniq.push(p);
  });
  const pieces = [];
  for (let i = 0; i < uniq.length - 1; i += 1) {
    const a = uniq[i];
    const b = uniq[i + 1];
    if (b - a < 0.03) continue;
    const mid = (a + b) / 2;
    const hit = hits.find((h) => mid > h.a + 0.01 && mid < h.b - 0.01);
    const kind = hit ? hit.op.kind : "solid";
    if (kind === "void") continue;
    pieces.push({
      axis: wall.axis,
      fixed: wall.fixed,
      lo: quant(a),
      hi: quant(b),
      exterior: wall.exterior,
      kind,
      op: hit ? hit.op : null,
      rooms: wall.rooms,
    });
  }
  return pieces;
}

export function buildPieces(rooms, openings) {
  const walls = buildWalls(rooms);
  openings.forEach((op) => {
    op._used = false;
  });
  const pieces = walls.flatMap((wall) => splitWall(wall, openings));
  const skipped = openings.filter((op) => !op._used);
  return { walls, pieces, skipped };
}

export function labelPoints(rooms) {
  return rooms
    .filter((room) => room.label !== false && room.name)
    .map((room) => ({
      name: room.name,
      x: room.label[0],
      z: room.label[1],
      w: room.w,
    }));
}

export function endState(index) {
  const base = {
    spread: 1,
    slab: 0,
    riseG: 0,
    riseF: 0,
    roof: 0,
    openings: 0,
    insulation: 0,
    drywall: 0,
    cabinets: 0,
    tile: 0,
    punch: 0,
    stamp: 0,
    dims: 0,
    lot: 0,
    cutaway: 0,
    mepP: 0,
    mepE: 0,
    mepH: 0,
    finishes: 0,
    siding: 0,
  };
  const built = {
    ...base,
    spread: 0,
    slab: 1,
    lot: 1,
    riseG: 1,
    riseF: 1,
    roof: 1,
    openings: 1,
    siding: 1,
    drywall: 1,
    cabinets: 1,
    tile: 1,
    finishes: 1,
  };
  switch (index) {
    case 0:
      return base;
    case 1:
      return { ...base, dims: 1 };
    case 2:
      return { ...base, dims: 1, stamp: 1 };
    case 3:
      return { ...base, lot: 1, slab: 0.22 };
    case 4:
      return { ...base, lot: 1, slab: 1 };
    case 5:
      return { ...base, lot: 1, slab: 1, spread: 0, riseG: 1, riseF: 1 };
    case 6:
      return { ...base, lot: 1, slab: 1, spread: 0, riseG: 1, riseF: 1, roof: 1.85 };
    case 7:
      return { ...base, lot: 1, slab: 1, spread: 0, riseG: 1, riseF: 1, roof: 1, openings: 1, siding: 1 };
    case 8:
      return { ...built, drywall: 0, cabinets: 0, tile: 0, finishes: 0, roof: 1.7, cutaway: 1, mepP: 1 };
    case 9:
      return { ...built, drywall: 0, cabinets: 0, tile: 0, finishes: 0, roof: 1.7, cutaway: 1, mepP: 0.28, mepE: 1 };
    case 10:
      return { ...built, drywall: 0, cabinets: 0, tile: 0, finishes: 0, roof: 1.7, cutaway: 1, mepP: 0.2, mepE: 0.2, mepH: 1 };
    case 11:
      return { ...built, drywall: 0, cabinets: 0, tile: 0, finishes: 0, cutaway: 1, insulation: 1, mepP: 0.15, mepE: 0.15, mepH: 0.15 };
    case 12:
      return { ...built, cabinets: 0, tile: 0, finishes: 0.15, cutaway: 1 };
    case 13:
      return { ...built, tile: 0.35, finishes: 0.45, cutaway: 1 };
    case 14:
      return { ...built, finishes: 0.85, cutaway: 1 };
    case 15:
      return { ...built, punch: 1, cutaway: 0 };
    default:
      return { ...built, cutaway: 0 };
  }
}

export function modelCounts() {
  const g = buildPieces(GROUND_ROOMS, OPENINGS.filter((op) => op.floor === 0));
  const f = buildPieces(FIRST_ROOMS, OPENINGS.filter((op) => op.floor === 1));
  const openingKinds = new Set(["door", "window", "garage", "slider"]);
  const openings = OPENINGS.filter((op) => openingKinds.has(op.kind)).length;
  return {
    walls: g.walls.length + f.walls.length,
    openings,
    rooms: labelPoints(GROUND_ROOMS).length + labelPoints(FIRST_ROOMS).length,
    floors: 2,
    skipped: g.skipped.length + f.skipped.length,
    skippedDetail: [...g.skipped, ...f.skipped].map((op) => `${op.floor}:${op.kind}@${op.axis}${op.fixed}`),
  };
}

function svgWalls(pieces, ox, oy, scale, depth) {
  return pieces
    .map((piece) => {
      const t = piece.exterior ? 5.2 : 3.2;
      const len = piece.hi - piece.lo;
      if (piece.axis === "h") {
        const x = ox + piece.lo * scale;
        const y = oy + (depth - piece.fixed) * scale - t / 2;
        const gap = piece.kind !== "solid";
        if (!gap) return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(len * scale).toFixed(1)}" height="${t}" fill="#2a2926"/>`;
        const glass = piece.kind === "window" || piece.kind === "slider";
        return `<rect x="${x.toFixed(1)}" y="${(y + t * 0.35).toFixed(1)}" width="${(len * scale).toFixed(1)}" height="${(t * 0.3).toFixed(1)}" fill="${glass ? "#7f97a3" : "none"}" stroke="#2a2926" stroke-width="1"/>`;
      }
      const x = ox + piece.fixed * scale - t / 2;
      const y = oy + (depth - piece.hi) * scale;
      const h = len * scale;
      if (piece.kind === "solid") return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${t}" height="${h.toFixed(1)}" fill="#2a2926"/>`;
      const glass = piece.kind === "window" || piece.kind === "slider";
      return `<rect x="${(x + t * 0.35).toFixed(1)}" y="${y.toFixed(1)}" width="${(t * 0.3).toFixed(1)}" height="${h.toFixed(1)}" fill="${glass ? "#7f97a3" : "none"}" stroke="#2a2926" stroke-width="1"/>`;
    })
    .join("");
}

function svgFurniture(floor, ox, oy, scale, depth) {
  return FURNITURE.filter((item) => item.floor === floor)
    .map((item) => {
      if (item.type === "stair") {
        let marks = "";
        for (let z = item.z; z < item.z + item.d; z += item.step) {
          const y = oy + (depth - z) * scale;
          marks += `<line x1="${(ox + item.x * scale).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(ox + (item.x + item.w) * scale).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#3c3b38" stroke-width="1"/>`;
        }
        return marks;
      }
      if (item.type === "toilet" || item.type === "sink") {
        const cx = ox + item.x * scale;
        const cy = oy + (depth - item.z) * scale;
        const r = item.type === "toilet" ? 5.5 : 4.2;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="none" stroke="#3c3b38" stroke-width="1.2"/>`;
      }
      if (!item.w) return "";
      const x = ox + item.x * scale;
      const y = oy + (depth - (item.z + item.d)) * scale;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(item.w * scale).toFixed(1)}" height="${(item.d * scale).toFixed(1)}" fill="none" stroke="#3c3b38" stroke-width="1.15"/>`;
    })
    .join("");
}

export function toSvg() {
  const scale = 16;
  const g = buildPieces(GROUND_ROOMS, OPENINGS.filter((op) => op.floor === 0));
  const f = buildPieces(FIRST_ROOMS, OPENINGS.filter((op) => op.floor === 1));
  const pad = 18;
  const gw = PLAN_W * scale;
  const gd = PLAN_D * scale;
  const fw = MAIN_W * scale;
  const fd = PLAN_D * scale;
  const gap = 28;
  const width = pad * 2 + gw;
  const height = pad * 3 + gd + fd + 36;
  const groundOy = pad + 16;
  const firstOy = groundOy + gd + gap + 16;
  const labels = (rooms, ox, oy, depth) =>
    labelPoints(rooms)
      .map((label) => {
        const x = ox + label.x * scale;
        const y = oy + (depth - label.z) * scale;
        return `<g><rect x="${(x - label.name.length * 3.1).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="${(label.name.length * 6.2).toFixed(1)}" height="14" rx="7" fill="#fffcf8" stroke="#e4ddd2"/><text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="8" font-weight="700" fill="#1c1b19">${label.name}</text></g>`;
      })
      .join("");
  const sheet = (x, y, w, h) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fbf8f3" stroke="#e3dcd0"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-label="Illustrative ground floor and first floor plan">
  <rect width="100%" height="100%" fill="#f3efe6"/>
  <g id="svg-ground">
    ${sheet(pad - 8, groundOy - 22, gw + 16, gd + 40)}
    ${svgFurniture(0, pad, groundOy, scale, PLAN_D)}
    ${svgWalls(g.pieces, pad, groundOy, scale, PLAN_D)}
    ${labels(GROUND_ROOMS, pad, groundOy, PLAN_D)}
    <text x="${pad + gw / 2}" y="${groundOy + gd + 16}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" letter-spacing="1.5" fill="#6d675e">GROUND FLOOR</text>
    <g id="svg-stamp" class="stamp">
      <rect x="${pad + gw - 118}" y="${groundOy + 8}" width="108" height="42" rx="6" fill="none" stroke="#1e4d3a" stroke-width="1.5"/>
      <text x="${pad + gw - 64}" y="${groundOy + 24}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="8" font-weight="700" fill="#1e4d3a">EDUCATIONAL</text>
      <text x="${pad + gw - 64}" y="${groundOy + 36}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="7" fill="#1e4d3a">NOT FOR CONSTRUCTION</text>
    </g>
  </g>
  <g id="svg-first">
    ${sheet(pad - 8, firstOy - 22, fw + 16, fd + 40)}
    ${svgFurniture(1, pad, firstOy, scale, PLAN_D)}
    ${svgWalls(f.pieces, pad, firstOy, scale, PLAN_D)}
    ${labels(FIRST_ROOMS, pad, firstOy, PLAN_D)}
    <text x="${pad + fw / 2}" y="${firstOy + fd + 16}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9" letter-spacing="1.5" fill="#6d675e">FIRST FLOOR</text>
  </g>
</svg>`;
}

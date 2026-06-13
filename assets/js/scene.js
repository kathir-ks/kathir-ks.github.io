// Kathir OS v3 — scroll-driven Three.js world.
//
// One continuous scene. Each DOM section [data-station] maps to a "station"
// along a winding camera path; scroll progress drives the camera, which banks
// and dives between stations. The knowledge-graph station is interactive
// (raycast hover). Heavy effects degrade on coarse pointers / small screens,
// and autonomous motion is disabled under prefers-reduced-motion.

import * as THREE from "three";

const COLORS = {
  bg: 0x070710,
  green: 0x7fffb2,
  violet: 0xa78bfa,
  blue: 0x38bdf8,
  orange: 0xfb923c,
  text: 0xddddf0,
};

const KIND_COLORS = [COLORS.green, COLORS.violet, COLORS.blue, COLORS.orange];

const STATION_POS = [
  new THREE.Vector3(0, 0, 0),        // hero
  new THREE.Vector3(45, -8, -150),   // live
  new THREE.Vector3(-55, 10, -300),  // thoughts
  new THREE.Vector3(60, -15, -450),  // projects
  new THREE.Vector3(0, 6, -610),     // graph
  new THREE.Vector3(-60, 22, -770),  // research
  new THREE.Vector3(48, -12, -920),  // agents
  new THREE.Vector3(0, 0, -1070),    // contact
];
const CAM_OFFSET = new THREE.Vector3(0, 5, 62);

const MOBILE = matchMedia("(pointer:coarse)").matches || innerWidth < 768;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const Q = MOBILE ? 0.45 : 1; // particle-count quality factor

// ── texture helpers ───────────────────────────────────────────

function glowTexture(hex = "#7fffb2") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, hex);
  g.addColorStop(0.35, hex + "88");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function glyphTexture(char, hex = "#7fffb2") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = "44px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hex;
  ctx.fillText(char, 32, 34);
  return new THREE.CanvasTexture(c);
}

const GLYPHS = ["∇", "λ", "α", "β", "∂", "Σ", "∞", "⟨", "⟩", "→", "≈", "⊕"];

// ── station builders (each returns {group, update(t, dt)}) ───

function buildNebula(center) {
  const group = new THREE.Group();
  group.position.copy(center);

  const n = Math.floor(2600 * Q);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const palette = [new THREE.Color(COLORS.green), new THREE.Color(COLORS.violet), new THREE.Color(COLORS.blue)];
  for (let i = 0; i < n; i++) {
    const r = 30 + Math.pow(Math.random(), 0.6) * 80;
    const th = Math.random() * Math.PI * 2;
    const ph = (Math.random() - 0.5) * 0.9;
    pos[i * 3] = Math.cos(th) * r;
    pos[i * 3 + 1] = Math.sin(ph) * r * 0.45;
    pos[i * 3 + 2] = Math.sin(th) * r - 25;
    const c = palette[(Math.random() * palette.length) | 0];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.5, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  group.add(pts);

  const ico = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(15, 1)),
    new THREE.LineBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.22 })
  );
  ico.position.set(0, 2, -30);
  group.add(ico);

  const glyphs = [];
  for (let i = 0; i < Math.floor(18 * Q); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glyphTexture(GLYPHS[i % GLYPHS.length], i % 2 ? "#a78bfa" : "#7fffb2"),
      transparent: true, opacity: 0.5, depthWrite: false,
    }));
    s.position.set((Math.random() - 0.5) * 130, (Math.random() - 0.5) * 60, -10 - Math.random() * 70);
    s.scale.setScalar(2.5 + Math.random() * 2.5);
    s.userData.phase = Math.random() * Math.PI * 2;
    glyphs.push(s);
    group.add(s);
  }

  return {
    group,
    update(t) {
      if (REDUCED) return;
      pts.rotation.y = t * 0.02;
      ico.rotation.x = t * 0.12;
      ico.rotation.y = t * 0.17;
      glyphs.forEach((g) => { g.position.y += Math.sin(t * 0.7 + g.userData.phase) * 0.012; });
    },
  };
}

function buildStreams(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const streams = [];
  const colors = [COLORS.blue, COLORS.orange, COLORS.violet, COLORS.green];
  const per = Math.floor(160 * Q);
  colors.forEach((color, si) => {
    const pos = new Float32Array(per * 3);
    for (let i = 0; i < per; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 180;
      pos[i * 3 + 1] = (si - 1.5) * 12 + (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = -20 - Math.random() * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: 1.3, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    p.userData.speed = 14 + si * 5;
    streams.push(p);
    group.add(p);
  });
  return {
    group,
    update(t, dt) {
      if (REDUCED) return;
      streams.forEach((p) => {
        const a = p.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          let x = a.getX(i) + p.userData.speed * dt;
          if (x > 95) x = -95;
          a.setX(i, x);
          a.setY(i, a.getY(i) + Math.sin(t * 2 + i) * 0.004);
        }
        a.needsUpdate = true;
      });
    },
  };
}

function buildPapers(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const planes = [];
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1d1d33, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.3 });
  const geo = new THREE.PlaneGeometry(9, 12);
  const edges = new THREE.EdgesGeometry(geo);
  for (let i = 0; i < Math.floor(13 * Q) + 4; i++) {
    const m = new THREE.Mesh(geo, mat);
    const e = new THREE.LineSegments(edges, edgeMat);
    m.add(e);
    m.position.set((Math.random() - 0.5) * 140, (Math.random() - 0.5) * 65, -15 - Math.random() * 75);
    m.rotation.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.4);
    m.userData = { rx: (Math.random() - 0.5) * 0.06, ry: (Math.random() - 0.5) * 0.1, phase: Math.random() * 6 };
    planes.push(m);
    group.add(m);
  }
  return {
    group,
    update(t, dt) {
      if (REDUCED) return;
      planes.forEach((m) => {
        m.rotation.x += m.userData.rx * dt;
        m.rotation.y += m.userData.ry * dt;
        m.position.y += Math.sin(t * 0.5 + m.userData.phase) * 0.01;
      });
    },
  };
}

function buildPod(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const nx = 6, ny = 3, nz = 4, gap = 11;
  const count = nx * ny * nz;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(6, 6, 6),
    new THREE.MeshBasicMaterial({ color: COLORS.green, wireframe: true, transparent: true, opacity: 0.28 }),
    count
  );
  const dummy = new THREE.Object3D();
  const centers = [];
  let idx = 0;
  for (let x = 0; x < nx; x++)
    for (let y = 0; y < ny; y++)
      for (let z = 0; z < nz; z++) {
        const p = new THREE.Vector3((x - (nx - 1) / 2) * gap, (y - (ny - 1) / 2) * gap, (z - (nz - 1) / 2) * gap - 40);
        centers.push(p);
        dummy.position.copy(p);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
  group.add(mesh);
  return {
    group,
    update(t) {
      if (REDUCED) return;
      group.rotation.y = Math.sin(t * 0.1) * 0.25;
      for (let i = 0; i < count; i++) {
        const s = 1 + Math.sin(t * 1.6 + i * 0.6) * 0.12;
        dummy.position.copy(centers[i]);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildHelix(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const n = Math.floor(260 * Q) + 60;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const cGreen = new THREE.Color(COLORS.green), cViolet = new THREE.Color(COLORS.violet);
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const ang = f * Math.PI * 8;
    const r = 24;
    const strand = i % 2 ? 0 : Math.PI;
    pos[i * 3] = Math.cos(ang + strand) * r;
    pos[i * 3 + 1] = (f - 0.5) * 75;
    pos[i * 3 + 2] = Math.sin(ang + strand) * r - 35;
    const c = i % 2 ? cViolet : cGreen;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.6, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  group.add(pts);
  return {
    group,
    update(t) { if (!REDUCED) pts.rotation.y = t * 0.18; },
  };
}

function buildRadar(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const ringMat = new THREE.LineBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.25 });
  for (let r = 12; r <= 48; r += 12) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.4, 0));
    }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    ring.position.z = -35;
    ring.rotation.x = -0.35;
    group.add(ring);
  }
  const sweep = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(48, 0, 0)]),
    new THREE.LineBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.7 })
  );
  sweep.position.z = -35;
  sweep.rotation.x = -0.35;
  group.add(sweep);

  const blips = [];
  const blipTex = glowTexture("#7fffb2");
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: blipTex, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 38;
    s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.4 - 12, -34);
    s.scale.setScalar(3);
    s.userData.phase = Math.random() * 6;
    blips.push(s);
    group.add(s);
  }
  return {
    group,
    update(t) {
      if (REDUCED) return;
      sweep.rotation.z = t * 0.9;
      blips.forEach((b) => { b.material.opacity = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.2 + b.userData.phase)); });
    },
  };
}

function buildRain(center) {
  const group = new THREE.Group();
  group.position.copy(center);
  const sprites = [];
  for (let i = 0; i < Math.floor(34 * Q) + 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glyphTexture(GLYPHS[i % GLYPHS.length], ["#7fffb2", "#a78bfa", "#38bdf8"][i % 3]),
      transparent: true, opacity: 0.55, depthWrite: false,
    }));
    s.position.set((Math.random() - 0.5) * 130, (Math.random() - 0.5) * 80, -10 - Math.random() * 60);
    s.scale.setScalar(2 + Math.random() * 2);
    s.userData.speed = 3 + Math.random() * 6;
    sprites.push(s);
    group.add(s);
  }
  return {
    group,
    update(_, dt) {
      if (REDUCED) return;
      sprites.forEach((s) => {
        s.position.y -= s.userData.speed * dt;
        if (s.position.y < -45) s.position.y = 45;
      });
    },
  };
}

// ── knowledge graph station (interactive) ─────────────────────

const SAMPLE_GRAPH = (() => {
  const topics = [
    ["sparse-autoencoders", "interp", 3], ["jumprelu", "interp", 2], ["superposition", "interp", 2],
    ["feature-splitting", "interp", 1.5], ["circuits", "interp", 1.5],
    ["transformers", "ml", 3], ["attention", "ml", 2], ["pretraining", "ml", 2.5],
    ["scaling-laws", "ml", 1.5], ["lora", "ml", 1],
    ["jax", "systems", 3], ["xla", "systems", 2], ["tpu-pods", "systems", 2.5],
    ["pipeline-parallel", "systems", 1.5], ["fsdp", "systems", 1.5], ["kv-cache", "systems", 1],
    ["hindi-nlp", "data", 2], ["fineweb-edu", "data", 2], ["indictrans2", "data", 1],
    ["arc-agi", "reasoning", 2], ["program-synthesis", "reasoning", 1],
    ["rust", "lang", 1.5], ["v8-internals", "lang", 1.5], ["llm-agents", "agents", 2],
  ];
  const nodes = topics.map(([id, kind, weight]) => ({ id, label: id.replace(/-/g, " "), kind, weight }));
  const edges = [
    ["sparse-autoencoders", "jumprelu"], ["sparse-autoencoders", "superposition"],
    ["sparse-autoencoders", "feature-splitting"], ["sparse-autoencoders", "transformers"],
    ["jumprelu", "circuits"], ["superposition", "circuits"], ["transformers", "attention"],
    ["transformers", "pretraining"], ["pretraining", "scaling-laws"], ["pretraining", "fineweb-edu"],
    ["transformers", "lora"], ["jax", "xla"], ["jax", "tpu-pods"], ["jax", "sparse-autoencoders"],
    ["tpu-pods", "pipeline-parallel"], ["tpu-pods", "fsdp"], ["xla", "tpu-pods"],
    ["attention", "kv-cache"], ["hindi-nlp", "fineweb-edu"], ["hindi-nlp", "indictrans2"],
    ["arc-agi", "program-synthesis"], ["arc-agi", "transformers"], ["llm-agents", "program-synthesis"],
    ["rust", "v8-internals"], ["llm-agents", "v8-internals"], ["jax", "pretraining"],
  ].map(([source, target]) => ({ source, target, weight: 1 }));
  return { nodes, edges, sample: true };
})();

function buildGraphStation(center) {
  const group = new THREE.Group();
  group.position.copy(center);

  const state = {
    nodes: [], sprites: [], lines: null, simLeft: 0, kinds: new Map(),
    textures: KIND_COLORS.map((c) => glowTexture("#" + c.toString(16).padStart(6, "0"))),
  };

  function kindColorIdx(kind) {
    if (!state.kinds.has(kind)) state.kinds.set(kind, state.kinds.size % KIND_COLORS.length);
    return state.kinds.get(kind);
  }

  function setGraph(graph) {
    // clear previous
    state.sprites.forEach((s) => group.remove(s));
    if (state.lines) group.remove(state.lines);
    state.sprites = [];
    state.kinds.clear();

    const byId = new Map();
    state.nodes = graph.nodes.slice(0, 220).map((n) => {
      const node = {
        ...n,
        pos: new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60 - 30),
        vel: new THREE.Vector3(),
        edges: [],
      };
      byId.set(n.id, node);
      return node;
    });
    state.edges = graph.edges
      .map((e) => ({ a: byId.get(e.source), b: byId.get(e.target), w: e.weight || 1 }))
      .filter((e) => e.a && e.b);
    state.edges.forEach((e) => { e.a.edges.push(e); e.b.edges.push(e); });

    state.nodes.forEach((node) => {
      const ci = kindColorIdx(node.kind);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: state.textures[ci], transparent: true, opacity: 0.9, depthWrite: false,
      }));
      s.scale.setScalar(2.2 + Math.min(node.weight || 1, 4) * 1.3);
      s.userData.node = node;
      node.sprite = s;
      state.sprites.push(s);
      group.add(s);
    });

    const linePos = new Float32Array(state.edges.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    state.lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: COLORS.violet, transparent: true, opacity: 0.28,
    }));
    group.add(state.lines);

    state.simLeft = 260; // settle over ~4s, visibly
    syncPositions();
  }

  function simStep() {
    const N = state.nodes;
    // pairwise repulsion
    for (let i = 0; i < N.length; i++)
      for (let j = i + 1; j < N.length; j++) {
        const d = new THREE.Vector3().subVectors(N[i].pos, N[j].pos);
        const len2 = Math.max(d.lengthSq(), 1);
        d.multiplyScalar(160 / len2 / Math.sqrt(len2));
        N[i].vel.add(d);
        N[j].vel.sub(d);
      }
    // spring attraction
    state.edges.forEach((e) => {
      const d = new THREE.Vector3().subVectors(e.b.pos, e.a.pos);
      const stretch = (d.length() - 18) * 0.012 * e.w;
      d.normalize().multiplyScalar(stretch);
      e.a.vel.add(d);
      e.b.vel.sub(d);
    });
    // mild centering + integrate
    N.forEach((n) => {
      n.vel.addScaledVector(n.pos, -0.003);
      n.vel.multiplyScalar(0.82);
      n.pos.add(n.vel);
    });
  }

  function syncPositions() {
    state.nodes.forEach((n) => n.sprite.position.copy(n.pos).add(new THREE.Vector3(0, 0, -30)));
    if (!state.lines) return;
    const a = state.lines.geometry.attributes.position;
    state.edges.forEach((e, i) => {
      a.setXYZ(i * 2, e.a.pos.x, e.a.pos.y, e.a.pos.z - 30);
      a.setXYZ(i * 2 + 1, e.b.pos.x, e.b.pos.y, e.b.pos.z - 30);
    });
    a.needsUpdate = true;
  }

  setGraph(SAMPLE_GRAPH);

  return {
    group,
    sprites: () => state.sprites,
    setGraph,
    update() {
      if (state.simLeft > 0) {
        const steps = Math.min(state.simLeft, 3);
        for (let s = 0; s < steps; s++) simStep();
        state.simLeft -= steps;
        syncPositions();
      }
      if (!REDUCED) group.rotation.y += 0.0012;
    },
  };
}

// ── main ──────────────────────────────────────────────────────

export function initScene({ onGraphHover } = {}) {
  const canvas = document.getElementById("scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, alpha: false, powerPreference: "high-performance" });
  } catch {
    document.body.classList.add("no-webgl");
    return { setGraph() {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(COLORS.bg, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.bg, 0.0042);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);

  const stations = [
    buildNebula(STATION_POS[0]),
    buildStreams(STATION_POS[1]),
    buildPapers(STATION_POS[2]),
    buildPod(STATION_POS[3]),
    buildGraphStation(STATION_POS[4]),
    buildHelix(STATION_POS[5]),
    buildRadar(STATION_POS[6]),
    buildRain(STATION_POS[7]),
  ];
  stations.forEach((s) => scene.add(s.group));
  const graphStation = stations[4];

  // ── grounding: a shared floor + per-station anchors so the stations read as
  //    landmarks placed in one continuous environment, not fields floating in void.
  const FLOOR_Y = -58;
  const ground = new THREE.GridHelper(2600, 52, COLORS.violet, 0x141426);
  ground.position.set(0, FLOOR_Y, -520);
  ground.material.transparent = true;
  ground.material.opacity = 0.16;
  ground.material.depthWrite = false;
  scene.add(ground);

  const beamMat = new THREE.LineBasicMaterial({ color: COLORS.green, transparent: true, opacity: 0.1 });
  STATION_POS.forEach((p) => {
    const beam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.x, p.y, p.z - 30),
        new THREE.Vector3(p.x, FLOOR_Y, p.z - 30),
      ]), beamMat);
    scene.add(beam);
  });

  // camera path: catmull-rom through per-station camera keyframes
  const camCurve = new THREE.CatmullRomCurve3(
    STATION_POS.map((p) => p.clone().add(CAM_OFFSET)), false, "catmullrom", 0.35
  );
  const lookCurve = new THREE.CatmullRomCurve3(STATION_POS.map((p) => p.clone()), false, "catmullrom", 0.35);

  // scroll progress from DOM sections
  const sectionEls = [...document.querySelectorAll("[data-station]")];
  let tops = [];
  const measure = () => { tops = sectionEls.map((el) => el.offsetTop); };
  measure();

  function targetProgress() {
    const mid = scrollY + innerHeight * 0.45;
    const last = sectionEls.length - 1;
    if (mid <= tops[0]) return 0;
    for (let i = 0; i < last; i++) {
      if (mid < tops[i + 1]) return i + (mid - tops[i]) / (tops[i + 1] - tops[i]);
    }
    return last;
  }

  let progress = 0;
  let active = true; // paused (no render) while the simple view is showing
  let mouseX = 0, mouseY = 0, parX = 0, parY = 0;
  if (!MOBILE && !REDUCED) {
    addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / innerWidth - 0.5) * 2;
      mouseY = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  // ── free navigation: drag to look around, WASD to move/turn. Scroll stays the
  //    guided tour (handled below via targetProgress); these layer on top. All of it
  //    is disabled under reduced motion — there, only scroll/click drive the camera.
  let lookYaw = 0, lookPitch = 0, dragYaw = 0, dragPitch = 0;
  let dragging = false, lastPX = 0, lastPY = 0;
  const keys = new Set();
  const DRAG_IGNORE = "a,button,input,textarea,select,.thought-card,#term-wrap,#modal,#wayfind,nav,footer";
  if (!REDUCED) {
    addEventListener("pointerdown", (e) => {
      if (e.target.closest && e.target.closest(DRAG_IGNORE)) return;
      dragging = true; lastPX = e.clientX; lastPY = e.clientY;
    }, { passive: true });
    addEventListener("pointerup", () => { dragging = false; }, { passive: true });
    addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dragYaw = Math.max(-0.95, Math.min(0.95, dragYaw + (e.clientX - lastPX) * 0.0022));
      dragPitch = Math.max(-0.55, Math.min(0.55, dragPitch + (e.clientY - lastPY) * 0.0018));
      lastPX = e.clientX; lastPY = e.clientY;
    }, { passive: true });
  }
  if (!MOBILE && !REDUCED) {
    addEventListener("keydown", (e) => {
      if (/^(input|textarea)$/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "a" || k === "s" || k === "d") keys.add(k);
    });
    addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  }
  const _lookAt = new THREE.Vector3();
  const _sph = new THREE.Spherical();
  const _dir = new THREE.Vector3();

  // graph hover (raycast only while near the graph station, fine pointer only)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  if (!MOBILE && onGraphHover) {
    addEventListener("pointermove", (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      pointer.cx = e.clientX; pointer.cy = e.clientY;
    }, { passive: true });
  }

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    measure();
  });
  // re-measure when async content changes section heights
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);

  const clock = new THREE.Clock();
  const maxT = sectionEls.length - 1;

  function frame() {
    requestAnimationFrame(frame);
    if (!active || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // keyboard movement: W/S walk the guided path (via scroll), A/D turn the view
    if (keys.size) {
      if (keys.has("w")) scrollBy(0, 14);
      if (keys.has("s")) scrollBy(0, -14);
      if (keys.has("a")) dragYaw = Math.max(-0.95, dragYaw - 0.012);
      if (keys.has("d")) dragYaw = Math.min(0.95, dragYaw + 0.012);
    }

    const target = targetProgress();
    progress = REDUCED ? target : progress + (target - progress) * Math.min(1, dt * 4.5);

    const u = Math.min(Math.max(progress / maxT, 0), 1);
    camCurve.getPointAt(u, camera.position);
    const look = lookCurve.getPointAt(u);

    if (!dragging) { parX += ((mouseX * 7) - parX) * dt * 3; parY += ((-mouseY * 4) - parY) * dt * 3; }
    camera.position.x += parX;
    camera.position.y += parY;

    // apply free-look: rotate the guided look direction by the eased drag offsets,
    // and let the offset recenter toward the tour framing when the user lets go
    if (!dragging) { dragYaw *= 0.96; dragPitch *= 0.96; }
    lookYaw += (dragYaw - lookYaw) * Math.min(1, dt * 8);
    lookPitch += (dragPitch - lookPitch) * Math.min(1, dt * 8);
    if (lookYaw || lookPitch) {
      _sph.setFromVector3(_dir.subVectors(look, camera.position));
      _sph.theta -= lookYaw;
      _sph.phi = Math.max(0.25, Math.min(Math.PI - 0.25, _sph.phi - lookPitch));
      _dir.setFromSpherical(_sph);
      camera.lookAt(_lookAt.addVectors(camera.position, _dir));
    } else {
      camera.lookAt(look);
    }

    // update only stations near the camera
    stations.forEach((s, i) => {
      const near = Math.abs(progress - i) < 1.6;
      s.group.visible = near;
      if (near) s.update(t, dt);
    });

    // graph hover
    if (!MOBILE && onGraphHover && Math.abs(progress - 4) < 0.6 && pointer.cx != null) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(graphStation.sprites(), false)[0];
      const node = hit?.object.userData.node || null;
      if (node !== hovered) {
        hovered = node;
        onGraphHover(node, pointer.cx, pointer.cy);
      }
    } else if (hovered) {
      hovered = null;
      onGraphHover?.(null);
    }

    renderer.render(scene, camera);
  }
  frame();

  return {
    setGraph: (g) => graphStation.setGraph(g),
    isSampleGraph: () => true,
    // pause/resume rendering when the simple view hides/shows the world
    setActive: (on) => { active = !!on; if (on) clock.getDelta(); },
    // travel to a landmark by index — a smooth scroll that drives the guided camera
    travelTo: (i) => sectionEls[i]?.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }),
  };
}

export { SAMPLE_GRAPH };

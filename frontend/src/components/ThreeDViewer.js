import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// ── Colour palettes ────────────────────────────────────────────────────────
const FLOOR_COLORS = {
  living_room:    0xd6e8ff,
  master_bedroom: 0xfde8f5,
  bedroom:        0xebe0ff,
  kitchen:        0xd5f5e3,
  dining:         0xfef3d0,
  bathroom:       0xcff5fb,
  study:          0xedf0f0,
  balcony:        0xd4f7e6,
  terrace:        0xd4f7e6,
  guest_room:     0xfde8d5,
  parking:        0xe0e0e0,
  default:        0xf2f0ed,
};

const LABEL_COLORS = {
  living_room:    '#1D4ED8',
  master_bedroom: '#BE185D',
  bedroom:        '#6D28D9',
  kitchen:        '#047857',
  dining:         '#B45309',
  bathroom:       '#0E7490',
  study:          '#4B5563',
  balcony:        '#059669',
  terrace:        '#15803D',
  guest_room:     '#C2410C',
  parking:        '#374151',
  default:        '#374151',
};

const ROOM_NAMES = {
  living_room:    'Living Room',
  master_bedroom: 'Master Bedroom',
  bedroom:        'Bedroom',
  kitchen:        'Kitchen',
  dining:         'Dining',
  bathroom:       'Bathroom',
  study:          'Study',
  balcony:        'Balcony',
  terrace:        'Terrace',
  guest_room:     'Guest Room',
  parking:        'Parking',
};

function floorColor(type) { return FLOOR_COLORS[type] || FLOOR_COLORS.default; }
function lblColor(type)   { return LABEL_COLORS[type] || LABEL_COLORS.default; }
function roomName(type)   { return ROOM_NAMES[type]   || (type||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

// ── Room label sprite ──────────────────────────────────────────────────────
function makeLabelSprite(type, wFt, dFt) {
  const W = 340, H = 90;
  const canvas = document.createElement('canvas');
  canvas.width  = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const col = lblColor(type);

  // shadow
  ctx.shadowColor   = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur    = 6;
  ctx.shadowOffsetY = 2;

  // pill background
  ctx.clearRect(0,0,W,H);
  ctx.beginPath();
  ctx.roundRect(4, 4, W-8, H-8, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = col;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // colour accent bar on left
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(4, 4, 8, H-8, [12, 0, 0, 12]);
  ctx.fill();

  // room name
  ctx.font = 'bold 24px "Segoe UI", Arial';
  ctx.fillStyle = col;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(roomName(type), 22, 30);

  // dimensions
  ctx.font = '17px "Segoe UI", Arial';
  ctx.fillStyle = '#6B7280';
  ctx.fillText(`${Math.round(wFt)}′ × ${Math.round(dFt)}′   (${(wFt * dFt).toFixed(0)} sq ft)`, 22, 62);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(3.6, 0.95, 1);
  return spr;
}

// ── Door label sprite (entry badge) ───────────────────────────────────────
function makeDoorSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width  = 220; canvas.height = 60;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,220,60);

  ctx.beginPath();
  ctx.roundRect(2, 2, 216, 56, 8);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = 'bold 22px "Segoe UI", Arial';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 110, 30);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(2.2, 0.6, 1);
  return spr;
}

// ── Main component ─────────────────────────────────────────────────────────
const ThreeDViewer = ({ layout }) => {
  const mountRef    = useRef(null);
  const rendererRef = useRef(null);
  const animRef     = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats]       = useState({ rooms: 0, doors: 0, area: 0 });

  useEffect(() => {
    if (!layout || !mountRef.current) return;

    const W = mountRef.current.clientWidth  || 900;
    const H = mountRef.current.clientHeight || 650;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12172a);
    scene.fog = new THREE.FogExp2(0x12172a, 0.016);

    // Camera
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.055;
    controls.minDistance    = 4;
    controls.maxDistance    = 100;
    controls.maxPolarAngle  = Math.PI / 2.08;

    // Lighting
    const hemi = new THREE.HemisphereLight(0xfff8e7, 0x202850, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffde8, 1.6);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   = 0.5;
    sun.shadow.camera.far    = 120;
    sun.shadow.camera.left   = -50;
    sun.shadow.camera.right  = 50;
    sun.shadow.camera.top    = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x9bbfff, 0.4);
    fill.position.set(-12, 12, -18);
    scene.add(fill);

    const back = new THREE.DirectionalLight(0xffeedd, 0.25);
    back.position.set(0, 8, -20);
    scene.add(back);

    // Build model
    buildModel(scene, layout, camera, controls, setStats);

    // Animate
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    setIsLoaded(true);

    const mountNode = mountRef.current;
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animRef.current);
      renderer.dispose();
      if (mountNode && renderer.domElement.parentNode === mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [layout]);

  const handleExport = () => {
    if (!rendererRef.current) return;
    const url  = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url; link.download = 'floor-plan-3d.png'; link.click();
  };

  return (
    <div className="relative w-full h-full bg-gray-950 overflow-hidden" style={{ minHeight: 400 }}>
      <div ref={mountRef} className="w-full h-full" />

      {/* Controls hint */}
      {isLoaded && (
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-xs space-y-1">
          <p className="font-semibold text-gray-200 mb-1 text-sm">3D Controls</p>
          <p className="text-gray-400">◉ Left drag — Rotate</p>
          <p className="text-gray-400">◎ Right drag — Pan</p>
          <p className="text-gray-400">↕ Scroll — Zoom</p>
        </div>
      )}

      {/* Door legend */}
      {isLoaded && (
        <div className="absolute bottom-4 left-44 bg-black/60 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-xs space-y-1">
          <p className="font-semibold text-gray-200 mb-1 text-sm">Doors</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/><span className="text-gray-400">Main Entry</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-700 inline-block"/><span className="text-gray-400">Room Door</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"/><span className="text-gray-400">Sliding / Balcony</span></div>
        </div>
      )}

      {/* Stats */}
      {isLoaded && stats.rooms > 0 && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-xs space-y-1">
          <p className="font-semibold text-gray-200 text-sm">{stats.rooms} Rooms</p>
          {stats.doors > 0 && <p className="text-gray-400">{stats.doors} Doors</p>}
          <p className="text-gray-400">{stats.area.toFixed(0)} sq ft</p>
        </div>
      )}

      {/* Export */}
      {isLoaded && (
        <button
          onClick={handleExport}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Export PNG
        </button>
      )}

      {/* Loading */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Building 3D model…</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Model builder ──────────────────────────────────────────────────────────
function buildModel(scene, layout, camera, controls, setStats) {
  const plot  = layout.plot;
  const rooms = layout.rooms || [];
  const doors = layout.doors || [];

  const SCALE  = 0.28;  // ft → Three.js units
  const WALL_H = 9;     // ft — ceiling height
  const WALL_T = 0.18;  // Three.js units

  const s = ft => ft * SCALE;

  // ── Ground ────────────────────────────────────────────────────────────────
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e2538, roughness: 0.95 });
  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(s(plot.width/2), -0.02, s(plot.length/2));
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const grid = new THREE.GridHelper(300, 120, 0x2a3450, 0x222840);
  grid.position.set(s(plot.width/2), 0, s(plot.length/2));
  scene.add(grid);

  // ── Plot slab ─────────────────────────────────────────────────────────────
  const plotSlabMesh = new THREE.Mesh(
    new THREE.BoxGeometry(s(plot.width), 0.06, s(plot.length)),
    new THREE.MeshStandardMaterial({ color: 0x383e56, roughness: 0.85 })
  );
  plotSlabMesh.position.set(s(plot.width/2), 0.03, s(plot.length/2));
  plotSlabMesh.receiveShadow = true;
  scene.add(plotSlabMesh);

  // ── Setbacks ──────────────────────────────────────────────────────────────
  const sb = plot.setback || { front: 6, back: 4, left: 4, right: 4 };
  const sbMat = new THREE.MeshStandardMaterial({ color: 0x2a4535, roughness: 0.9 });
  const addSb = (x, z, w, d) => {
    if (w < 0.1 || d < 0.1) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s(w), 0.05, s(d)), sbMat);
    m.position.set(s(x + w/2), 0.055, s(z + d/2));
    m.receiveShadow = true;
    scene.add(m);
  };
  addSb(0, 0,                   plot.width, sb.back);
  addSb(0, plot.length-sb.front, plot.width, sb.front);
  addSb(0, sb.back,              sb.left,   plot.length - sb.back - sb.front);
  addSb(plot.width-sb.right, sb.back, sb.right, plot.length - sb.back - sb.front);

  // ── Buildable floor slab ──────────────────────────────────────────────────
  const bldW = plot.width  - sb.left - sb.right;
  const bldD = plot.length - sb.back - sb.front;
  const bldFloor = new THREE.Mesh(
    new THREE.BoxGeometry(s(bldW), 0.1, s(bldD)),
    new THREE.MeshStandardMaterial({ color: 0x7a7265, roughness: 0.8 })
  );
  bldFloor.position.set(s(sb.left + bldW/2), 0.09, s(sb.back + bldD/2));
  bldFloor.receiveShadow = true;
  scene.add(bldFloor);

  // shared wall materials
  const wallMat     = new THREE.MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.7, metalness: 0.02 });
  const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0x555555, linewidth: 1 });

  const makeWallBox = (wx, wy, wz, ww, wh, wd, mat) => {
    const geo  = new THREE.BoxGeometry(ww, wh, wd);
    const mesh = new THREE.Mesh(geo, mat || wallMat.clone());
    mesh.position.set(wx, wy, wz);
    mesh.castShadow   = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const el = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), wallEdgeMat.clone());
    el.position.copy(mesh.position);
    scene.add(el);
    return mesh;
  };

  // ── Rooms ─────────────────────────────────────────────────────────────────
  let totalArea = 0;

  rooms.forEach(room => {
    const rx = s(room.x), rz = s(room.y);
    const rw = s(room.width), rd = s(room.height);
    const rh = s(WALL_H);
    totalArea += room.width * room.height;

    // floor panel
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rw - WALL_T * 0.5, rd - WALL_T * 0.5),
      new THREE.MeshStandardMaterial({ color: floorColor(room.type), roughness: 0.55 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(rx + rw/2, 0.13, rz + rd/2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 4 walls
    const hy = rh/2 + 0.12;
    makeWallBox(rx + rw/2,       hy, rz + WALL_T/2,       rw,     rh, WALL_T);
    makeWallBox(rx + rw/2,       hy, rz + rd - WALL_T/2,  rw,     rh, WALL_T);
    makeWallBox(rx + WALL_T/2,   hy, rz + rd/2,           WALL_T, rh, rd);
    makeWallBox(rx + rw - WALL_T/2, hy, rz + rd/2,        WALL_T, rh, rd);

    // ceiling (glass)
    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rw, rd),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.04, roughness: 0.1, metalness: 0.4, side: THREE.DoubleSide })
    );
    ceilMesh.rotation.x = -Math.PI / 2;
    ceilMesh.position.set(rx + rw/2, rh + 0.12, rz + rd/2);
    scene.add(ceilMesh);

    // label sprite
    const lbl = makeLabelSprite(room.type, room.width, room.height);
    lbl.position.set(rx + rw/2, 1.35, rz + rd/2);
    scene.add(lbl);
  });

  // ── Exterior walls ─────────────────────────────────────────────────────────
  const extMat = new THREE.MeshStandardMaterial({ color: 0xfaf5ee, roughness: 0.65, metalness: 0.03 });
  const extH   = s(WALL_H + 0.6);
  const extT   = WALL_T * 2.2;
  const ox = s(sb.left), oz = s(sb.back);
  const ew = s(bldW), ed = s(bldD);
  const ey = extH/2 + 0.12;
  makeWallBox(ox + ew/2,          ey, oz + extT/2,         ew + extT*2, extH, extT,   extMat);
  makeWallBox(ox + ew/2,          ey, oz + ed - extT/2,    ew + extT*2, extH, extT,   extMat);
  makeWallBox(ox + extT/2,        ey, oz + ed/2,           extT,        extH, ed,     extMat);
  makeWallBox(ox + ew - extT/2,   ey, oz + ed/2,           extT,        extH, ed,     extMat);

  // ── Doors ─────────────────────────────────────────────────────────────────
  const doorCount = drawDoors(scene, doors, s, WALL_H);

  // ── Camera ────────────────────────────────────────────────────────────────
  const cx   = s(plot.width  / 2);
  const cz   = s(plot.length / 2);
  const diag = Math.sqrt(s(plot.width)**2 + s(plot.length)**2);

  camera.position.set(cx + diag * 0.70, diag * 0.58, cz + diag * 0.80);
  camera.lookAt(cx, 0, cz);
  controls.target.set(cx, s(WALL_H / 3), cz);
  controls.update();

  setStats({ rooms: rooms.length, doors: doorCount, area: totalArea });
}

// ── Door renderer ──────────────────────────────────────────────────────────
function drawDoors(scene, doors, s, WALL_H) {
  if (!doors || doors.length === 0) return 0;

  let count = 0;

  doors.forEach(door => {
    const dw   = s(door.width  || 3);
    const dh   = s(WALL_H * 0.90);      // door height = 90% of wall height
    const dx   = s(door.x);
    const dz   = s(door.y);
    const isH  = door.orientation !== 'vertical';
    const isMain  = door.type === 'main';
    const isSlide = door.type === 'sliding';

    // Colour scheme
    const frameHex = isMain ? 0xB91C1C : isSlide ? 0x1D4ED8 : 0x78350F;
    const leafHex  = isMain ? 0xEF4444 : isSlide ? 0x3B82F6 : 0x92400E;

    const frameMat = new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.5, metalness: 0.35 });
    const leafMat  = new THREE.MeshStandardMaterial({
      color: leafHex, roughness: 0.25, metalness: 0.15,
      transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    });
    const arcMat = new THREE.LineBasicMaterial({ color: frameHex });

    const FT = 0.06;   // frame thickness
    const LT = 0.055;  // leaf thickness

    const addBox = (x, y, z, w, h, d, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      scene.add(m);
      return m;
    };

    if (isH) {
      // ── Horizontal door (wall runs along X, opening at Z = dz) ────────────
      // Left jamb
      addBox(dx,       dh/2, dz, FT, dh, FT, frameMat);
      // Right jamb
      addBox(dx + dw,  dh/2, dz, FT, dh, FT, frameMat);
      // Lintel
      addBox(dx + dw/2, dh, dz, dw + FT*2, FT*1.5, FT*1.5, frameMat);

      if (isSlide) {
        // Sliding door — leaf sits in wall plane
        addBox(dx + dw/2, dh/2, dz, dw, dh, LT, leafMat);
      } else {
        // Swing door — pivot at left jamb, open ~55°
        const pivot = new THREE.Group();
        pivot.position.set(dx, 0, dz);
        scene.add(pivot);

        const leaf = new THREE.Mesh(new THREE.BoxGeometry(dw, dh - FT, LT), leafMat);
        leaf.position.set(dw/2, dh/2, 0);
        pivot.add(leaf);
        pivot.rotation.y = -Math.PI / 3.2;  // 56° open

        // Swing arc on floor
        const pts = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          const a = -(Math.PI / 3.2) * (i / steps);
          pts.push(new THREE.Vector3(dx + dw * Math.cos(a), 0.15, dz + dw * Math.sin(a)));
        }
        const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
        scene.add(new THREE.Line(arcGeo, arcMat));

        // Dashed hinge line (from pivot at floor to door height)
        const hingePts = [
          new THREE.Vector3(dx, 0.15,    dz),
          new THREE.Vector3(dx, dh + 0.1, dz),
        ];
        const hingeGeo = new THREE.BufferGeometry().setFromPoints(hingePts);
        scene.add(new THREE.Line(hingeGeo, arcMat));
      }
    } else {
      // ── Vertical door (wall runs along Z, opening at X = dx) ─────────────
      // Top jamb (lower Z)
      addBox(dx, dh/2, dz,       FT, dh, FT, frameMat);
      // Bottom jamb (higher Z)
      addBox(dx, dh/2, dz + dw,  FT, dh, FT, frameMat);
      // Lintel
      addBox(dx, dh, dz + dw/2,  FT*1.5, FT*1.5, dw + FT*2, frameMat);

      if (isSlide) {
        addBox(dx, dh/2, dz + dw/2, LT, dh, dw, leafMat);
      } else {
        const pivot = new THREE.Group();
        pivot.position.set(dx, 0, dz);
        scene.add(pivot);

        const leaf = new THREE.Mesh(new THREE.BoxGeometry(LT, dh - FT, dw), leafMat);
        leaf.position.set(0, dh/2, dw/2);
        pivot.add(leaf);
        pivot.rotation.y = Math.PI / 3.2;

        const pts = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          const a = (Math.PI / 3.2) * (i / steps);
          pts.push(new THREE.Vector3(dx + dw * Math.sin(a), 0.15, dz + dw * Math.cos(a)));
        }
        const arcGeo = new THREE.BufferGeometry().setFromPoints(pts);
        scene.add(new THREE.Line(arcGeo, arcMat));

        const hingePts = [
          new THREE.Vector3(dx, 0.15,    dz),
          new THREE.Vector3(dx, dh + 0.1, dz),
        ];
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hingePts), arcMat));
      }
    }

    // ── Entry badge ───────────────────────────────────────────────────────
    if (isMain) {
      const badge = makeDoorSprite('⬆ MAIN ENTRY', '#B91C1C');
      badge.position.set(
        isH ? dx + dw/2 : dx,
        s(WALL_H) + 0.8,
        isH ? dz          : dz + dw/2
      );
      scene.add(badge);
    }

    count++;
  });

  return count;
}

export default ThreeDViewer;

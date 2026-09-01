"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveElectricalComponent } from "@/lib/electrical-component-library";
import {
  DEFAULT_ELECTRICAL_MODEL_REGISTRY,
  ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY,
  ElectricalModelConfig,
  normalizeElectricalModelRegistry,
} from "@/lib/electrical-model-registry";

type Layer = "L0" | "L1" | "L2" | "L3" | "L4";
type XY = { x: number; y: number };
type EnvironmentMode = "CINEMATIC" | "ENGINEERING" | "NIGHT" | "EMERGENCY";
type SystemMode =
  | "ALL"
  | "POWER"
  | "EMERGENCY"
  | "EV"
  | "LOW_VOLTAGE"
  | "RENEWABLE";
type Entity = {
  id: string;
  source: string;
  layer: Layer;
  kind: string;
  name: string;
  x: number;
  y: number;
  z?: number;
  x2?: number;
  y2?: number;
  z2?: number;
  rotation?: number;
  scale?: number;
  floor?: string;
  zone?: string;
  vertices?: XY[];
  confidence: number;
  meta?: Record<string, unknown>;
};
type GraphLink = {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
};
type Graph = {
  version: string;
  createdAt: string;
  sources: {
    name: string;
    ext: string;
    sha256: string;
    discipline: string;
    floor?: string;
    elevation?: number;
    unitName?: string;
    unitToMeters?: number;
  }[];
  entities: Entity[];
  links?: GraphLink[];
  stats: Record<Layer, number>;
};
const layerNames: Record<Layer, string> = {
  L0: "Source",
  L1: "Architectural",
  L2: "Electrical Physical",
  L3: "Electrical Logical",
  L4: "STRATUM Assets",
};
const colors: Record<Layer, number> = {
  L0: 0x1d4964,
  L1: 0x6f8c9d,
  L2: 0xd28a3e,
  L3: 0x58b7ff,
  L4: 0x39db8a,
};
const registryEvent = "stratum:model-registry-updated";
const systemOptions: { id: SystemMode; label: string }[] = [
  { id: "ALL", label: "All systems" },
  { id: "POWER", label: "Power distribution" },
  { id: "EMERGENCY", label: "Emergency power" },
  { id: "EV", label: "EV infrastructure" },
  { id: "LOW_VOLTAGE", label: "Low voltage" },
  { id: "RENEWABLE", label: "Renewables" },
];

function entitySystem(e: Entity): SystemMode {
  const def = resolveElectricalComponent(e.name),
    n = `${e.name} ${def?.category || ""}`.toLowerCase();
  if (/generator|ats|ups|battery|emergency/.test(n)) return "EMERGENCY";
  if (/ev|charger/.test(n)) return "EV";
  if (/solar|pv|inverter|renewable/.test(n)) return "RENEWABLE";
  if (
    /fire alarm|security|access control|intercom|communication|data|sensor|low voltage/.test(
      n,
    )
  )
    return "LOW_VOLTAGE";
  return "POWER";
}

export default function CompiledGraphViewer() {
  const mount = useRef<HTMLDivElement | null>(null),
    runtime = useRef<any>(null);
  const [graph, setGraph] = useState<Graph | null>(null),
    [active, setActive] = useState<Layer[]>(["L0", "L1", "L2", "L3", "L4"]),
    [selected, setSelected] = useState<Entity | null>(null),
    [registry, setRegistry] = useState<ElectricalModelConfig[]>(
      DEFAULT_ELECTRICAL_MODEL_REGISTRY,
    ),
    [renderRevision, setRenderRevision] = useState(0);
  const [environment, setEnvironment] = useState<EnvironmentMode>("CINEMATIC"),
    [systemMode, setSystemMode] = useState<SystemMode>("ALL"),
    [exploded, setExploded] = useState(false),
    [xray, setXray] = useState(false),
    [isolatedFloor, setIsolatedFloor] = useState("ALL"),
    [ghostOthers, setGhostOthers] = useState(true),
    [labels, setLabels] = useState(true),
    [focusRevision, setFocusRevision] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("stratum_compiled_graph");
      if (raw) setGraph(JSON.parse(raw));
      const reg = localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
      if (reg) setRegistry(normalizeElectricalModelRegistry(JSON.parse(reg)));
    } catch {}
    const refresh = () => {
      try {
        const reg = localStorage.getItem(ELECTRICAL_MODEL_REGISTRY_STORAGE_KEY);
        setRegistry(
          reg
            ? normalizeElectricalModelRegistry(JSON.parse(reg))
            : DEFAULT_ELECTRICAL_MODEL_REGISTRY,
        );
        setRenderRevision((v) => v + 1);
      } catch {}
    };
    window.addEventListener(registryEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(registryEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const counts = useMemo(
    () =>
      graph
        ? (["L0", "L1", "L2", "L3", "L4"] as Layer[]).reduce(
            (a, l) => ({
              ...a,
              [l]:
                l === "L0"
                  ? graph.sources.length
                  : graph.entities.filter((e) => e.layer === l).length,
            }),
            {} as Record<Layer, number>,
          )
        : null,
    [graph],
  );
  const recognized = useMemo(
    () =>
      graph?.entities.filter(
        (e) =>
          e.layer === "L2" &&
          e.kind !== "line" &&
          resolveElectricalComponent(e.name),
      ).length || 0,
    [graph],
  );
  const mapped = useMemo(
    () =>
      graph?.entities.filter((e) => {
        if (e.layer !== "L2" || e.kind === "line") return false;
        const def = resolveElectricalComponent(e.name);
        return (
          !!def &&
          !!registry.find((r) => r.componentKey === def.key)?.modelUrl.trim()
        );
      }).length || 0,
    [graph, registry],
  );
  const levels = useMemo(
    () =>
      graph
        ? [
            ...new Map(
              graph.sources.map((s) => [
                s.floor || "L1",
                Number(s.elevation || 0),
              ]),
            ).entries(),
          ].sort((a, b) => a[1] - b[1])
        : [],
    [graph],
  );
  const rooms = useMemo(
    () => graph?.entities.filter((e) => e.kind === "room-boundary").length || 0,
    [graph],
  );
  const visibleElectrical = useMemo(
    () =>
      graph?.entities.filter(
        (e) =>
          e.layer === "L2" &&
          e.kind !== "line" &&
          (systemMode === "ALL" || entitySystem(e) === systemMode),
      ).length || 0,
    [graph, systemMode],
  );
  useEffect(() => {
    const r = runtime.current;
    if (!r || !selected) return;
    const { camera, controls, THREE } = r;
    const floorIndex = Math.max(
        0,
        levels.findIndex(([f]) => f === (selected.floor || "L1")),
      ),
      extra = exploded ? floorIndex * 2.8 : 0,
      target = new THREE.Vector3(
        selected.x,
        Number(selected.z || 0) + extra + 1,
        selected.y,
      ),
      start = camera.position.clone(),
      dest = target.clone().add(new THREE.Vector3(4.8, 3.6, 5.6));
    let p = 0;
    const move = () => {
      p = Math.min(1, p + 0.055);
      const k = 1 - Math.pow(1 - p, 3);
      camera.position.lerpVectors(start, dest, k);
      controls.target.lerp(target, 0.16);
      controls.update();
      if (p < 1) requestAnimationFrame(move);
    };
    move();
  }, [focusRevision]);
  useEffect(() => {
    if (!graph || !mount.current) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      if (disposed || !mount.current) return;
      const cinematic = environment === "CINEMATIC",
        night = environment === "NIGHT",
        emergency = environment === "EMERGENCY",
        host = mount.current,
        scene = new THREE.Scene();
      scene.background = new THREE.Color(
        night
          ? 0x010407
          : emergency
            ? 0x100403
            : cinematic
              ? 0x03090e
              : 0x07131d,
      );
      scene.fog = new THREE.FogExp2(
        scene.background.getHex(),
        cinematic ? 0.009 : 0.013,
      );
      const camera = new THREE.PerspectiveCamera(
        42,
        host.clientWidth / Math.max(host.clientHeight, 1),
        0.1,
        600,
      );
      camera.position.set(22, 19, 25);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = night ? 0.82 : emergency ? 1 : 1.08;
      host.replaceChildren(renderer.domElement);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 3, 0);
      controls.maxPolarAngle = Math.PI * 0.49;
      scene.add(
        new THREE.HemisphereLight(
          night ? 0x4e7390 : 0xbfe8ff,
          0x02080d,
          night ? 0.7 : 1.7,
        ),
      );
      scene.add(
        new THREE.AmbientLight(
          emergency ? 0xff3b22 : 0x88a6b5,
          emergency ? 0.35 : 0.55,
        ),
      );
      const key = new THREE.DirectionalLight(
        emergency ? 0xff9c80 : 0xffffff,
        night ? 1.2 : 3.5,
      );
      key.position.set(14, 24, 10);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -30;
      key.shadow.camera.right = 30;
      key.shadow.camera.top = 30;
      key.shadow.camera.bottom = -30;
      scene.add(key);
      const rim = new THREE.PointLight(
        emergency ? 0xff351f : 0x38dba0,
        night ? 18 : 35,
        55,
        2,
      );
      rim.position.set(-12, 8, -12);
      scene.add(rim);
      const blue = new THREE.PointLight(
        emergency ? 0xff7b35 : 0x4aa6ff,
        night ? 14 : 28,
        50,
        2,
      );
      blue.position.set(12, 7, 10);
      scene.add(blue);
      runtime.current = { camera, controls, THREE };
      const groups: Record<Layer, any> = {
        L0: new THREE.Group(),
        L1: new THREE.Group(),
        L2: new THREE.Group(),
        L3: new THREE.Group(),
        L4: new THREE.Group(),
      };
      (Object.keys(groups) as Layer[]).forEach((l) => {
        groups[l].visible = active.includes(l);
        scene.add(groups[l]);
      });
      const clickable: any[] = [];
      const loader = new GLTFLoader(),
        entityById = new Map(graph.entities.map((e) => [e.id, e])),
        floorIndex = new Map(levels.map(([f], i) => [f, i]));
      const floorExtra = (floor?: string) =>
          exploded ? (floorIndex.get(floor || "L1") || 0) * 2.8 : 0,
        displayY = (e: Entity) => Number(e.z || 0) + floorExtra(e.floor),
        floorVisible = (floor?: string) =>
          isolatedFloor === "ALL" || (floor || "L1") === isolatedFloor,
        ghostFloor = (floor?: string) =>
          isolatedFloor !== "ALL" &&
          (floor || "L1") !== isolatedFloor &&
          ghostOthers;
      const mat = (
        color: number,
        emissive = 0,
        metal = 0.28,
        rough = 0.46,
        opacity = 1,
      ) =>
        new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.16,
          metalness: metal,
          roughness: rough,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity > 0.2,
        });
      const steel = (o = 1) => mat(0x607887, 0, 0.65, 0.28, o),
        dark = (o = 1) => mat(0x17242d, 0, 0.55, 0.38, o),
        physical = (o = 1) =>
          mat(
            emergency ? 0xd76635 : colors.L2,
            emergency ? 0x4b1307 : 0x251305,
            0.42,
            0.34,
            o,
          );
      function opacityFor(e: Entity) {
        return ghostFloor(e.floor) ? 0.16 : 1;
      }
      function makeLabel(e: Entity) {
        if (
          !labels ||
          e.layer !== "L2" ||
          !resolveElectricalComponent(e.name) ||
          (!floorVisible(e.floor) && !ghostOthers)
        )
          return;
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "rgba(4,14,21,.78)";
        ctx.roundRect(4, 4, 504, 120, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(75,214,164,.72)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#dff7ff";
        ctx.font = "700 30px system-ui";
        ctx.fillText(e.name.slice(0, 28), 22, 48);
        ctx.fillStyle = "#7fdcb8";
        ctx.font = "22px system-ui";
        ctx.fillText(
          `${e.floor || "L1"} · ${e.zone || "UNRESOLVED"}`.slice(0, 38),
          22,
          86,
        );
        const texture = new THREE.CanvasTexture(canvas),
          sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
              depthTest: false,
              opacity: ghostFloor(e.floor) ? 0.28 : 1,
            }),
          );
        sprite.scale.set(3.6, 0.9, 1);
        sprite.position.set(e.x, displayY(e) + 2.45, e.y);
        groups.L2.add(sprite);
      }
      for (const s of graph.sources) {
        if (!floorVisible(s.floor) && !ghostOthers) continue;
        const y = Number(s.elevation || 0) + floorExtra(s.floor) - 0.05,
          plane = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 17),
            new THREE.MeshStandardMaterial({
              color: 0x102532,
              transparent: true,
              opacity: ghostFloor(s.floor) ? 0.035 : cinematic ? 0.1 : 0.18,
              side: THREE.DoubleSide,
              roughness: 0.7,
              metalness: 0.15,
              depthWrite: false,
            }),
          );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = y;
        plane.receiveShadow = true;
        groups.L0.add(plane);
      }
      function tag(root: any, e: Entity) {
        root.userData.entity = e;
        root.traverse((node: any) => {
          if (node.isMesh) {
            node.userData.entity = e;
            node.castShadow = !ghostFloor(e.floor);
            node.receiveShadow = true;
            clickable.push(node);
          }
        });
      }
      function wallBetween(
        a: XY,
        b: XY,
        y: number,
        height = 2.75,
        opacity = 0.7,
      ) {
        const dx = b.x - a.x,
          dz = b.y - a.y,
          len = Math.hypot(dx, dz);
        if (len < 0.03) return;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(len, height, 0.11),
          new THREE.MeshPhysicalMaterial({
            color: 0x6f8795,
            metalness: 0.08,
            roughness: 0.66,
            transparent: true,
            opacity: xray ? Math.min(0.13, opacity) : opacity,
            depthWrite: !xray,
          }),
        );
        wall.position.set((a.x + b.x) / 2, y + height / 2, (a.y + b.y) / 2);
        wall.rotation.y = -Math.atan2(dz, dx);
        wall.castShadow = !xray;
        wall.receiveShadow = true;
        groups.L1.add(wall);
      }
      function roomSurface(e: Entity) {
        if (
          !e.vertices ||
          e.vertices.length < 3 ||
          (!floorVisible(e.floor) && !ghostOthers)
        )
          return;
        const op = ghostFloor(e.floor) ? 0.06 : cinematic ? 0.2 : 0.3,
          shape = new THREE.Shape();
        e.vertices.forEach((p, i) =>
          i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y),
        );
        shape.closePath();
        const floor = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshPhysicalMaterial({
            color: 0x173748,
            transparent: true,
            opacity: xray ? Math.min(0.08, op) : op,
            metalness: 0.18,
            roughness: 0.58,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        floor.rotation.x = Math.PI / 2;
        floor.position.y = displayY(e) + 0.012;
        floor.receiveShadow = true;
        groups.L1.add(floor);
        for (let i = 0; i < e.vertices.length; i++)
          wallBetween(
            e.vertices[i],
            e.vertices[(i + 1) % e.vertices.length],
            displayY(e),
            2.75,
            ghostFloor(e.floor) ? 0.1 : 0.62,
          );
      }
      function procedural(e: Entity, shape: string) {
        if (systemMode !== "ALL" && entitySystem(e) !== systemMode) return;
        if (!floorVisible(e.floor) && !ghostOthers) return;
        const op = opacityFor(e),
          root = new THREE.Group();
        root.position.set(e.x, displayY(e), e.y);
        root.rotation.y = THREE.MathUtils.degToRad(-(e.rotation || 0));
        root.scale.setScalar(
          Math.max(0.2, Math.min(1.7, (e.scale || 1) * 0.68)),
        );
        const mesh = (
          geo: any,
          material: any,
          p: [number, number, number] = [0, 0, 0],
          r: [number, number, number] = [0, 0, 0],
        ) => {
          const m = new THREE.Mesh(geo, material);
          m.position.set(...p);
          m.rotation.set(...r);
          root.add(m);
          return m;
        };
        if (shape === "transformer") {
          mesh(
            new THREE.BoxGeometry(1.7, 1.6, 1.22),
            physical(op),
            [0, 0.83, 0],
          );
          for (let x = -0.48; x <= 0.48; x += 0.48)
            mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.52, 14), steel(op), [
              x,
              1.9,
              0,
            ]);
          for (let x = -0.68; x <= 0.68; x += 0.23)
            mesh(new THREE.BoxGeometry(0.055, 1.2, 1.38), dark(op), [
              x,
              0.83,
              0,
            ]);
        } else if (
          ["cabinet", "panel", "meter", "breaker", "rack", "junction"].includes(
            shape,
          )
        ) {
          const w = shape === "panel" ? 0.9 : shape === "rack" ? 1.22 : 1.35,
            h = shape === "breaker" ? 1.05 : 1.9,
            d = shape === "panel" ? 0.38 : 0.76;
          mesh(new THREE.BoxGeometry(w, h, d), physical(op), [0, h / 2, 0]);
          mesh(new THREE.BoxGeometry(w * 0.77, h * 0.72, 0.045), dark(op), [
            0,
            h / 2,
            d / 2 + 0.03,
          ]);
          if (shape === "meter")
            mesh(
              new THREE.CylinderGeometry(0.19, 0.19, 0.07, 24),
              new THREE.MeshBasicMaterial({
                color: 0x8bd5ea,
                transparent: op < 1,
                opacity: op,
              }),
              [0, h * 0.62, d / 2 + 0.07],
              [Math.PI / 2, 0, 0],
            );
        } else if (shape === "generator") {
          mesh(new THREE.BoxGeometry(2.15, 0.26, 1.18), dark(op), [0, 0.14, 0]);
          mesh(
            new THREE.BoxGeometry(1.15, 1.12, 0.96),
            physical(op),
            [0.28, 0.82, 0],
          );
          mesh(
            new THREE.CylinderGeometry(0.37, 0.37, 0.98, 18),
            steel(op),
            [-0.68, 0.78, 0],
            [0, 0, Math.PI / 2],
          );
        } else if (shape === "evse") {
          mesh(
            new THREE.BoxGeometry(0.58, 1.34, 0.4),
            physical(op),
            [0, 0.75, 0],
          );
          mesh(
            new THREE.BoxGeometry(0.34, 0.29, 0.04),
            new THREE.MeshBasicMaterial({
              color: 0x3be39a,
              transparent: op < 1,
              opacity: op,
            }),
            [0, 1, 0.22],
          );
        } else if (shape === "motor") {
          mesh(
            new THREE.CylinderGeometry(0.48, 0.48, 1.1, 22),
            physical(op),
            [0, 0.58, 0],
            [0, 0, Math.PI / 2],
          );
          mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.58, 12),
            steel(op),
            [0.8, 0.58, 0],
            [0, 0, Math.PI / 2],
          );
        } else if (shape === "battery") {
          for (let x = -0.58; x <= 0.58; x += 0.39)
            mesh(new THREE.BoxGeometry(0.31, 0.86, 0.52), physical(op), [
              x,
              0.47,
              0,
            ]);
          mesh(
            new THREE.BoxGeometry(1.58, 0.12, 0.66),
            dark(op),
            [0, 0.065, 0],
          );
        } else if (shape === "solar") {
          mesh(
            new THREE.BoxGeometry(1.9, 0.08, 1.16),
            new THREE.MeshStandardMaterial({
              color: 0x255c86,
              metalness: 0.55,
              roughness: 0.25,
              transparent: op < 1,
              opacity: op,
            }),
            [0, 0.86, 0],
            [-0.35, 0, 0],
          );
        } else if (shape === "receptacle") {
          mesh(new THREE.BoxGeometry(0.34, 0.48, 0.1), steel(op), [0, 0.29, 0]);
        } else if (shape === "light") {
          mesh(
            new THREE.CylinderGeometry(0.52, 0.19, 0.3, 20),
            new THREE.MeshStandardMaterial({
              color: 0xe8e2c0,
              emissive: 0xffe8a3,
              emissiveIntensity: 1.4,
              transparent: op < 1,
              opacity: op,
            }),
            [0, 1.6, 0],
          );
        } else if (shape === "sensor") {
          mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.4, 14),
            physical(op),
            [0, 0.74, 0],
          );
          mesh(
            new THREE.SphereGeometry(0.16, 14, 10),
            new THREE.MeshBasicMaterial({
              color: 0x54dca0,
              transparent: op < 1,
              opacity: op,
            }),
            [0, 1, 0],
          );
        } else
          mesh(
            new THREE.BoxGeometry(0.78, 0.84, 0.78),
            physical(op),
            [0, 0.44, 0],
          );
        tag(root, e);
        groups.L2.add(root);
        makeLabel(e);
      }
      function addCandidateMarker(e: Entity) {
        if (!floorVisible(e.floor) && !ghostOthers) return;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.026, 8, 32),
          new THREE.MeshBasicMaterial({
            color: colors.L4,
            transparent: true,
            opacity: ghostFloor(e.floor) ? 0.12 : 0.88,
          }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(e.x, displayY(e) + 0.04, e.y);
        groups.L4.add(ring);
      }
      function loadEquipment(e: Entity) {
        if (systemMode !== "ALL" && entitySystem(e) !== systemMode) return;
        if (!floorVisible(e.floor) && !ghostOthers) return;
        const def = resolveElectricalComponent(e.name),
          cfg = def ? registry.find((r) => r.componentKey === def.key) : null;
        if (
          !def ||
          !cfg?.modelUrl.trim() ||
          !["GLB", "GLTF"].includes(cfg.format)
        ) {
          procedural(e, def?.twinShape || "cabinet");
          return;
        }
        loader.load(
          cfg.modelUrl,
          (gltf) => {
            if (disposed) return;
            const root = gltf.scene,
              op = opacityFor(e);
            root.position.set(
              e.x + cfg.offset[0],
              displayY(e) + cfg.offset[1],
              e.y + cfg.offset[2],
            );
            root.scale.setScalar(cfg.scale * (e.scale || 1));
            root.rotation.set(
              THREE.MathUtils.degToRad(cfg.rotation[0]),
              THREE.MathUtils.degToRad(cfg.rotation[1] - (e.rotation || 0)),
              THREE.MathUtils.degToRad(cfg.rotation[2]),
            );
            root.traverse((n: any) => {
              if (n.isMesh && op < 1 && n.material) {
                n.material = n.material.clone();
                n.material.transparent = true;
                n.material.opacity = op;
                n.material.depthWrite = false;
              }
            });
            tag(root, e);
            groups.L2.add(root);
            makeLabel(e);
          },
          undefined,
          () => {
            if (!disposed) procedural(e, def.twinShape);
          },
        );
      }
      for (const e of graph.entities) {
        if (e.kind === "room-boundary" || e.kind === "floor-boundary") {
          roomSurface(e);
          continue;
        }
        if (!floorVisible(e.floor) && !ghostOthers) continue;
        if (
          e.kind === "wall-segment" &&
          Number.isFinite(e.x2) &&
          Number.isFinite(e.y2)
        ) {
          wallBetween(
            { x: e.x, y: e.y },
            { x: e.x2!, y: e.y2! },
            displayY(e),
            2.75,
            ghostFloor(e.floor) ? 0.1 : 0.62,
          );
          continue;
        }
        if (e.kind === "door-opening") {
          const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 2.1, 0.08),
            new THREE.MeshStandardMaterial({
              color: 0x9ec6d8,
              transparent: true,
              opacity: ghostFloor(e.floor) ? 0.08 : xray ? 0.12 : 0.32,
            }),
          );
          door.position.set(e.x, displayY(e) + 1.05, e.y);
          door.rotation.y = THREE.MathUtils.degToRad(-(e.rotation || 0));
          groups.L1.add(door);
          continue;
        }
        if (
          e.kind === "line" &&
          Number.isFinite(e.x2) &&
          Number.isFinite(e.y2)
        ) {
          if (
            e.layer === "L3" &&
            systemMode !== "ALL" &&
            entitySystem(e) !== systemMode
          )
            continue;
          const pts = [
            new THREE.Vector3(e.x, displayY(e) + 0.05, e.y),
            new THREE.Vector3(
              e.x2!,
              Number(e.z2 ?? e.z ?? 0) + floorExtra(e.floor) + 0.05,
              e.y2!,
            ),
          ];
          groups[e.layer].add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({
                color: colors[e.layer],
                transparent: true,
                opacity: ghostFloor(e.floor) ? 0.1 : 0.8,
              }),
            ),
          );
          continue;
        }
        if (e.layer === "L2") {
          loadEquipment(e);
          continue;
        }
        if (e.layer === "L4") {
          addCandidateMarker(e);
          continue;
        }
        if (e.kind === "room-label") {
          const marker = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.55, 10),
            new THREE.MeshBasicMaterial({
              color: 0x72d6ff,
              transparent: true,
              opacity: ghostFloor(e.floor) ? 0.12 : 0.8,
            }),
          );
          marker.position.set(e.x, displayY(e) + 0.3, e.y);
          marker.userData.entity = e;
          groups.L1.add(marker);
          clickable.push(marker);
        }
      }
      for (const link of graph.links || []) {
        if (link.type !== "SAME_TAG") continue;
        const a = entityById.get(link.from),
          b = entityById.get(link.to);
        if (
          !a ||
          !b ||
          (!floorVisible(a.floor) && !ghostOthers) ||
          (!floorVisible(b.floor) && !ghostOthers)
        )
          continue;
        const pts = [
          new THREE.Vector3(a.x, displayY(a) + 0.5, a.y),
          new THREE.Vector3(b.x, displayY(b) + 0.5, b.y),
        ];
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineDashedMaterial({
            color: 0xa57cff,
            dashSize: 0.28,
            gapSize: 0.15,
            transparent: true,
            opacity: 0.62,
          }),
        );
        line.computeLineDistances();
        groups.L3.add(line);
      }
      for (const [floor, base] of levels) {
        if (!floorVisible(floor) && !ghostOthers) continue;
        const grid = new THREE.GridHelper(32, 32, 0x234b61, 0x0c2430);
        grid.position.y = base + floorExtra(floor);
        grid.material.transparent = true;
        grid.material.opacity = ghostFloor(floor) ? 0.06 : 0.24;
        scene.add(grid);
      }
      const bounds = new THREE.Box3();
      graph.entities
        .filter((e) => floorVisible(e.floor) || ghostOthers)
        .forEach((e) => {
          bounds.expandByPoint(new THREE.Vector3(e.x, displayY(e), e.y));
          if (Number.isFinite(e.x2) && Number.isFinite(e.y2))
            bounds.expandByPoint(
              new THREE.Vector3(
                e.x2!,
                Number(e.z2 ?? e.z ?? 0) + floorExtra(e.floor),
                e.y2!,
              ),
            );
        });
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3()),
          size = bounds.getSize(new THREE.Vector3()),
          span = Math.max(size.x, size.y, size.z, 10);
        controls.target.copy(center);
        camera.position.set(
          center.x + span * 0.9,
          center.y + span * 0.72 + 5,
          center.z + span,
        );
        controls.update();
      }
      const ray = new THREE.Raycaster(),
        pointer = new THREE.Vector2();
    const pick = (ev: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(clickable, true)[0];
        let node: any = hit?.object;
        while (node && !node.userData?.entity) node = node.parent;
        if (node?.userData?.entity) setSelected(node.userData.entity);
      };
      renderer.domElement.addEventListener("pointerup", pick);
      renderer.domElement.addEventListener("dblclick", pick);
      const resize = () => {
        if (!host.clientWidth || !host.clientHeight) return;
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      let f = 0,
        t = 0;
      const animate = () => {
        t += 0.004;
        if (cinematic) {
          rim.intensity = 32 + Math.sin(t) * 4;
          blue.intensity = 25 + Math.cos(t * 0.8) * 3;
        }
        if (emergency) {
          rim.intensity = 25 + Math.sin(t * 5) * 15;
        }
        controls.update();
        renderer.render(scene, camera);
        f = requestAnimationFrame(animate);
      };
      animate();
      cleanup = () => {
        runtime.current = null;
        cancelAnimationFrame(f);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerup", pick);
        renderer.domElement.removeEventListener("dblclick", pick);
        controls.dispose();
        renderer.dispose();
        host.replaceChildren();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [
    graph,
    active,
    registry,
    renderRevision,
    environment,
    systemMode,
    exploded,
    xray,
    isolatedFloor,
    ghostOthers,
    labels,
  ]);
  if (!graph) return null;
  const selectedDef = selected
      ? resolveElectricalComponent(selected.name)
      : null,
    selectedCfg = selectedDef
      ? registry.find((r) => r.componentKey === selectedDef.key)
      : null;
  return (
    <section
      style={{
        border: "1px solid #1b3a50",
        borderRadius: 20,
        overflow: "hidden",
        background: "#07111b",
        marginBottom: 18,
        boxShadow: "0 20px 60px rgba(0,0,0,.28)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: "1px solid #17334a",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">
            STRATUM TWIN · INFRASTRUCTURE OPERATING VIEW
          </div>
          <strong>{graph.sources.map((s) => s.name).join(" · ")}</strong>
          <div className="muted">
            parser v{graph.version} · {levels.length} level(s) · {rooms} room(s)
            · {visibleElectrical}/{recognized || visibleElectrical} visible
            electrical objects · {mapped} registry models
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="ghost" href="/component-library">
            3D model registry
          </Link>
          <Link className="ghost" href="/compiler">
            Recompile sources
          </Link>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 7,
          padding: "10px 12px",
          overflowX: "auto",
          borderBottom: "1px solid #17334a",
          alignItems: "center",
        }}
      >
        <button
          className="ghost"
          aria-pressed={exploded}
          onClick={() => setExploded((v) => !v)}
        >
          {exploded ? "Collapse building" : "Explode building"}
        </button>
        <button
          className="ghost"
          aria-pressed={xray}
          onClick={() => setXray((v) => !v)}
        >
          {xray ? "Disable X-Ray" : "X-Ray architecture"}
        </button>
        <button
          className="ghost"
          aria-pressed={labels}
          onClick={() => setLabels((v) => !v)}
        >
          {labels ? "Hide smart labels" : "Show smart labels"}
        </button>
        <select
          aria-label="Environment mode"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as EnvironmentMode)}
          style={{
            background: "#08131d",
            color: "#c9e3ee",
            border: "1px solid #28465f",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          <option value="CINEMATIC">Presentation · Cinematic</option>
          <option value="ENGINEERING">Engineering Dark</option>
          <option value="NIGHT">Night Operations</option>
          <option value="EMERGENCY">Emergency Mode</option>
        </select>
        <select
          aria-label="System isolation"
          value={systemMode}
          onChange={(e) => setSystemMode(e.target.value as SystemMode)}
          style={{
            background: "#08131d",
            color: "#c9e3ee",
            border: "1px solid #28465f",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          {systemOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Floor isolation"
          value={isolatedFloor}
          onChange={(e) => setIsolatedFloor(e.target.value)}
          style={{
            background: "#08131d",
            color: "#c9e3ee",
            border: "1px solid #28465f",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          <option value="ALL">All floors</option>
          {levels.map(([f]) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {isolatedFloor !== "ALL" && (
          <button
            className="ghost"
            aria-pressed={ghostOthers}
            onClick={() => setGhostOthers((v) => !v)}
          >
            {ghostOthers ? "Hide other floors" : "Ghost other floors"}
          </button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "9px 12px",
          overflowX: "auto",
          borderBottom: "1px solid #17334a",
        }}
      >
        {(["L0", "L1", "L2", "L3", "L4"] as Layer[]).map((l) => (
          <button
            key={l}
            onClick={() =>
              setActive((v) =>
                v.includes(l) ? v.filter((x) => x !== l) : [...v, l],
              )
            }
            style={{
              flex: "0 0 auto",
              border: "1px solid #28465f",
              background: active.includes(l) ? "#0b2d20" : "#08131d",
              color: active.includes(l) ? "#7ce5ae" : "#7590a5",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
            }}
          >
            <b>{l}</b> {layerNames[l]} · {counts?.[l] || 0}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(260px,360px)",
        }}
        className="compiled-twin-grid"
      >
        <div style={{ position: "relative" }}>
          <div
            ref={mount}
            style={{ height: "min(74vh,780px)", minHeight: 500 }}
          />
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              pointerEvents: "none",
              background: "rgba(4,13,20,.78)",
              backdropFilter: "blur(12px)",
              border: "1px solid #245069",
              borderRadius: 14,
              padding: "12px 14px",
              minWidth: 190,
            }}
          >
            <div className="eyebrow">INFRASTRUCTURE HUD</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "5px 14px",
                fontSize: 12,
                marginTop: 7,
              }}
            >
              <span>VIEW</span>
              <b>{exploded ? "EXPLODED" : "ASSEMBLED"}</b>
              <span>SYSTEM</span>
              <b>{systemMode.replace("_", " ")}</b>
              <span>ROOMS</span>
              <b>{rooms}</b>
              <span>ELECTRICAL</span>
              <b>{visibleElectrical}</b>
              <span>3D MODELS</span>
              <b>{mapped}</b>
              <span>RELATIONSHIPS</span>
              <b>{graph.links?.length || 0}</b>
            </div>
          </div>
        </div>
        <aside
          style={{
            padding: 16,
            borderLeft: "1px solid #17334a",
            overflow: "auto",
          }}
        >
          <div className="eyebrow">SOURCE-GROUNDED OBJECT</div>
          {selected ? (
            <>
              <h2 style={{ marginBottom: 6 }}>{selected.name}</h2>
              <div className="subtitle">
                {selected.kind} · {selected.layer} {layerNames[selected.layer]}
              </div>
              <div className="button-row" style={{ margin: "12px 0" }}>
                <button
                  className="action"
                  onClick={() => setFocusRevision((v) => v + 1)}
                >
                  Focus equipment
                </button>
              </div>
              <div className="passport-facts">
                <div>
                  <span>Source</span>
                  <strong>{selected.source}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{Math.round(selected.confidence * 100)}%</strong>
                </div>
                <div>
                  <span>Floor</span>
                  <strong>{selected.floor || "L1"}</strong>
                </div>
                <div>
                  <span>Elevation Z</span>
                  <strong>{Number(selected.z || 0).toFixed(2)} m</strong>
                </div>
                <div>
                  <span>Plan X/Y</span>
                  <strong>
                    {selected.x.toFixed(2)} / {selected.y.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Rotation</span>
                  <strong>{Number(selected.rotation || 0).toFixed(1)}°</strong>
                </div>
                <div>
                  <span>Room / zone</span>
                  <strong>{selected.zone || "Unresolved"}</strong>
                </div>
                {selectedDef && (
                  <>
                    <div>
                      <span>Component class</span>
                      <strong>{selectedDef.name}</strong>
                    </div>
                    <div>
                      <span>System</span>
                      <strong>
                        {entitySystem(selected).replace("_", " ")}
                      </strong>
                    </div>
                    <div>
                      <span>3D representation</span>
                      <strong>
                        {selectedCfg?.modelUrl
                          ? `${selectedCfg.format} registry model`
                          : `${selectedDef.twinShape} fallback`}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="subtitle">
              Click source-placed equipment or room markers. Double-click and
              then use Focus equipment for a cinematic inspection view.
            </p>
          )}
          <div className="notice" style={{ marginTop: 16 }}>
            <strong>VISUAL FOUNDATION V2</strong>
            <span>
              Exploded floors, floor isolation/ghosting, X-Ray architecture,
              system isolation, smart equipment labels, environment modes and
              focus navigation are now bound to the reconstructed engineering
              graph.
            </span>
          </div>
          <div className="notice" style={{ marginTop: 10 }}>
            <strong>DIR BOUNDARY</strong>
            <span>
              Visual effects never become the engineering source of truth.
              Validation and approval still precede asset registration and DIR
              finalization.
            </span>
          </div>
        </aside>
      </div>
      <style jsx>{`
        @media (max-width: 820px) {
          .compiled-twin-grid {
            grid-template-columns: 1fr !important;
          }
          .compiled-twin-grid aside {
            border-left: 0 !important;
            border-top: 1px solid #17334a;
          }
        }
      `}</style>
    </section>
  );
}

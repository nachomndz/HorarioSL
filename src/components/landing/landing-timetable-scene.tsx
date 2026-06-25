"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const SUBJECT_COLORS: Record<string, number> = {
  MAT: 0x3b82f6,
  LEN: 0xef4444,
  ING: 0x22c55e,
  NAT: 0x14b8a6,
  SOC: 0xf59e0b,
  EF: 0x8b5cf6,
};

/** 5 days × 4 session rows (recess row uses gray) */
const GRID: (string | "RECREO")[][] = [
  ["MAT", "LEN", "ING", "NAT", "MAT"],
  ["LEN", "MAT", "SOC", "ING", "LEN"],
  ["ING", "NAT", "MAT", "EF", "SOC"],
  ["RECREO", "RECREO", "RECREO", "RECREO", "RECREO"],
  ["NAT", "EF", "LEN", "MAT", "ING"],
];

const COLS = 5;
const ROWS = GRID.length;
const CELL_W = 1.05;
const CELL_D = 0.55;
const GAP = 0.12;

interface CellAnim {
  mesh: THREE.Mesh;
  targetY: number;
  startY: number;
  delay: number;
  done: boolean;
}

export function LandingTimetableScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = -0.55;
    group.rotation.y = 0.35;
    scene.add(group);

    const cells: CellAnim[] = [];
    const gridW = COLS * (CELL_W + GAP) - GAP;
    const gridH = ROWS * (CELL_D + GAP) - GAP;
    const startX = -gridW / 2 + CELL_W / 2;
    const startZ = -gridH / 2 + CELL_D / 2;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const key = GRID[row][col];
        const isRecess = key === "RECREO";
        const heightBox = isRecess ? 0.08 : 0.22 + Math.random() * 0.08;
        const geo = new THREE.BoxGeometry(CELL_W, heightBox, CELL_D);
        const color = isRecess ? 0xc8c4bc : (SUBJECT_COLORS[key] ?? 0x1b556e);
        const mat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: isRecess ? 0.45 : 0.88,
          roughness: 0.55,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const x = startX + col * (CELL_W + GAP);
        const z = startZ + row * (CELL_D + GAP);
        const targetY = heightBox / 2;
        const startY = reducedMotion ? targetY : targetY + 4 + row * 0.3;
        mesh.position.set(x, startY, z);
        group.add(mesh);

        cells.push({
          mesh,
          targetY,
          startY,
          delay: reducedMotion ? 0 : col * 0.08 + row * 0.12,
          done: reducedMotion,
        });
      }
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    const dir = new THREE.DirectionalLight(0xffffff, 0.65);
    dir.position.set(4, 8, 6);
    scene.add(ambient, dir);

    const accentLight = new THREE.PointLight(0x5a9bb8, 0.4, 20);
    accentLight.position.set(-3, 5, 4);
    scene.add(accentLight);

    let targetX = 0;
    let targetY = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion) return;
      targetX = (e.clientX / window.innerWidth - 0.5) * 1.2;
      targetY = -(e.clientY / window.innerHeight - 0.5) * 0.6;
    };
    window.addEventListener("pointermove", onPointerMove);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (!reducedMotion) {
        for (const cell of cells) {
          if (!cell.done) {
            const localT = Math.max(0, Math.min(1, (t - cell.delay) / 0.55));
            const eased = 1 - Math.pow(1 - localT, 3);
            cell.mesh.position.y = cell.startY + (cell.targetY - cell.startY) * eased;
            if (localT >= 1) cell.done = true;
          } else {
            cell.mesh.position.y =
              cell.targetY + Math.sin(t * 1.2 + cell.mesh.position.x) * 0.025;
          }
        }

        group.rotation.y = 0.35 + Math.sin(t * 0.15) * 0.06;
        camera.position.x += (targetX - camera.position.x) * 0.04;
        camera.position.y += (4.5 + targetY - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 hidden opacity-50 sm:block md:opacity-60"
      aria-hidden
    />
  );
}

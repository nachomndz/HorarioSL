"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 140;
const PRIMARY = 0xd4cfc4;
const ACCENT = 0x5a9bb8;

export function LandingScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 22);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const drift: THREE.Vector3[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 36;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      drift.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.018,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.008
        )
      );
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: PRIMARY,
        size: 0.14,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    scene.add(particles);

    const linePositions: number[] = [];
    const maxDist = 4.5;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < maxDist * maxDist) {
          linePositions.push(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
            positions[j * 3],
            positions[j * 3 + 1],
            positions[j * 3 + 2]
          );
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.14 })
    );
    scene.add(lines);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9, 0.04, 8, 64),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.2 })
    );
    ring.rotation.x = Math.PI / 2.4;
    scene.add(ring);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.03, 8, 48),
      new THREE.MeshBasicMaterial({ color: PRIMARY, transparent: true, opacity: 0.15 })
    );
    innerRing.rotation.x = Math.PI / 3;
    innerRing.rotation.y = Math.PI / 6;
    scene.add(innerRing);

    let targetX = 0;
    let targetY = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 3;
      targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      if (!reducedMotion) {
        const pos = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pos[i * 3] += drift[i].x;
          pos[i * 3 + 1] += drift[i].y;
          pos[i * 3 + 2] += drift[i].z;
          if (Math.abs(pos[i * 3]) > 18) drift[i].x *= -1;
          if (Math.abs(pos[i * 3 + 1]) > 10) drift[i].y *= -1;
          if (Math.abs(pos[i * 3 + 2]) > 6) drift[i].z *= -1;
        }
        particleGeo.attributes.position.needsUpdate = true;

        ring.rotation.z += 0.0012;
        innerRing.rotation.z -= 0.0008;
        particles.rotation.y += 0.0004;

        camera.position.x += (targetX - camera.position.x) * 0.03;
        camera.position.y += (targetY - camera.position.y) * 0.03;
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
      particleGeo.dispose();
      (particles.material as THREE.Material).dispose();
      lineGeo.dispose();
      (lines.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      innerRing.geometry.dispose();
      (innerRing.material as THREE.Material).dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[1] opacity-90"
      aria-hidden
    />
  );
}

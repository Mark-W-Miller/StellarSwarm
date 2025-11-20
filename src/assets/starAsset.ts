import {
  BufferGeometry,
  BufferAttribute,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  CylinderGeometry,
  SphereGeometry,
  Vector3,
  Group
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PlanetModel, StarModel } from "../model/starModel";
import { HOME_STAR_ID } from "../model/starModel";

export class StarAsset {
  private geometry: SphereGeometry;
  private selectionMaterial: MeshStandardMaterial;

  constructor() {
    this.geometry = new SphereGeometry(1, 16, 16);
    this.selectionMaterial = new MeshStandardMaterial({
      color: new Color("#ffffff"),
      emissive: new Color("#ffffff"),
      emissiveIntensity: 0.3,
      opacity: 0.35,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      roughness: 0.2,
      metalness: 0
    });
  }

  createMesh(star: StarModel) {
    const isHome = star.id === HOME_STAR_ID;
    const baseColor = new Color(isHome ? "#14532d" : star.color);
    const material = new MeshStandardMaterial({
      color: baseColor.clone(),
      emissive: baseColor.clone(),
      emissiveIntensity: star.brightness,
      roughness: isHome ? 0.95 : 0.25,
      metalness: isHome ? 0.02 : 0.05
    });
    const geom = isHome ? this.createHomeClusterGeometry(star.radius) : this.createGeometryForStar(star);
    const mesh = new Mesh(geom, material);
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    if (isHome) {
      const edges = new EdgesGeometry(mesh.geometry);
      const wire = new LineSegments(edges, new LineBasicMaterial({ color: new Color("#000000"), transparent: true, opacity: 0.9 }));
      mesh.add(wire);
    }
    return mesh;
  }

  createSelectionMesh(star: StarModel, subwarpScale: number) {
    let geom: BufferGeometry;
    if (star.id === HOME_STAR_ID) {
      // Use the same clustered shape as the home star, slightly inflated.
      geom = this.createHomeClusterGeometry(star.radius * 1.1);
    } else {
      // Enclose the full system: grow to the largest orbit (or subwarp grid) with margin.
      const maxOrbit =
        star.orbits && star.orbits.length > 0
          ? Math.max(...star.orbits.map((o) => o.radius))
          : star.radius * subwarpScale * 1.3;
      const radiusX = maxOrbit * 1.1;
      const radiusZ = maxOrbit * 1.1;
      const radiusY = Math.max(star.radius * 1.5, maxOrbit * 0.2);
      const sphere = new SphereGeometry(1, 14, 14);
      sphere.scale(radiusX, radiusY, radiusZ);
      geom = sphere;
    }

    const mesh = new Mesh(geom, this.selectionMaterial.clone());
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    return mesh;
  }

  tick(star: StarModel, mesh: Mesh, atten = 1) {
    const level = Math.max(0, Math.min(1, star.brightness));
    const mat = mesh.material as MeshStandardMaterial;
    mat.emissiveIntensity = level;
    mat.emissive.set(star.color);
    mat.color.set(star.color).multiplyScalar(level);
    mat.needsUpdate = true;
  }

  private createGeometryForStar(star: StarModel) {
    const geom = this.geometry.clone();
    const scale = star.radius * 0.6; // shrink non-home stars for display only
    geom.scale(scale, scale, scale);
    return geom;
  }

  createCornerMarkerGeometry() {
    const geom = this.geometry.clone();
    geom.scale(8, 8, 8);
    return geom;
  }

  createSubwarpGrid(
    star: StarModel,
    scale: number,
    spokes = 12,
    orbitColors?: string[],
    orbitRadii?: number[]
  ) {
    const radiusX = star.radius * scale * 1.3;
    const radiusZ = star.radius * scale * 0.7;
    const planeY = star.radius * 0.2;
    const step = Math.max(star.radius / 2, 1);
    const group = new Group();
    const tubeRadius = Math.max(star.radius * 0.025, 0.04);

    const orbitCount = orbitRadii?.length ?? 0;
    if (orbitCount > 0) {
      for (let ri = 0; ri < orbitCount; ri += 1) {
        const baseR = orbitRadii![ri];
        const rx = baseR * 0.8;
        const rz = rx * (0.7 / 1.3);
        const circumference = Math.PI * (rx + rz);
        const segments = Math.max(12, Math.floor(circumference / step));
        const c = new Color(orbitColors ? orbitColors[Math.min(ri, orbitColors.length - 1)] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, c));
        }
      }
    } else {
      const ringCount = Math.max(4, Math.floor((Math.max(radiusX, radiusZ) - step) / step));
      for (let ri = 1; ri <= ringCount; ri += 1) {
        const colorIdx = Math.min(ri - 1, (orbitColors?.length ?? 1) - 1);
        const t = ri / ringCount;
        const rx = step + (radiusX - step) * t;
        const rz = step + (radiusZ - step) * t;
        const circumference = Math.PI * (rx + rz);
        const segments = Math.max(12, Math.floor(circumference / step));
        const c = new Color(orbitColors ? orbitColors[colorIdx] : star.color);
        for (let i = 0; i < segments; i += 1) {
          const theta1 = (i / segments) * Math.PI * 2;
          const theta2 = ((i + 1) / segments) * Math.PI * 2;
          const y = planeY;
          const p1 = new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1));
          const p2 = new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2));
          group.add(this.makeTube(p1, p2, tubeRadius, c));
        }
      }
    }

    // Radial spokes on the same orbital plane
    for (let i = 0; i < spokes; i += 1) {
      const theta = (i / spokes) * Math.PI * 2;
      const maxRx = orbitCount > 0 ? orbitRadii![orbitCount - 1] * 0.8 : radiusX;
      const maxRz = orbitCount > 0 ? maxRx * (0.7 / 1.3) : radiusZ;
      const x = maxRx * Math.cos(theta);
      const z = maxRz * Math.sin(theta);
      const p1 = new Vector3(0, planeY, 0);
      const p2 = new Vector3(x, planeY, z);
      group.add(this.makeTube(p1, p2, tubeRadius, new Color(star.color)));
    }
    return group;
  }

  private makeTube(start: Vector3, end: Vector3, radius: number, color: Color) {
    const dir = new Vector3().subVectors(end, start);
    const len = dir.length();
    const geom = new CylinderGeometry(radius, radius, len, 10, 1, true);
    const mat = new MeshStandardMaterial({
      color: color.clone(),
      emissive: color.clone(),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true
    });
    const mesh = new Mesh(geom, mat);
    mesh.userData.baseColor = color.clone();
    // Orient cylinder along dir (default cylinder is Y-up centered at origin)
    const midpoint = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  getSpinSpeed(star: StarModel) {
    if (star.id === HOME_STAR_ID) {
      return (Math.PI * 2) / 60;
    }
    // Larger stars spin slower; sync by size
    const base = (Math.PI * 2) / 60;
    return base / Math.max(1, star.radius / 3);
  }

  createPlanetMesh(planet: PlanetModel, orbitRadius: number) {
    const geom = new SphereGeometry(planet.radius * 1.5, 10, 10);
    const baseColor = new Color(planet.color);
    const mat = new MeshStandardMaterial({
      color: baseColor.clone(),
      emissive: baseColor.clone(),
      emissiveIntensity: 1,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true
    });
    const mesh = new Mesh(geom, mat);
    mesh.position.set(orbitRadius, 0, 0);
    mesh.userData.baseColor = baseColor;
    return mesh;
  }

  private createHomeClusterGeometry(radius: number) {
    const sphereRadius = radius * 0.3;
    const shellRadius = sphereRadius * 2; // ensure neighbors kiss the center sphere

    const dirs: [number, number, number][] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
      [1, 1, 1],
      [1, 1, -1],
      [1, -1, 1],
      [1, -1, -1],
      [-1, 1, 1],
      [-1, 1, -1],
      [-1, -1, 1],
      [-1, -1, -1]
    ];

    const geoms: BufferGeometry[] = [];
    const centerGeom = new SphereGeometry(sphereRadius, 14, 14);
    geoms.push(centerGeom);

    dirs.forEach(([x, y, z]) => {
      const len = Math.hypot(x, y, z);
      const nx = (x / len) * shellRadius;
      const ny = (y / len) * shellRadius;
      const nz = (z / len) * shellRadius;
      const g = new SphereGeometry(sphereRadius, 14, 14);
      g.translate(nx, ny, nz);
      geoms.push(g);
    });

    return mergeGeometries(geoms, false) as BufferGeometry;
  }
}

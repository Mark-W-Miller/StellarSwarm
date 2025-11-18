import {
  BufferGeometry,
  BufferAttribute,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3
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
      roughness: 0.2,
      metalness: 0
    });
  }

  createMesh(star: StarModel) {
    const material = new MeshStandardMaterial({
      color: new Color(star.color),
      emissive: new Color(star.color),
      emissiveIntensity: star.brightness,
      roughness: 0.25,
      metalness: 0.05
    });
    const mesh = new Mesh(this.createGeometryForStar(star), material);
    mesh.position.set(star.position.x, star.position.y, star.position.z);
    if (star.id === HOME_STAR_ID) {
      const edges = new EdgesGeometry(mesh.geometry);
      const wire = new LineSegments(
        edges,
        new LineBasicMaterial({ color: new Color("#ffffff"), transparent: true, opacity: 0.7 })
      );
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
    const intensity = atten * star.brightness * (0.6 + 0.4 * Math.sin(star.phase));
    const mat = mesh.material as MeshStandardMaterial;
    mat.emissiveIntensity = intensity;
  }

  private createGeometryForStar(star: StarModel) {
    if (star.id === HOME_STAR_ID) {
      return this.createHomeClusterGeometry(star.radius);
    }
    const geom = this.geometry.clone();
    geom.scale(star.radius, star.radius, star.radius);
    return geom;
  }

  createCornerMarkerGeometry() {
    const geom = this.geometry.clone();
    geom.scale(8, 8, 8);
    return geom;
  }

  createSubwarpGrid(star: StarModel, scale: number, spokes = 12, orbitColors?: string[]) {
    const radiusX = star.radius * scale * 1.3;
    const radiusZ = star.radius * scale * 0.7;
    const planeY = star.radius * 0.2;
    const step = Math.max(star.radius / 2, 1);
    const points: Vector3[] = [];
    const colors: number[] = [];

    const ringCount = Math.max(4, Math.floor((Math.max(radiusX, radiusZ) - step) / step));
    for (let ri = 1; ri <= ringCount; ri += 1) {
      const t = ri / ringCount;
      const rx = step + (radiusX - step) * t;
      const rz = step + (radiusZ - step) * t;
      const circumference = Math.PI * (rx + rz);
      const segments = Math.max(12, Math.floor(circumference / step));
      for (let i = 0; i < segments; i += 1) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        const y = planeY;
        points.push(
          new Vector3(rx * Math.cos(theta1), y, rz * Math.sin(theta1)),
          new Vector3(rx * Math.cos(theta2), y, rz * Math.sin(theta2))
        );
        const colorIdx = Math.min(ri - 1, Math.max((orbitColors?.length ?? 1) - 1, 0));
        const col = orbitColors ? orbitColors[colorIdx] : star.color;
        const c = new Color(col);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }

    // Radial spokes on the same orbital plane
    for (let i = 0; i < spokes; i += 1) {
      const theta = (i / spokes) * Math.PI * 2;
      const x = radiusX * Math.cos(theta);
      const z = radiusZ * Math.sin(theta);
      points.push(new Vector3(0, planeY, 0), new Vector3(x, planeY, z));
      const colorIdx = Math.max(Math.min(ringCount - 1, (orbitColors?.length ?? 1) - 1), 0);
      const col = orbitColors ? orbitColors[colorIdx] : star.color;
      const c = new Color(col);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    const geom = new BufferGeometry().setFromPoints(points);
    if (colors.length > 0) {
      geom.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    }
    const mat = new LineBasicMaterial({
      color: new Color(star.color),
      opacity: 1,
      transparent: false,
      vertexColors: colors.length > 0
    });
    // Hint thicker lines; may be constrained by platform/GL.
    (mat as any).linewidth = 20;
    return new LineSegments(geom, mat);
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
    const mat = new MeshStandardMaterial({
      color: new Color(planet.color),
      emissive: new Color(planet.color),
      emissiveIntensity: 1,
      roughness: 0.6,
      metalness: 0.1
    });
    const mesh = new Mesh(geom, mat);
    mesh.position.set(orbitRadius, 0, 0);
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

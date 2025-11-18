import { BufferGeometry, Camera, Color, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";
import type { StarModel } from "../model/starModel";
import { StarAsset } from "./starAsset";

type StarInstance = {
  model: StarModel;
  mesh: Mesh;
  selection?: Mesh;
  subwarp?: LineSegments;
  planets?: {
    orbitRadius: number;
    mesh: Mesh;
    angularSpeed: number;
    angle: number;
    group: Group;
    majorAxis: number;
    minorAxis: number;
  }[];
};

export class ArenaAsset {
  group: Group;
  private stars: StarInstance[] = [];
  private starAsset: StarAsset;
  private starMap = new Map<Mesh, StarModel>();
  private cornerMarkers: Mesh[] = [];
  private subwarpScale = 4;
  private subwarpSpokes = 12;
  private spinRateFactor = 1;
  private spinLookup = new Map<string, number>();

  constructor(private model: ArenaModel, private camera: Camera) {
    this.group = new Group();

    this.starAsset = new StarAsset();

    this.buildBounds();
    this.buildCornerMarkers();
    if (model.stars.length > 0) {
      model.stars.forEach((star) => this.addStar(star));
    }
  }

  addStar(star: StarModel) {
    const mesh = this.starAsset.createMesh(star);
    const initialRot = Math.random() * Math.PI * 2;
    mesh.rotation.y = initialRot;
    this.group.add(mesh);
    const subwarp = this.starAsset.createSubwarpGrid(star, this.subwarpScale, this.subwarpSpokes);
    subwarp.rotation.y = initialRot;
    subwarp.position.set(star.position.x, star.position.y, star.position.z);
    this.group.add(subwarp);
    const planets = this.buildPlanets(star);
    planets.forEach((p) => this.group.add(p.group));
    this.stars.push({ model: star, mesh, subwarp, planets });
    this.starMap.set(mesh, star);
    this.spinLookup.set(star.id, this.starAsset.getSpinSpeed(star));
  }

  resetStars(nextStars: StarModel[]) {
    this.stars.forEach((s) => {
      this.group.remove(s.mesh);
      if (s.selection) this.group.remove(s.selection);
      if (s.subwarp) this.group.remove(s.subwarp);
      s.planets?.forEach((p) => this.group.remove(p.group));
    });
    this.stars = [];
    this.starMap.clear();
    nextStars.forEach((star) => this.addStar(star));
  }

  tick() {
    this.stars.forEach(({ model, mesh, subwarp, planets }) => {
      const dist = mesh.position.distanceTo(this.camera.position);
      const intensity = Math.max(0.3, 1 / Math.max(1, dist));
      this.starAsset.tick(model, mesh, intensity);
      if (planets && planets.length > 0) {
        planets.forEach((p) => {
          // Planet orbits advance at a steady rate; then inherit the system (star) rotation.
          p.angle = (p.angle + Math.abs(p.angularSpeed)) % (Math.PI * 2);
          const x = p.majorAxis * Math.cos(p.angle);
          const z = p.minorAxis * Math.sin(p.angle);
          const pos = new Vector3(x, 0, z).applyAxisAngle(new Vector3(0, 1, 0), mesh.rotation.y);
          p.mesh.position.copy(pos);
        });
      }
    });
  }

  intersectStars(raycaster: Raycaster) {
    const intersects = raycaster.intersectObjects([...this.stars.map((s) => s.mesh), ...this.cornerMarkers], false);
    return intersects.map((hit) => ({
      mesh: hit.object as Mesh,
      star: this.starMap.get(hit.object as Mesh)
    }));
  }

  addSelection(starId: string) {
    const target = this.stars.find((s) => s.model.id === starId);
    if (!target || target.selection) return;
    const selection = this.starAsset.createSelectionMesh(target.model, this.subwarpScale);
    target.selection = selection;
    this.group.add(selection);
  }

  removeSelection(starId: string) {
    const target = this.stars.find((s) => s.model.id === starId);
    if (!target || !target.selection) return;
    this.group.remove(target.selection);
    target.selection = undefined;
  }

  isSelected(starId: string) {
    const target = this.stars.find((s) => s.model.id === starId);
    return Boolean(target?.selection);
  }

  getCornerMarkers() {
    return this.cornerMarkers.map((mesh) => ({ mesh, position: mesh.position.clone() }));
  }

  setSubwarpScale(scale: number) {
    this.subwarpScale = scale;
    this.refreshSubwarp();
  }

  setSubwarpSpokes(spokes: number) {
    this.subwarpSpokes = Math.max(3, Math.floor(spokes));
    this.refreshSubwarp();
  }

  setSpinRate(simSpeed: number, maxSpeed: number) {
    const norm = Math.max(0, simSpeed - 1) / Math.max(1, maxSpeed - 1);
    this.spinRateFactor = norm;
  }

  attenuationForStar(star: StarModel) {
    const camPos = this.camera?.position ?? new Vector3();
    const dist = new Vector3(star.position.x, star.position.y, star.position.z).distanceTo(camPos);
    return Math.max(0.3, 1 / Math.max(1, dist));
  }

  setAttenuation(value: number) {
    // this.attenuation = Math.max(0.01, value);
  }

  private refreshSubwarp() {
    this.stars.forEach((s) => {
      if (s.subwarp) this.group.remove(s.subwarp);
      s.planets?.forEach((p) => this.group.remove(p.group));
      const subwarp = this.starAsset.createSubwarpGrid(s.model, this.subwarpScale, this.subwarpSpokes);
      subwarp.position.copy(s.mesh.position);
      s.subwarp = subwarp;
      s.planets = this.buildPlanets(s.model);
      s.planets?.forEach((p) => this.group.add(p.group));
      this.group.add(subwarp);
    });
  }

  private buildPlanets(star: StarModel) {
    const planets: {
      orbitRadius: number;
      mesh: Mesh;
      angularSpeed: number;
      angle: number;
      group: Group;
      majorAxis: number;
      minorAxis: number;
    }[] = [];
    const halfBounds = Math.sqrt(
      this.model.half.x * this.model.half.x +
        this.model.half.y * this.model.half.y +
        this.model.half.z * this.model.half.z
    ) * 0.5;
    const dist = Math.sqrt(
      star.position.x * star.position.x +
        star.position.y * star.position.y +
        star.position.z * star.position.z
    );
    const allowPlanets = dist <= halfBounds || star.id === "home-star";
    if (!star.orbits) return planets;
    star.orbits.forEach((orbit, idx) => {
      if (!orbit.hasPlanet || !orbit.planet || !allowPlanets) return;
      const planetMesh = this.starAsset.createPlanetMesh(orbit.planet, orbit.radius);
      const planetGroup = new Group();
      planetGroup.position.set(star.position.x, star.position.y, star.position.z);
      planetGroup.add(planetMesh);
      const speedScale =
        star.orbits && star.orbits.length > 0 ? 1 + (star.orbits.length - idx) * 0.25 : 1;
      const angularSpeed = orbit.planet.angularSpeed * speedScale;
      const majorAxis = orbit.radius * 0.8;
      const minorAxis = majorAxis * (0.7 / 1.3); // match subwarp flatten ratio
      planets.push({
        orbitRadius: orbit.radius,
        mesh: planetMesh,
        angularSpeed,
        angle: orbit.planet.angle,
        group: planetGroup,
        majorAxis,
        minorAxis
      });
    });
    return planets;
  }

  private buildCornerMarkers() {
    const markerGeom = this.starAsset.createCornerMarkerGeometry();
    const markerMat = new MeshStandardMaterial({
      color: new Color("#ff3b30"),
      emissive: new Color("#ff3b30"),
      emissiveIntensity: 0.5
    });
    const corners: Vector3[] = [
      new Vector3(this.model.half.x, this.model.half.y, this.model.half.z),
      new Vector3(this.model.half.x, this.model.half.y, -this.model.half.z),
      new Vector3(this.model.half.x, -this.model.half.y, this.model.half.z),
      new Vector3(this.model.half.x, -this.model.half.y, -this.model.half.z),
      new Vector3(-this.model.half.x, this.model.half.y, this.model.half.z),
      new Vector3(-this.model.half.x, this.model.half.y, -this.model.half.z),
      new Vector3(-this.model.half.x, -this.model.half.y, this.model.half.z),
      new Vector3(-this.model.half.x, -this.model.half.y, -this.model.half.z)
    ];
    corners.forEach((pos) => {
      const mesh = new Mesh(markerGeom.clone(), markerMat.clone());
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.cornerMarkers.push(mesh);
    });
  }

  private buildBounds() {
    const { half, height, width, depth, voxelSize } = this.model;

    // Bounding box lines.
    const points = [
      new Vector3(-half.x, -height / 2, -half.z),
      new Vector3(half.x, -height / 2, -half.z),

      new Vector3(half.x, -height / 2, -half.z),
      new Vector3(half.x, -height / 2, half.z),

      new Vector3(half.x, -height / 2, half.z),
      new Vector3(-half.x, -height / 2, half.z),

      new Vector3(-half.x, -height / 2, half.z),
      new Vector3(-half.x, -height / 2, -half.z),

      // top
      new Vector3(-half.x, height / 2, -half.z),
      new Vector3(half.x, height / 2, -half.z),

      new Vector3(half.x, height / 2, -half.z),
      new Vector3(half.x, height / 2, half.z),

      new Vector3(half.x, height / 2, half.z),
      new Vector3(-half.x, height / 2, half.z),

      new Vector3(-half.x, height / 2, half.z),
      new Vector3(-half.x, height / 2, -half.z),

      // verticals
      new Vector3(-half.x, -height / 2, -half.z),
      new Vector3(-half.x, height / 2, -half.z),

      new Vector3(half.x, -height / 2, -half.z),
      new Vector3(half.x, height / 2, -half.z),

      new Vector3(half.x, -height / 2, half.z),
      new Vector3(half.x, height / 2, half.z),

      new Vector3(-half.x, -height / 2, half.z),
      new Vector3(-half.x, height / 2, half.z)
    ];

    const boxGeometry = new BufferGeometry().setFromPoints(points);
    const boxMaterial = new LineBasicMaterial({ color: new Color("#f5d000") });
    this.group.add(new LineSegments(boxGeometry, boxMaterial));

    // Grid lines on faces.
    const gridColor = new Color("#7a6400");
    const gridGeomPoints: Vector3[] = [];

    const linesX = Math.max(1, Math.floor(width / voxelSize / 10));
    const linesY = Math.max(1, Math.floor(height / voxelSize / 10));
    const linesZ = Math.max(1, Math.floor(depth / voxelSize / 10));
    const stepX = width / linesX;
    const stepY = height / linesY;
    const stepZ = depth / linesZ;

    // Front/back (XY planes at +/- z).
    for (let i = 1; i < linesX; i += 1) {
      const x = -half.x + i * stepX;
      gridGeomPoints.push(new Vector3(x, -half.y, half.z), new Vector3(x, half.y, half.z));
      gridGeomPoints.push(new Vector3(x, -half.y, -half.z), new Vector3(x, half.y, -half.z));
    }
    for (let i = 1; i < linesY; i += 1) {
      const y = -half.y + i * stepY;
      gridGeomPoints.push(new Vector3(-half.x, y, half.z), new Vector3(half.x, y, half.z));
      gridGeomPoints.push(new Vector3(-half.x, y, -half.z), new Vector3(half.x, y, -half.z));
    }

    // Left/right (YZ planes at +/- x).
    for (let i = 1; i < linesZ; i += 1) {
      const z = -half.z + i * stepZ;
      gridGeomPoints.push(new Vector3(-half.x, -half.y, z), new Vector3(-half.x, half.y, z));
      gridGeomPoints.push(new Vector3(half.x, -half.y, z), new Vector3(half.x, half.y, z));
    }
    for (let i = 1; i < linesY; i += 1) {
      const y = -half.y + i * stepY;
      gridGeomPoints.push(new Vector3(-half.x, y, -half.z), new Vector3(-half.x, y, half.z));
      gridGeomPoints.push(new Vector3(half.x, y, -half.z), new Vector3(half.x, y, half.z));
    }

    // Top/bottom (XZ planes at +/- y).
    for (let i = 1; i < linesX; i += 1) {
      const x = -half.x + i * stepX;
      gridGeomPoints.push(new Vector3(x, -half.y, -half.z), new Vector3(x, -half.y, half.z));
      gridGeomPoints.push(new Vector3(x, half.y, -half.z), new Vector3(x, half.y, half.z));
    }
    for (let i = 1; i < linesZ; i += 1) {
      const z = -half.z + i * stepZ;
      gridGeomPoints.push(new Vector3(-half.x, -half.y, z), new Vector3(half.x, -half.y, z));
      gridGeomPoints.push(new Vector3(-half.x, half.y, z), new Vector3(half.x, half.y, z));
    }

    const gridGeometry = new BufferGeometry().setFromPoints(gridGeomPoints);
    const gridMaterial = new LineBasicMaterial({ color: gridColor });
    this.group.add(new LineSegments(gridGeometry, gridMaterial));
  }
}

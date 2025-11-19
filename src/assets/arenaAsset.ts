import { BufferGeometry, Camera, Color, EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import type { ArenaModel } from "../model/arenaModel";
import type { StarModel } from "../model/starModel";
import { HOME_STAR_ID } from "../model/starModel";
import { StarAsset } from "./starAsset";
import { log } from "../ui/log/logger";

type PlanetInstance = {
  orbitRadius: number;
  mesh: Mesh;
  angularSpeed: number;
  angle: number;
  group: Group;
  majorAxis: number;
  minorAxis: number;
  planeY: number;
  planetId?: string;
};

type StarInstance = {
  model: StarModel;
  mesh: Mesh;
  systemSpeed: number;
  selection?: Mesh;
  subwarp?: Group;
  planets?: {
    orbitRadius: number;
    mesh: Mesh;
    angularSpeed: number;
    angle: number;
    group: Group;
    majorAxis: number;
    minorAxis: number;
    planeY: number;
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
  private homePlanetMeshes = new Map<Mesh, { starId: string; planetId: string }>();

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
    // One full rotation per minute at 10 ticks/sec => 2π / (60*10) per tick.
    const systemSpeed = (Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1)) / (60 * 10);
    mesh.rotation.y = initialRot;
    this.group.add(mesh);
    log("ARENA_ASSET_INIT", JSON.stringify({
      id: star.id,
      pos: star.position,
      radius: star.radius,
      color: star.color,
      orbits: star.orbits?.map((o) => ({
        radius: o.radius,
        hasPlanet: o.hasPlanet,
        planet: o.planet ? { id: o.planet.id, color: o.planet.color, radius: o.planet.radius } : null
      }))
    }, null, 2));
    const orbitColors = star.orbits?.map((o) => (o.planet ? o.planet.color : star.color)) ?? undefined;
    const orbitRadii = star.orbits?.map((o) => o.radius);
    const subwarp = this.starAsset.createSubwarpGrid(
      star,
      this.subwarpScale,
      this.subwarpSpokes,
      orbitColors,
      orbitRadii
    );
    subwarp.rotation.y = initialRot;
    subwarp.position.set(star.position.x, star.position.y, star.position.z);
    this.group.add(subwarp);
    const planets = this.buildPlanets(star);
    planets.forEach((p) => this.group.add(p.group));
    this.stars.push({ model: star, mesh, subwarp, planets, systemSpeed });
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

  setBrightnessForAll(value: number) {
    const home = this.stars.find((s) => s.model.id === HOME_STAR_ID) || this.stars[0];
    if (!home) return;
    const homePos = new Vector3(home.model.position.x, home.model.position.y, home.model.position.z);
    const distances = this.stars.map((s) => {
      const pos = new Vector3(s.model.position.x, s.model.position.y, s.model.position.z);
      return pos.distanceTo(homePos);
    });
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const logData: { id: string; distance: number; brightness: number }[] = [];
    this.stars.forEach((s, idx) => {
      let normalized = max === min ? 1 : 1 - (distances[idx] - min) / (max - min);
      const quantized = Math.floor(normalized * 15) / 15;
      s.model.brightness = quantized;
      logData.push({ id: s.model.id, distance: distances[idx], brightness: quantized });
    });
    log("UI", "Brightness distribution", logData);
  }

  tick() {
    this.stars.forEach(({ model: starModel, mesh, subwarp, planets, systemSpeed }) => {
      const dist = mesh.position.distanceTo(this.camera.position);
      const intensity = Math.max(0.3, 1 / Math.max(1, dist));
      this.starAsset.tick(starModel, mesh, intensity);
      mesh.rotation.y += systemSpeed;
      if (subwarp) {
        subwarp.rotation.y = mesh.rotation.y;
        this.applySubwarpBrightness(subwarp, starModel.brightness);
      }
      if (planets && planets.length > 0) {
        planets.forEach((p) => {
          // Planet orbits advance at a steady rate; then inherit the system (star) rotation.
          p.angle = (p.angle + p.angularSpeed) % (Math.PI * 2);
          const x = p.majorAxis * Math.cos(p.angle);
          const z = p.minorAxis * Math.sin(p.angle);
          const pos = new Vector3(x, p.planeY, z).applyAxisAngle(new Vector3(0, 1, 0), mesh.rotation.y);
          p.mesh.position.copy(pos);
          const pm = p.mesh.material as MeshStandardMaterial;
          const baseColor = (p.mesh.userData.baseColor as Color) ?? pm.color.clone();
          const level = Math.max(0, Math.min(1, starModel.brightness));
          pm.emissiveIntensity = level;
          pm.color.copy(baseColor).multiplyScalar(level);
          pm.emissive.copy(baseColor);
          pm.opacity = level;
          pm.transparent = true;
          pm.needsUpdate = true;
        });
      }
    });
  }

  private applySubwarpBrightness(subwarp: Group, level: number) {
    subwarp.traverse((obj) => {
      const m = (obj as Mesh).material as MeshStandardMaterial;
      if (m && (obj as Mesh).isMesh) {
        const base = ((obj as any).userData?.baseColor as Color) ?? m.color;
        const lvl = Math.max(0, Math.min(1, level));
        m.emissiveIntensity = lvl;
        m.color.copy(base).multiplyScalar(lvl);
        m.emissive.copy(base);
        m.opacity = lvl;
        m.transparent = true;
        m.needsUpdate = true;
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
    if (starId === HOME_STAR_ID) return;
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
    this.homePlanetMeshes.clear();
    this.stars.forEach((s) => {
      if (s.subwarp) this.group.remove(s.subwarp);
      s.planets?.forEach((p) => this.group.remove(p.group));
      const orbitColors = s.model.orbits?.map((o) => (o.planet ? o.planet.color : s.model.color));
      const orbitRadii = s.model.orbits?.map((o) => o.radius);
      const subwarp = this.starAsset.createSubwarpGrid(
        s.model,
        this.subwarpScale,
        this.subwarpSpokes,
        orbitColors,
        orbitRadii
      );
      subwarp.position.copy(s.mesh.position);
      s.subwarp = subwarp;
      s.planets = this.buildPlanets(s.model);
      s.planets?.forEach((p) => this.group.add(p.group));
      this.group.add(subwarp);
    });
  }

  private buildPlanets(star: StarModel) {
    const planets: PlanetInstance[] = [];
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
    const allowPlanets = dist <= halfBounds || star.id === HOME_STAR_ID;
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
      const planeY = star.radius * 0.2;
      const planetEntry: PlanetInstance = {
        orbitRadius: orbit.radius,
        mesh: planetMesh,
        angularSpeed,
        angle: orbit.planet.angle,
        group: planetGroup,
        majorAxis,
        minorAxis,
        planeY,
        planetId: orbit.planet.id
      };
      if (star.id === HOME_STAR_ID) {
        this.homePlanetMeshes.set(planetMesh, { starId: star.id, planetId: orbit.planet.id });
      }
      planets.push(planetEntry);
    });
    return planets;
  }

  private buildCornerMarkers() {
    const markerGeom = this.starAsset.createCornerMarkerGeometry();
    const markerMat = new MeshStandardMaterial({
      color: new Color("#ffffff"),
      emissive: new Color("#ffffff"),
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.25
    });
    const wireMat = new LineBasicMaterial({ color: new Color("#ff3b30") });
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
      const geom = markerGeom.clone();
      const mesh = new Mesh(geom, markerMat.clone());
      mesh.position.copy(pos);
      const wire = new LineSegments(new EdgesGeometry(geom), wireMat.clone());
      wire.position.copy(pos);
      this.group.add(mesh, wire);
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

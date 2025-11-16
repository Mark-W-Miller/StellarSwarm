import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from "three";

export class Board3D {
  constructor(container) {
    this.container = container;
    this.scene = new Scene();
    this.scene.background = new Color("#0c1020");
    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(6, 8, 10);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.appendChild(this.renderer.domElement);
    this.meshes = [];
    this.cube = null;

    this.resize = this.resize.bind(this);
    this.renderFrame = this.renderFrame.bind(this);

    this.buildScene();
    window.addEventListener("resize", this.resize);
    this.resize();
    this.renderFrame();
  }

  buildScene() {
    const ambient = new AmbientLight(0xffffff, 0.4);
    const key = new DirectionalLight(0xffffff, 0.7);
    key.position.set(5, 10, 5);
    this.scene.add(ambient, key);

    const grid = new GridHelper(8, 8, "#2e3a6b", "#1f2a47");
    grid.position.y = -0.01;
    this.scene.add(grid);

    const geom = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({
      color: "#6ba6ff",
      metalness: 0.1,
      roughness: 0.35
    });
    this.cube = new Mesh(geom, mat);
    this.cube.position.y = 0.5;
    this.scene.add(this.cube);
  }

  draw() {
    // Placeholder draw hook. Timing work happens in renderFrame.
  }

  resize() {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  }

  renderFrame() {
    if (this.cube) {
      this.cube.rotation.y += 0.01;
      this.cube.rotation.x += 0.005;
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.renderFrame);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.meshes.forEach((mesh) => mesh.geometry.dispose());
  }
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  BufferGeometry,
  Color,
  DirectionalLight,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  Texture,
  WebGLRenderer,
} from "three";
import type * as THREETypes from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import styles from "./model-viewer.module.css";

type ThreeModule = typeof THREETypes;

type ViewerSession = {
  reset(): void;
  setAutoRotate(on: boolean): void;
  setReducedMotion(on: boolean): void;
};

type Status = "idle" | "loading" | "ready" | "error";

class ViewerError extends Error {}

const COMPRESSED_EXTENSIONS = [
  "KHR_draco_mesh_compression",
  "EXT_meshopt_compression",
  "KHR_texture_basisu",
] as const;

const MODEL_BLOCKED = "BLOCKED_EXTERNAL_RESOURCE";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function readGlbJson(buffer: ArrayBuffer) {
  if (buffer.byteLength < 20) throw new ViewerError("模型文件过短，不是完整的 GLB。");
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  if (magic !== 0x46546c67 || version !== 2 || declaredLength > buffer.byteLength) {
    throw new ViewerError("模型文件不是有效的 glTF 2.0 二进制（GLB）。");
  }

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      if (offset + chunkLength > buffer.byteLength) {
        throw new ViewerError("模型结构信息被截断，GLB 可能已损坏。");
      }
      const json = new TextDecoder().decode(new Uint8Array(buffer, offset, chunkLength));
      try {
        return JSON.parse(json) as Record<string, unknown>;
      } catch {
        throw new ViewerError("模型结构信息无法解析，GLB 可能已损坏。");
      }
    }
    offset += chunkLength;
  }
  throw new ViewerError("模型缺少 glTF JSON 数据块。");
}

function validateGlb(buffer: ArrayBuffer, modelUrl: URL) {
  const json = readGlbJson(buffer);

  const required = Array.isArray(json.extensionsRequired)
    ? json.extensionsRequired.filter((item): item is string => typeof item === "string")
    : [];
  const used = Array.isArray(json.extensionsUsed)
    ? json.extensionsUsed.filter((item): item is string => typeof item === "string")
    : [];
  const blocked = [...new Set([...required, ...used])].filter((name) =>
    (COMPRESSED_EXTENSIONS as readonly string[]).includes(name),
  );
  if (blocked.length > 0) {
    throw new ViewerError(
      `该模型需要压缩扩展 ${blocked.join("、")}。预览不加载外部解码器，无法显示。`,
    );
  }

  const externalUris: string[] = [];
  for (const key of ["buffers", "images"] as const) {
    const entries = json[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !("uri" in entry)) continue;
      if (typeof entry.uri === "string") externalUris.push(entry.uri);
    }
  }

  for (const uri of externalUris) {
    if (/^(data|blob):/i.test(uri)) continue;
    let resolved: URL;
    try {
      resolved = new URL(uri, modelUrl);
    } catch {
      throw new ViewerError("模型内包含无法解析的资源地址。");
    }
    if (resolved.origin !== modelUrl.origin && resolved.origin !== window.location.origin) {
      throw new ViewerError(`模型引用了外部资源（${resolved.host}），预览已阻止加载。`);
    }
  }
}

async function fetchModel(src: string, signal: AbortSignal) {
  let modelUrl: URL;
  try {
    modelUrl = new URL(src, window.location.href);
  } catch {
    throw new ViewerError("模型地址无效。");
  }
  if (modelUrl.protocol !== "https:" && modelUrl.origin !== window.location.origin) {
    throw new ViewerError("三维模型地址必须使用 HTTPS，或与站点同源。");
  }

  let response: Response;
  try {
    response = await fetch(modelUrl.href, {
      signal,
      credentials: "same-origin",
      redirect: "follow",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ViewerError("模型文件读取失败，可能已过期、被移除或不允许跨域读取。");
  }

  if (!response.ok) {
    if (response.status === 410) {
      throw new ViewerError("模型访问链接已过期，请返回列表重新获取。");
    }
    if ([401, 403, 404].includes(response.status)) {
      throw new ViewerError("模型不可访问或已被移除。");
    }
    throw new ViewerError(`模型文件请求失败（HTTP ${response.status}）。`);
  }

  const finalUrl = new URL(response.url || modelUrl.href);
  const buffer = await response.arrayBuffer();
  validateGlb(buffer, finalUrl);

  return {
    buffer,
    modelUrl: finalUrl,
    basePath: new URL(".", finalUrl).href,
  };
}

function describeLoadError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (raw === MODEL_BLOCKED || /BLOCKED_EXTERNAL/i.test(raw)) {
    return "模型引用了未授权的外部资源，预览已阻止加载。";
  }
  if (/draco|ktx2|meshopt|basis/i.test(raw)) {
    return "该模型使用压缩几何或纹理，当前预览不加载外部解码器。";
  }
  if (/webgl/i.test(raw)) {
    return "当前浏览器未能启用 WebGL，无法显示三维预览。";
  }
  if (/dynamically imported|importing a module|module script/i.test(raw)) {
    return "三维渲染模块加载失败，请刷新页面后重试。";
  }
  return "GLB 解析失败，请确认文件完整且为标准 glTF 2.0 二进制。";
}

function hasRenderableMesh(root: Object3D) {
  let found = false;
  root.traverse((object) => {
    if (found) return;
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    if (position && position.count > 0) found = true;
  });
  return found;
}

function normalizeModel(THREE: ThreeModule, root: Object3D) {
  root.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return null;

  const size = bounds.getSize(new THREE.Vector3());
  const maximum = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maximum) || maximum < 1e-5) return null;

  root.scale.multiplyScalar(2.4 / maximum);
  root.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const bitmaps = new Set<ImageBitmap>();

  // three 的贴图不会替你释放底层 ImageBitmap：必须在 dispose 后单独 close。
  // 只收集从本模型材质可达的贴图，避免关闭共享的外部资源。
  const collectBitmap = (value: unknown) => {
    if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) bitmaps.add(value);
  };

  const collectTexture = (value: unknown) => {
    if (!value || typeof value !== "object" || !("isTexture" in value)) return;
    const texture = value as Texture;
    if (!texture.isTexture) return;
    textures.add(texture);
    collectBitmap(texture.image);
    collectBitmap(texture.source?.data);
  };

  root.traverse((object) => {
    // traverse 回调拿到的是混合对象；只有 Mesh 才有 geometry / material。
    const mesh = object as Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const skinned = object as SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton.boneTexture) {
      textures.add(skinned.skeleton.boneTexture);
    }
    const material = mesh.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) {
      materials.add(item);
      for (const value of Object.values(item)) collectTexture(value);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  bitmaps.forEach((bitmap) => bitmap.close());
}


type MountOptions = {
  THREE: ThreeModule;
  root: Object3D;
  host: HTMLDivElement;
  title: string;
  instructionsId: string;
  reducedMotion: boolean;
  createControls: (
    camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ) => OrbitControls<PerspectiveCamera>;
  createEnvironment: () => RoomEnvironment;
  onFatal: (message: string) => void;
  onAutoRotateChange: (on: boolean) => void;
};

function mountScene(options: MountOptions): { session: ViewerSession; cleanup: () => void } {
  const { THREE, root, host, title, instructionsId, onFatal, onAutoRotateChange } = options;

  let renderer: WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    disposeObject(root);
    throw new ViewerError("当前浏览器无法创建 WebGL 上下文，三维预览不可用。");
  }

  const canvas = renderer.domElement;
  const scene: Scene = new THREE.Scene();
  const camera: PerspectiveCamera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  let controls: OrbitControls<PerspectiveCamera> | null = null;
  let platform: Mesh | null = null;
  let platformMaterial: MeshStandardMaterial | null = null;
  let environmentTexture: Texture | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let themeObserver: MutationObserver | null = null;
  let frameId: number | null = null;
  let lastFrameTime = 0;
  let disposed = false;
  let paused = false;
  let onScreen = true;
  let reduced = options.reducedMotion;
  let homePosition = camera.position.clone();
  const homeTarget = new THREE.Vector3();

  function cancelFrame() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    lastFrameTime = 0;
  }

  function schedule() {
    if (disposed || paused || frameId !== null) return;
    frameId = requestAnimationFrame(tick);
  }

  function tick() {
    frameId = null;
    if (disposed || paused || !controls) return;
    const now = performance.now();
    const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0;
    lastFrameTime = now;
    let changed = false;
    try {
      changed = controls.update(delta);
      renderer.render(scene, camera);
    } catch {
      cancelFrame();
      onFatal("三维渲染中断，请点击“重试”重新建立场景。");
      return;
    }
    if (!disposed && !paused && (changed || controls.autoRotate)) schedule();
  }

  function applyPause() {
    if (disposed) return;
    const nextPaused = !onScreen || document.hidden;
    if (nextPaused === paused) return;
    paused = nextPaused;
    if (paused) cancelFrame();
    else schedule();
  }

  function reset() {
    camera.position.copy(homePosition);
    if (controls) {
      controls.target.copy(homeTarget);
      controls.update();
    } else {
      camera.lookAt(homeTarget);
    }
    schedule();
  }

  function setAutoRotate(on: boolean) {
    if (!controls) return;
    const next = on && !reduced;
    controls.autoRotate = next;
    if (next) schedule();
    else {
      controls.update();
      schedule();
    }
    if (next !== on) onAutoRotateChange(false);
  }

  function setReducedMotion(on: boolean) {
    reduced = on;
    if (controls) {
      controls.enableDamping = !on;
      if (on && controls.autoRotate) {
        controls.autoRotate = false;
        onAutoRotateChange(false);
      }
    }
    schedule();
  }

  function onPointerDown() {
    canvas.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!controls) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.06 : 0.14;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === "ArrowLeft") spherical.theta -= step;
    if (event.key === "ArrowRight") spherical.theta += step;
    if (event.key === "ArrowUp") spherical.phi -= step;
    if (event.key === "ArrowDown") spherical.phi += step;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI - 0.08);
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius,
      controls.minDistance,
      controls.maxDistance,
    );
    camera.position
      .copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    camera.lookAt(controls.target);
    controls.update();
    schedule();
  }

  function onWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !controls || !controls.autoRotate) return;
    controls.autoRotate = false;
    onAutoRotateChange(false);
    schedule();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    if (disposed) return;
    cancelFrame();
    if (controls) controls.autoRotate = false;
    onAutoRotateChange(false);
    onFatal("WebGL 上下文已丢失，预览已停止。点击“重试”重新加载。");
  }

  function readThemeColor(): Color {
    const value = getComputedStyle(host).getPropertyValue("--surface-2").trim() || "#ded7c9";
    try {
      return new THREE.Color(value);
    } catch {
      return new THREE.Color("#ded7c9");
    }
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelFrame();
    window.removeEventListener("keydown", onWindowKeyDown);
    document.removeEventListener("visibilitychange", applyPause);
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    themeObserver?.disconnect();
    themeObserver = null;
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    if (controls) {
      controls.removeEventListener("change", schedule);
      controls.dispose();
      controls = null;
    }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (platform) {
      platform.geometry.dispose();
      platform = null;
    }
    platformMaterial?.dispose();
    platformMaterial = null;
    environmentTexture?.dispose();
    environmentTexture = null;
    scene.traverse((object) => {
      const light = object as DirectionalLight;
      if (light.isDirectionalLight && light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    });
    disposeObject(root);
    renderer.dispose();
    try {
      renderer.forceContextLoss();
    } catch {
      // 上下文可能已丢失，无需再次释放。
    }
  }

  try {
    const width = Math.max(host.clientWidth, 320);
    const height = Math.max(host.clientHeight, 240);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y";
    canvas.style.cursor = "grab";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      `三维模型交互视图：${title}。聚焦后可用方向键旋转，Escape 停止自动旋转。`,
    );
    canvas.setAttribute("aria-describedby", instructionsId);
    canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown");

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 自包含的室内环境贴图：程序化生成，不请求任何外部 HDR。
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = options.createEnvironment();
    try {
      environmentTexture = pmrem.fromScene(environment, 0.04).texture;
      scene.environment = environmentTexture;
      scene.environmentIntensity = 0.55;
    } catch {
      // 环境光失败不影响基础照明，继续用直接光渲染。
      environmentTexture = null;
    } finally {
      pmrem.dispose();
      environment.dispose();
    }

    scene.add(new THREE.HemisphereLight(0xfff7ea, 0x303036, 1.1));
    const keyLight = new THREE.DirectionalLight(0xfff2df, 2.4);
    keyLight.position.set(-3.2, 5.4, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9db7ff, 0.55);
    fillLight.position.set(3.5, 1.5, -2.5);
    scene.add(fillLight);

    if (!hasRenderableMesh(root)) {
      throw new ViewerError("模型不含可显示的网格几何体。");
    }
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    const bounds = normalizeModel(THREE, root);
    if (!bounds) {
      throw new ViewerError("模型尺寸无效，无法建立预览。");
    }
    scene.add(root);

    const size = bounds.getSize(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.05);

    const shadowExtent = Math.max(radius * 1.8, 2);
    keyLight.shadow.camera.left = -shadowExtent;
    keyLight.shadow.camera.right = shadowExtent;
    keyLight.shadow.camera.top = shadowExtent;
    keyLight.shadow.camera.bottom = -shadowExtent;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = keyLight.position.length() + radius * 4 + 4;
    keyLight.shadow.camera.updateProjectionMatrix();

    platformMaterial = new THREE.MeshStandardMaterial({
      color: readThemeColor(),
      roughness: 0.94,
      metalness: 0.04,
    });
    platform = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62 + 0.35, 72),
      platformMaterial,
    );
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = bounds.min.y - 0.004;
    platform.receiveShadow = true;
    scene.add(platform);

    const fitDistance = () => {
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const narrowFov = Math.min(verticalFov, horizontalFov);
      return (radius / Math.sin(narrowFov / 2)) * 1.3;
    };
    const distance = fitDistance();
    camera.position
      .set(1, 0.62, 1.35)
      .normalize()
      .multiplyScalar(distance);
    camera.near = Math.max(distance / 120, 0.01);
    camera.far = Math.max(distance * 20, radius * 20, 50);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    homePosition = camera.position.clone();
    homeTarget.set(0, 0, 0);

    controls = options.createControls(camera, canvas);
    controls.enableDamping = !reduced;
    controls.dampingFactor = 0.075;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1.15;
    controls.minDistance = Math.max(radius * 0.35, distance * 0.12);
    controls.maxDistance = distance * 4.5;
    controls.target.copy(homeTarget);
    controls.update();
    // OrbitControls 默认把 touch-action 设为 none；这里保留纵向页面滚动。
    canvas.style.touchAction = "pan-y";
    controls.addEventListener("change", schedule);

    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("webglcontextlost", onContextLost);
    window.addEventListener("keydown", onWindowKeyDown);
    document.addEventListener("visibilitychange", applyPause);

    host.appendChild(canvas);

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        onScreen = entry ? entry.isIntersecting : true;
        applyPause();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(host);

    resizeObserver = new ResizeObserver(() => {
      if (disposed) return;
      const nextWidth = host.clientWidth;
      const nextHeight = host.clientHeight;
      if (!nextWidth || !nextHeight) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      // 容器变窄时把相机后撤，避免模型被视锥裁切；用户已有的缩放不被强行拉回。
      if (controls) {
        const offset = camera.position.clone().sub(controls.target);
        const required = fitDistance();
        if (offset.length() < required * 0.98) {
          camera.position.copy(controls.target).add(offset.setLength(required));
          controls.update();
        }
      }
      schedule();
    });
    resizeObserver.observe(host);

    themeObserver = new MutationObserver(() => {
      if (disposed) return;
      if (platformMaterial) platformMaterial.color.copy(readThemeColor());
      schedule();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    schedule();
  } catch (error) {
    cleanup();
    throw error;
  }

  return {
    session: { reset, setAutoRotate, setReducedMotion },
    cleanup,
  };
}

export function ModelViewer({ src, title }: { src: string; title: string }) {
  const instructionsId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ViewerSession | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const rotateRef = useRef(false);
  const reducedRef = useRef(false);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [rotateOn, setRotateOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = query.matches;
      setReducedMotion(query.matches);
      if (query.matches && rotateRef.current) {
        rotateRef.current = false;
        setRotateOn(false);
      }
      sessionRef.current?.setReducedMotion(query.matches);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      cleanupRef.current?.();
      cleanupRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  function teardownScene() {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
    sessionRef.current = null;
    rotateRef.current = false;
  }

  async function start() {
    const host = stageRef.current;
    if (!host) return;

    teardownScene();
    const generation = generationRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setErrorMessage("");
    setRotateOn(false);

    let root: Object3D | null = null;
    let mountAttempted = false;
    try {
      if (!hasWebGL()) {
        throw new ViewerError("当前浏览器未启用 WebGL，无法显示三维预览。");
      }

      const sourcePromise = fetchModel(src, controller.signal);
      const modulesPromise = Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/controls/OrbitControls.js"),
        import("three/addons/environments/RoomEnvironment.js"),
      ]);
      const [source, modules] = await Promise.all([sourcePromise, modulesPromise]);
      const [THREE, gltfModule, controlsModule, environmentModule] = modules;
      if (controller.signal.aborted || generation !== generationRef.current) return;

      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (/^(data|blob):/i.test(url)) return url;
        try {
          const resolved = new URL(url, window.location.href);
          if (resolved.origin === window.location.origin || resolved.origin === source.modelUrl.origin) {
            return resolved.href;
          }
        } catch {
          // Invalid nested resources remain blocked.
        }
        throw new Error(MODEL_BLOCKED);
      });

      const loader = new gltfModule.GLTFLoader(manager);
      try {
        const gltf = await loader.parseAsync(source.buffer, source.basePath);
        root = gltf.scene;
      } catch (error) {
        throw new ViewerError(describeLoadError(error));
      }

      if (controller.signal.aborted || generation !== generationRef.current) {
        if (root) disposeObject(root);
        return;
      }
      if (!root) throw new ViewerError("模型未生成可显示的三维场景。");

      mountAttempted = true;
      const mounted = mountScene({
        THREE,
        root,
        host,
        title,
        instructionsId,
        reducedMotion: reducedRef.current,
        createControls: (camera, canvas) => new controlsModule.OrbitControls(camera, canvas),
        createEnvironment: () => new environmentModule.RoomEnvironment(),
        onFatal: (message) => {
          if (generation !== generationRef.current) return;
          cleanupRef.current?.();
          cleanupRef.current = null;
          sessionRef.current = null;
          rotateRef.current = false;
          setRotateOn(false);
          setErrorMessage(message);
          setStatus("error");
        },
        onAutoRotateChange: (on) => {
          if (generation !== generationRef.current) return;
          rotateRef.current = on;
          setRotateOn(on);
        },
      });

      cleanupRef.current = mounted.cleanup;
      sessionRef.current = mounted.session;
      setStatus("ready");
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (root && !mountAttempted) disposeObject(root);
      const message = error instanceof ViewerError ? error.message : describeLoadError(error);
      setErrorMessage(message);
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function resetView() {
    sessionRef.current?.reset();
  }

  function toggleAutoRotate() {
    if (reducedRef.current) return;
    const next = !rotateRef.current;
    rotateRef.current = next;
    sessionRef.current?.setAutoRotate(next);
    setRotateOn(next);
  }

  const available = status === "ready";

  return (
    <section
      className={styles.viewer}
      aria-label={`三维模型：${title}`}
      aria-busy={status === "loading"}
    >
      <div className={styles.head}>
        <span className={styles.kicker}>三维 / MODEL</span>
        <p className={styles.title}>{title}</p>
      </div>

      <div className={styles.stage}>
        <div ref={stageRef} className={styles.scene} />

        {status === "idle" && (
          <div className={styles.poster}>
            <span className={styles.mark} aria-hidden />
            <p className={styles.posterTitle}>三维模型待加载</p>
            <p className={styles.posterText}>点击加载模型，可拖动、缩放和复位视角。</p>
            <button type="button" className={styles.primary} onClick={() => void start()}>
              加载三维预览
            </button>
            <p className={styles.posterHint}>按需启用 WebGL · 仅交互时绘制</p>
          </div>
        )}

        {status === "loading" && (
          <div className={styles.overlay} role="status">
            <span className={styles.spinner} aria-hidden />
            <p>正在装配三维场景…</p>
            <p className={styles.overlaySub}>初始化渲染器 / 读取几何</p>
          </div>
        )}

        {status === "error" && (
          <div className={styles.overlay} role="alert">
            <p className={styles.errorLabel}>预览失败</p>
            <p className={styles.errorText}>{errorMessage}</p>
            <button type="button" className={styles.primary} onClick={() => void start()}>
              重试
            </button>
            <p className={styles.overlaySub}>重新建立场景会释放上一份几何与纹理。</p>
          </div>
        )}
      </div>

      <div className={styles.bar}>
        <p id={instructionsId} className={styles.help}>
          {available
            ? "拖动旋转 · 滚轮缩放 · 右键平移 · 触屏上下滑动滚动页面 · 聚焦后方向键微调"
            : status === "loading"
              ? "正在建立 WebGL 场景，完成后即可交互。"
              : status === "error"
                ? "预览未就绪 · 重试会重新建立场景并释放旧资源。"
                : "加载后可用鼠标或触控操作；自动旋转默认关闭。"}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={resetView}
            disabled={!available}
            aria-label="复位三维视角"
          >
            复位视角
          </button>
          <button
            type="button"
            className={`${styles.action} ${rotateOn && !reducedMotion ? styles.actionOn : ""}`}
            onClick={toggleAutoRotate}
            aria-pressed={rotateOn && !reducedMotion}
            disabled={!available || reducedMotion}
            title={
              reducedMotion
                ? "系统已启用“减少动态效果”，自动旋转不可用"
                : "围绕模型中心缓慢旋转"
            }
          >
            自动旋转
          </button>
        </div>
      </div>

      <p className={styles.caption}>
        <span className={styles.captionMark} aria-hidden />
        GLB 模型 · 仅允许同源嵌套资源，不加载外部压缩解码器
      </p>
    </section>
  );
}

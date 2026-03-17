const container = document.getElementById("stage");
const status = document.getElementById("status");

const MODEL_URL = "./models/ojisan.vrm";

let currentVrm = null;
let currentRoot = null;
let lookTarget = null;
let camera = null;
let renderer = null;
let scene = null;

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
  status.textContent = "Viewer error";
});

window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
  status.textContent = "Module error";
});

start();

async function start() {
  try {
    status.textContent = "Loading modules...";

    const [THREE, gltfModule, vrmModule] = await Promise.all([
      import("https://esm.sh/three@0.180.0"),
      import("https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"),
      import("https://esm.sh/@pixiv/three-vrm@3.5.0?deps=three@0.180.0")
    ]);

    const { GLTFLoader } = gltfModule;
    const { VRMLoaderPlugin, VRMUtils } = vrmModule;

    status.textContent = "Loading model...";

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#eadfce");
    scene.fog = new THREE.Fog("#eadfce", 8, 18);

    const size = measureStage();
    camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.1, 50);
    lookTarget = new THREE.Vector3(0, 0.9, 0);
    camera.position.set(0, 1.05, 4.1);
    camera.lookAt(lookTarget);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size.width, size.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "default";
    container.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#fff8ef", "#8f6e55", 1.8));

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
    keyLight.position.set(1.5, 3, 2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#f2cfa4", 0.8);
    fillLight.position.set(-2, 1.5, 1.5);
    scene.add(fillLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 64),
      new THREE.MeshStandardMaterial({ color: "#caa98f", transparent: true, opacity: 0.28 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.05;
    scene.add(floor);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const gltf = await new Promise((resolve, reject) => {
      loader.load(MODEL_URL, resolve, undefined, reject);
    });

    const vrm = gltf.userData?.vrm || null;
    if (vrm) {
      try { VRMUtils.rotateVRM0(vrm); } catch (error) { console.warn("rotateVRM0 failed", error); }
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (error) { console.warn("removeUnnecessaryVertices failed", error); }
      try { VRMUtils.combineSkeletons(gltf.scene); } catch (error) { console.warn("combineSkeletons failed", error); }
    }

    currentVrm = vrm;
    currentRoot = vrm?.scene || gltf.scene;

    if (!currentRoot) {
      throw new Error("Model scene was empty.");
    }

    currentRoot.rotation.y = Math.PI;
    currentRoot.traverse((object) => {
      object.frustumCulled = false;
    });
    scene.add(currentRoot);

    fitAvatarToView(THREE, currentRoot, camera, lookTarget, currentVrm);

    window.addEventListener("resize", () => {
      const nextSize = measureStage();
      camera.aspect = nextSize.width / nextSize.height;
      camera.updateProjectionMatrix();
      renderer.setSize(nextSize.width, nextSize.height, false);
      if (currentRoot) {
        fitAvatarToView(THREE, currentRoot, camera, lookTarget, currentVrm);
      }
    });

    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      if (currentVrm) {
        currentVrm.update(delta);
      }
      camera.lookAt(lookTarget);
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    };

    animate();
    status.textContent = "Ready";
  } catch (error) {
    console.error(error);
    status.textContent = "Init failed";
  }
}

function fitAvatarToView(THREE, root, cameraRef, lookTargetRef, vrm) {
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const stageSize = measureStage();
  const stageAspect = stageSize.width / Math.max(stageSize.height, 1);
  const verticalFov = THREE.MathUtils.degToRad(cameraRef.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * stageAspect);

  box.getSize(size);
  box.getCenter(center);
  anchor.copy(center);

  const hips = vrm?.humanoid?.getNormalizedBoneNode("hips");
  if (hips) {
    const hipsWorld = new THREE.Vector3();
    hips.getWorldPosition(hipsWorld);
    anchor.x = hipsWorld.x;
    anchor.z = hipsWorld.z;
  }

  root.position.x = -anchor.x;
  root.position.z = -anchor.z;
  root.position.y = -(box.min.y + 1.02);
  root.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(root);
  const fittedSize = new THREE.Vector3();
  fittedBox.getSize(fittedSize);

  const targetY = Math.max(0.72, fittedSize.y * 0.5);
  const baseCameraY = Math.max(targetY + 0.18, fittedSize.y * 0.56);
  const fitHeightCameraZ = (fittedSize.y * 0.68) / Math.tan(verticalFov / 2);
  const fitWidthCameraZ = horizontalFov > 0.0001
    ? (fittedSize.x * 0.9) / Math.tan(horizontalFov / 2)
    : 3.2;
  const cameraZ = Math.max(3.2, fitHeightCameraZ, fitWidthCameraZ);

  lookTargetRef.set(0, targetY, 0);
  cameraRef.position.set(0, baseCameraY, cameraZ);
  cameraRef.lookAt(lookTargetRef);
  centerFocusPointHorizontally(THREE, cameraRef, lookTargetRef, vrm, fittedBox, horizontalFov);
  cameraRef.lookAt(lookTargetRef);
}

function centerFocusPointHorizontally(THREE, cameraRef, lookTargetRef, vrmRef, fittedBox, horizontalFov) {
  const focusPoint = getFocusPoint(THREE, vrmRef, fittedBox);

  for (let step = 0; step < 2; step += 1) {
    cameraRef.updateMatrixWorld(true);
    const projected = focusPoint.clone().project(cameraRef);
    if (Math.abs(projected.x) < 0.01) {
      break;
    }

    const focusInCamera = focusPoint.clone().applyMatrix4(cameraRef.matrixWorldInverse);
    const depth = Math.max(Math.abs(focusInCamera.z), 0.01);
    const halfWidth = Math.max(Math.tan(horizontalFov / 2) * depth, 0.0001);
    const deltaX = projected.x * halfWidth;

    cameraRef.position.x += deltaX;
    lookTargetRef.x += deltaX;
    cameraRef.lookAt(lookTargetRef);
  }
}

function getFocusPoint(THREE, vrmRef, fittedBox) {
  const point = new THREE.Vector3();
  const head = vrmRef?.humanoid?.getNormalizedBoneNode("head");
  const neck = vrmRef?.humanoid?.getNormalizedBoneNode("neck");
  const chest = vrmRef?.humanoid?.getNormalizedBoneNode("chest");
  const hips = vrmRef?.humanoid?.getNormalizedBoneNode("hips");
  const focusNode = head || neck || chest || hips;

  if (focusNode) {
    focusNode.getWorldPosition(point);
    return point;
  }

  fittedBox.getCenter(point);
  return point;
}

function measureStage() {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(320, Math.round(rect.width || window.innerWidth || 360)),
    height: Math.max(360, Math.round(rect.height || window.innerHeight * 0.6 || 420))
  };
}

const container = document.getElementById("stage");
const status = document.getElementById("status");

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

    const [THREE, orbitModule, gltfModule, vrmModule] = await Promise.all([
      import("https://esm.sh/three@0.180.0"),
      import("https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js"),
      import("https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"),
      import("https://esm.sh/@pixiv/three-vrm@3.5.0?deps=three@0.180.0")
    ]);

    const { OrbitControls } = orbitModule;
    const { GLTFLoader } = gltfModule;
    const { VRMLoaderPlugin, VRMUtils } = vrmModule;

    status.textContent = "Loading model...";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eadfce");
    scene.fog = new THREE.Fog("#eadfce", 8, 18);

    const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 0.72, 3.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.target.set(0, 0.52, 0);
    controls.minDistance = 2.2;
    controls.maxDistance = 5.8;
    controls.maxPolarAngle = Math.PI / 1.85;
    controls.update();

    scene.add(new THREE.HemisphereLight("#fff7ef", "#8f6e55", 1.8));
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

    let vrm = null;
    const clock = new THREE.Clock();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      "./models/ojisan.vrm",
      (gltf) => {
        try {
          vrm = gltf.userData.vrm;
          if (!vrm) {
            status.textContent = "VRM error";
            return;
          }

          VRMUtils.rotateVRM0(vrm);
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);

          const root = vrm.scene;
          root.rotation.y = Math.PI;
          fitAvatarToView(root, camera, controls, THREE);
          scene.add(root);
          status.textContent = "Ready";
        } catch (error) {
          console.error(error);
          status.textContent = "VRM setup failed";
        }
      },
      undefined,
      (error) => {
        console.error(error);
        status.textContent = "Load failed";
      }
    );

    window.addEventListener("resize", () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    function animate() {
      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;

      if (vrm) {
        applyRelaxedPose(vrm, elapsed);
        applyBlink(vrm, elapsed);
        vrm.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();
  } catch (error) {
    console.error(error);
    status.textContent = "Init failed";
  }
}

function fitAvatarToView(root, cameraRef, controlsRef, THREE) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y + 1.02;

  const fullBodyTarget = Math.max(0.48, size.y * 0.28);
  controlsRef.target.set(0, fullBodyTarget, 0);
  cameraRef.position.set(
    0.06,
    Math.max(0.72, size.y * 0.36),
    Math.max(3.05, size.y * 1.62)
  );
  controlsRef.update();
}

function applyRelaxedPose(vrmRef, elapsed) {
  const humanoid = vrmRef.humanoid;
  if (!humanoid) return;

  const spine = humanoid.getNormalizedBoneNode("spine");
  const chest = humanoid.getNormalizedBoneNode("chest");
  const neck = humanoid.getNormalizedBoneNode("neck");
  const head = humanoid.getNormalizedBoneNode("head");
  const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
  const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
  const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
  const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");

  const breathe = Math.sin(elapsed * 0.9) * 0.012;
  const sway = Math.sin(elapsed * 0.55) * 0.025;
  const nod = Math.sin(elapsed * 0.7) * 0.018;

  if (spine) {
    spine.rotation.x = 0.03 + breathe;
    spine.rotation.y = sway * 0.15;
    spine.rotation.z = sway * 0.12;
  }
  if (chest) {
    chest.rotation.x = 0.02 + breathe * 0.7;
    chest.rotation.y = sway * 0.18;
    chest.rotation.z = sway * 0.08;
  }
  if (neck) {
    neck.rotation.x = 0.03 + nod;
    neck.rotation.y = sway * 0.3;
    neck.rotation.z = sway * 0.08;
  }
  if (head) {
    head.rotation.x = nod * 0.8;
    head.rotation.y = sway * 0.45;
    head.rotation.z = sway * 0.12;
  }
  if (leftUpperArm) {
    leftUpperArm.rotation.x = 0.05;
    leftUpperArm.rotation.z = 1.35;
  }
  if (leftLowerArm) {
    leftLowerArm.rotation.z = 0.08;
  }
  if (rightUpperArm) {
    rightUpperArm.rotation.x = 0.05;
    rightUpperArm.rotation.z = -1.35;
  }
  if (rightLowerArm) {
    rightLowerArm.rotation.z = -0.08;
  }
}

function applyBlink(vrmRef, elapsed) {
  const manager = vrmRef.expressionManager;
  if (!manager) return;
  manager.setValue("blink", 0);
  const blink = Math.max(0, Math.sin(elapsed * 0.9 + 1.2) * 12 - 11);
  manager.setValue("blinkLeft", blink);
  manager.setValue("blinkRight", blink);
}
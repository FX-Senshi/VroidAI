const container = document.getElementById("stage");
const status = document.getElementById("status");
const apiState = document.getElementById("apiState");
const modelSelect = document.getElementById("modelSelect");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const chatHint = document.getElementById("chatHint");

const MODEL_CAMERA_OVERRIDES = {
  "ojisan.vrm": {
    targetYFactor: 0.29,
    minTargetY: 0.5,
    cameraYFactor: 0.38,
    minCameraY: 0.78,
    cameraZFactor: 1.62,
    minCameraZ: 3.05
  },
  "お姉さん.vrm": {
    targetYFactor: 0.33,
    minTargetY: 0.62,
    cameraYFactor: 0.46,
    minCameraY: 0.98,
    cameraZFactor: 1.82,
    minCameraZ: 3.45
  },
  "女の子.vrm": {
    targetYFactor: 0.27,
    minTargetY: 0.44,
    cameraYFactor: 0.34,
    minCameraY: 0.68,
    cameraZFactor: 1.5,
    minCameraZ: 2.85
  },
  "褐色.vrm": {
    targetYFactor: 0.31,
    minTargetY: 0.56,
    cameraYFactor: 0.42,
    minCameraY: 0.88,
    cameraZFactor: 1.72,
    minCameraZ: 3.25
  }
};

const DEFAULT_CAMERA = {
  targetYFactor: 0.29,
  minTargetY: 0.5,
  cameraYFactor: 0.38,
  minCameraY: 0.78,
  cameraZFactor: 1.62,
  minCameraZ: 3.05
};

const messages = [];
let app = null;
let currentVrm = null;
let currentModel = null;

addMessage("assistant", "Hello. What would you like to talk about today?");

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
  status.textContent = "Viewer error";
});

window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
  status.textContent = "Module error";
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = chatInput.value.trim();
  if (!content || sendButton.disabled) return;

  addMessage("user", content);
  chatInput.value = "";
  sendButton.disabled = true;
  sendButton.textContent = "Sending...";
  chatHint.textContent = "Waiting for the AI response...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Chat request failed.");
    }

    const reply = data.message || "The AI returned an empty response.";
    addMessage("assistant", reply);

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.lang = "ja-JP";
      utterance.rate = 1;
      utterance.pitch = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  } catch (error) {
    console.error(error);
    addMessage("assistant", `Error: ${error.message}`);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
    chatHint.textContent = "Press Enter to send. Use Shift+Enter for a new line.";
  }
});

modelSelect.addEventListener("change", async () => {
  if (!app) return;
  await loadModel(modelSelect.value);
});

Promise.all([initViewer(), checkApiStatus(), loadModelList()]).catch((error) => {
  console.error(error);
  status.textContent = "Init failed";
});

async function initViewer() {
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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eadfce");
  scene.fog = new THREE.Fog("#eadfce", 8, 18);

  const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 50);
  camera.position.set(0, 0.78, 3.05);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.target.set(0, 0.5, 0);
  controls.minDistance = 2.2;
  controls.maxDistance = 6.2;
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

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const clock = new THREE.Clock();

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  function animate() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (currentVrm) {
      applyRelaxedPose(currentVrm, elapsed);
      applyBlink(currentVrm, elapsed);
      currentVrm.update(delta);
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  app = {
    THREE,
    VRMUtils,
    scene,
    camera,
    controls,
    loader
  };
}

async function loadModelList() {
  const response = await fetch("/api/models");
  const data = await response.json();

  modelSelect.innerHTML = "";
  for (const file of data.models || []) {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = file;
    modelSelect.appendChild(option);
  }

  const preferred = data.defaultModel || modelSelect.value;
  if (preferred) {
    modelSelect.value = preferred;
  }

  if (app && modelSelect.value) {
    await loadModel(modelSelect.value);
  }
}

async function loadModel(fileName) {
  if (!app || !fileName || fileName === currentModel) return;

  status.textContent = "Loading model...";

  const { loader, scene, VRMUtils, camera, controls, THREE } = app;

  await new Promise((resolve, reject) => {
    loader.load(
      `./models/${encodeURIComponent(fileName)}`,
      (gltf) => {
        try {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            status.textContent = "VRM error";
            reject(new Error("VRM model was not recognized."));
            return;
          }

          if (currentVrm?.scene) {
            scene.remove(currentVrm.scene);
          }

          VRMUtils.rotateVRM0(vrm);
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);

          const root = vrm.scene;
          root.rotation.y = Math.PI;
          fitAvatarToView(root, camera, controls, THREE, fileName);
          scene.add(root);

          currentVrm = vrm;
          currentModel = fileName;
          status.textContent = `Ready: ${fileName}`;
          resolve();
        } catch (error) {
          status.textContent = "VRM setup failed";
          reject(error);
        }
      },
      undefined,
      (error) => {
        status.textContent = "Load failed";
        reject(error);
      }
    );
  });
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    apiState.textContent = data.openaiConfigured ? "API ready" : "API key missing";
    if (!data.openaiConfigured) {
      chatHint.textContent = "Add OPENAI_API_KEY to .env, then restart the server.";
    }
  } catch (error) {
    console.error(error);
    apiState.textContent = "API check failed";
  }
}

function addMessage(role, content) {
  const message = { role, content };
  messages.push(message);

  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = content;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function fitAvatarToView(root, cameraRef, controlsRef, THREE, fileName) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y + 1.02;

  const cameraPreset = MODEL_CAMERA_OVERRIDES[fileName] || DEFAULT_CAMERA;
  const targetY = Math.max(cameraPreset.minTargetY, size.y * cameraPreset.targetYFactor);
  const cameraY = Math.max(cameraPreset.minCameraY, size.y * cameraPreset.cameraYFactor);
  const cameraZ = Math.max(cameraPreset.minCameraZ, size.y * cameraPreset.cameraZFactor);

  controlsRef.target.set(0, targetY, 0);
  cameraRef.position.set(0.06, cameraY, cameraZ);
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
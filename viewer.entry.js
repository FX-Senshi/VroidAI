import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const container = document.getElementById("stage");
let status = document.getElementById("status");
const apiState = document.getElementById("apiState");
const dbState = document.getElementById("dbState");
const memoryState = document.getElementById("memoryState");
const growthState = document.getElementById("growthState");
const modelSelect = document.getElementById("modelSelect");
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");
const mobileMenuCloseButton = document.getElementById("mobileMenuCloseButton");
const runtimeSearchParams = new URLSearchParams(window.location.search);
const BUILD_VERSION = "20260321b";
const DEBUG_LIP_SYNC_MODE = runtimeSearchParams.has("debugLipSync");
const DEBUG_LIP_SYNC_AUTORUN = runtimeSearchParams.has("debugLipSyncAutoRun");
const FEMALE_VOICE_NAME_PATTERN = /(female|woman|girl|kyoko|nanami|naomi|ayumi|haruka|sayaka|sakura|samantha|zira|aria|jenny|sonia|monica|lucia|hemi|xiaoxiao|huihui|ja-jp nanami|ja-jp haruka)/iu;
const MINIMAL_APP_MODE = false;
const MINIMAL_GREETING = "こんにちは。話しかけてください。";
const CUTE_VOICE_NAME_PRIORITY = [
  /nanami/iu,
  /haruka/iu,
  /sakura/iu,
  /sayaka/iu,
  /ayumi/iu,
  /kyoko/iu,
  /naomi/iu,
  /zira|aria|jenny|sonia|monica|lucia|hemi|xiaoxiao|huihui/iu
];
const CUTE_VOICE_RATE = 1.04;
const CUTE_VOICE_PITCH = 1.16;

const MODEL_CAMERA_OVERRIDES = {
  "ojisan.vrm": {
    targetYFactor: 0.23,
    minTargetY: 0.36,
    cameraYFactor: 0.29,
    minCameraY: 0.5,
    cameraZFactor: 1.44,
    minCameraZ: 2.68
  },
  "お姉さん.vrm": {
    targetYFactor: 0.1,
    minTargetY: 0.16,
    cameraYFactor: 0.05,
    minCameraY: 0.06,
    cameraZFactor: 1.58,
    minCameraZ: 2.86
  },
  "女の子.vrm": {
    targetYFactor: 0.09,
    minTargetY: 0.14,
    cameraYFactor: 0.04,
    minCameraY: 0.04,
    cameraZFactor: 1.34,
    minCameraZ: 2.42
  },
  "女の子ver2.vrm": {
    targetYFactor: 0.09,
    minTargetY: 0.14,
    cameraYFactor: 0.04,
    minCameraY: 0.04,
    cameraZFactor: 1.34,
    minCameraZ: 2.42
  },
  "褐色.vrm": {
    targetYFactor: 0.1,
    minTargetY: 0.15,
    cameraYFactor: 0.05,
    minCameraY: 0.05,
    cameraZFactor: 1.48,
    minCameraZ: 2.65
  }
};

const DEFAULT_CAMERA = {
  targetYFactor: 0.23,
  minTargetY: 0.36,
  cameraYFactor: 0.29,
  minCameraY: 0.5,
  cameraZFactor: 1.44,
  minCameraZ: 2.68
};

const CHAT_SESSION_STORAGE_KEY = "vroid-chat-session-v1";
const SELECTED_MODEL_STORAGE_KEY = "vroid-selected-model-v1";
const CAMERA_ADJUSTMENTS_STORAGE_KEY = "vroid-camera-adjustments-v9";
const VOICE_SETTINGS_STORAGE_KEY = "vroid-voice-settings-v1";
const CAMERA_HEIGHT_RANGE_FALLBACK = { min: -1.8, max: 1.2 };
const CAMERA_DISTANCE_RANGE_FALLBACK = { min: -3.4, max: 1.8 };
const CAMERA_HORIZONTAL_RANGE_FALLBACK = { min: -1.2, max: 1.2 };
const MOBILE_STAGE_BREAKPOINT = 680;
const MOBILE_PROJECTED_X_TARGET = -0.42;
const MOBILE_MODEL_YAW_OFFSET = THREE.MathUtils.degToRad(8);
const MOBILE_MODEL_PITCH_OFFSET = THREE.MathUtils.degToRad(3);
const CAMERA_PITCH_DOWN_OFFSET = THREE.MathUtils.degToRad(-1);
const MODEL_ROOT_ROTATION_OVERRIDES = {
  "女の子ver2.vrm": {
    yaw: 0,
    mobileYawOffset: MOBILE_MODEL_YAW_OFFSET,
    mobilePitch: MOBILE_MODEL_PITCH_OFFSET
  }
};

const DEFAULT_ROOT_ROTATION = {
  yaw: Math.PI,
  mobileYawOffset: MOBILE_MODEL_YAW_OFFSET,
  mobilePitch: MOBILE_MODEL_PITCH_OFFSET
};

const RELAXED_POSE_OVERRIDES = {
  "女の子ver2.vrm": {
    leftShoulder: { x: 0, y: 0, z: -0.38 },
    leftUpperArm: { x: 0.03, y: 0, z: -0.46 },
    leftLowerArm: { x: 0, y: 0, z: 0.01 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightShoulder: { x: 0, y: 0, z: 0.38 },
    rightUpperArm: { x: 0.03, y: 0, z: 0.46 },
    rightLowerArm: { x: 0, y: 0, z: -0.01 },
    rightHand: { x: 0, y: 0, z: 0 }
  }
};

const RELAXED_UPPER_BODY_OVERRIDES = {
  "女の子ver2.vrm": {
    spineX: 0.005,
    chestX: -0.01,
    neckX: -0.072,
    headX: -0.036,
    nodScale: 0.42
  }
};

const DEFAULT_RELAXED_UPPER_BODY = {
  spineX: 0.03,
  chestX: 0.02,
  neckX: 0.03,
  headX: 0,
  nodScale: 1
};

const DEFAULT_RELAXED_POSE = {
  leftShoulder: { x: 0, y: 0, z: 0 },
  leftUpperArm: { x: 0.05, y: 0, z: 1.35 },
  leftLowerArm: { x: 0, y: 0, z: 0.08 },
  leftHand: { x: 0, y: 0, z: 0 },
  rightShoulder: { x: 0, y: 0, z: 0 },
  rightUpperArm: { x: 0.05, y: 0, z: -1.35 },
  rightLowerArm: { x: 0, y: 0, z: -0.08 },
  rightHand: { x: 0, y: 0, z: 0 }
};
const FIXED_MODEL_NAME = "女の子ver2.vrm";
const FIXED_MODEL_ASSET_FILE_NAME = "girlver2-lite.vrm";
const FIXED_GIRL_FACE_TEXTURE_FILE = "girlver2-face-base.png";
const FIXED_GIRL_BODY_TEXTURE_FILE = "girlver2-body-base.png";
const DEFAULT_CAMERA_ADJUSTMENTS = {
  heightOffset: 0,
  distanceOffset: 0,
  horizontalOffset: 0
};
const DEFAULT_VOICE_SETTINGS = {
  enabled: true,
  voiceURI: ""
};
const BASIC_HUMANOID_NODE_NAME_MAP = {
  hips: ["J_Bip_C_Hips", "Hips"],
  spine: ["J_Bip_C_Spine", "Spine"],
  chest: ["J_Bip_C_Chest", "Chest"],
  upperChest: ["J_Bip_C_UpperChest", "UpperChest"],
  neck: ["J_Bip_C_Neck", "Neck"],
  head: ["J_Bip_C_Head", "Head"],
  jaw: ["J_Bip_C_Jaw", "Jaw"],
  leftShoulder: ["J_Bip_L_Shoulder", "LeftShoulder"],
  leftUpperArm: ["J_Bip_L_UpperArm", "LeftUpperArm"],
  leftLowerArm: ["J_Bip_L_LowerArm", "LeftLowerArm"],
  leftHand: ["J_Bip_L_Hand", "LeftHand"],
  rightShoulder: ["J_Bip_R_Shoulder", "RightShoulder"],
  rightUpperArm: ["J_Bip_R_UpperArm", "RightUpperArm"],
  rightLowerArm: ["J_Bip_R_LowerArm", "RightLowerArm"],
  rightHand: ["J_Bip_R_Hand", "RightHand"]
};
const messages = [];
const MOUTH_VISEMES = ["aa", "ih", "ou", "ee", "oh"];
const VISEME_PRESET_ALIASES = {
  aa: ["aa", "a"],
  ih: ["ih", "i"],
  ou: ["ou", "u"],
  ee: ["ee", "e"],
  oh: ["oh", "o"]
};
const DIRECT_MOUTH_MORPH_TARGETS = {
  aa: ["Fcl_MTH_A"],
  ih: ["Fcl_MTH_I"],
  ou: ["Fcl_MTH_U"],
  ee: ["Fcl_MTH_E"],
  oh: ["Fcl_MTH_O"]
};
const DIRECT_MOUTH_SUPPORT_TARGETS = {
  open: ["Fcl_MTH_Large"],
  drop: ["Fcl_MTH_Down"],
  lift: ["Fcl_MTH_Up"],
  surprised: ["Fcl_MTH_Surprised"],
  close: ["Fcl_MTH_Close"],
  neutral: ["Fcl_MTH_Neutral"]
};
const DIRECT_MOUTH_CONFLICT_TARGETS = [
  "Fcl_MTH_Fun",
  "Fcl_MTH_Joy",
  "Fcl_MTH_Sorrow",
  "Fcl_MTH_Angry",
  "Fcl_MTH_Small",
  "Fcl_MTH_SkinFung",
  "Fcl_MTH_SkinFung_R",
  "Fcl_MTH_SkinFung_L"
];
const VISEME_JAW_OPENNESS = {
  aa: 1.08,
  oh: 0.86,
  ou: 0.76,
  ee: 0.58,
  ih: 0.48
};
const MAX_VISEME_PEAK = 0.82;
const MAX_VISEME_TOTAL = 1.08;
const FIXED_GIRL_MAX_VISEME_PEAK = 1.52;
const FIXED_GIRL_MAX_VISEME_TOTAL = 2.18;
const FIXED_GIRL_LIVE_DIRECT_GAIN = 1.4;
const FIXED_GIRL_LIVE_DROP_GAIN = 1.02;
const FIXED_GIRL_LIVE_LIFT_GAIN = 0.24;
const FIXED_GIRL_LIVE_DOMINANT_BOOST = 0.42;
const FIXED_GIRL_LIVE_FRAME_DIRECT_FLOOR = 0.62;
const FIXED_GIRL_LIVE_FRAME_NEXT_FLOOR = 0.34;
const FIXED_GIRL_DISABLE_BOUNDARY_SYNC = false;
const FIXED_GIRL_FALLBACK_TIMING_SCALE = 1.66;
const FIXED_GIRL_FALLBACK_CHAR_DURATION_MS = 170;
const FIXED_GIRL_SPEECH_LEAD_MS = 0;
const FIXED_GIRL_SILENT_NEXT_BLEND = 0;
const FIXED_GIRL_SPEECH_DIRECT_LIMIT = 0.9;
const FIXED_GIRL_SPEECH_DROP_LIMIT = 0.5;
const FIXED_GIRL_SPEECH_LIFT_LIMIT = 0.12;
const FIXED_GIRL_SPEECH_SURPRISED_LIMIT = 0.02;
const FIXED_GIRL_SPEECH_VISEME_MAP = {
  aa: { aa: 1.38, ou: 0.08 },
  ih: { ih: 1.22, ee: 0.26 },
  ou: { ou: 1.34 },
  ee: { ee: 1.08, ih: 0.24 },
  oh: { oh: 0.42, ou: 0.36, aa: 0.18 }
};
const FIXED_GIRL_SPEECH_SUPPORT_MAP = {
  aa: { drop: 0.52, lift: 0.08, surprised: 0.03 },
  ih: { drop: 0.22, lift: 0.1, surprised: 0 },
  ou: { drop: 0.26, lift: 0.18, surprised: 0.01 },
  ee: { drop: 0.2, lift: 0.1, surprised: 0 },
  oh: { drop: 0.24, lift: 0.1, surprised: 0.02 }
};
const FIXED_GIRL_SPEECH_POSE_MAP = {
  aa: {
    direct: { aa: 0.8, ou: 0.08 },
    support: { open: 0.04, drop: 0.36, lift: 0.03, surprised: 0.01 }
  },
  ih: {
    direct: { ih: 0.68, ee: 0.18 },
    support: { open: 0.03, drop: 0.19, lift: 0.09, surprised: 0 }
  },
  ou: {
    direct: { ou: 0.88 },
    support: { open: 0.04, drop: 0.2, lift: 0.11, surprised: 0.01 }
  },
  ee: {
    direct: { ee: 0.66, ih: 0.16 },
    support: { open: 0.03, drop: 0.17, lift: 0.1, surprised: 0 }
  },
  oh: {
    direct: { oh: 0.28, ou: 0.24, aa: 0.12 },
    support: { open: 0.03, drop: 0.15, lift: 0.05, surprised: 0.01 }
  }
};
const FIXED_GIRL_LIVE_SUPPORT_FLOOR_MAP = {
  aa: { drop: 0.36, lift: 0.04, surprised: 0.02 },
  ih: { drop: 0.26, lift: 0.08, surprised: 0 },
  ou: { drop: 0.24, lift: 0.1, surprised: 0.01 },
  ee: { drop: 0.24, lift: 0.08, surprised: 0 },
  oh: { drop: 0.22, lift: 0.05, surprised: 0.01 }
};
const FIXED_GIRL_DIAGNOSTIC_STEPS = [
  {
    durationMs: 180,
    visemes: {},
    support: { close: 0.16 }
  },
  {
    durationMs: 480,
    visemes: { aa: 0.76 },
    support: { drop: 0.34, lift: 0.04 }
  },
  {
    durationMs: 480,
    visemes: { ih: 0.7, ee: 0.18 },
    support: { drop: 0.19, lift: 0.1 }
  },
  {
    durationMs: 480,
    visemes: { ou: 0.86 },
    support: { drop: 0.18, lift: 0.12 }
  },
  {
    durationMs: 480,
    visemes: { ee: 0.68, ih: 0.14 },
    support: { drop: 0.16, lift: 0.11 }
  },
  {
    durationMs: 480,
    visemes: { oh: 0.28, ou: 0.24, aa: 0.12 },
    support: { drop: 0.14, lift: 0.06 }
  },
  {
    durationMs: 220,
    visemes: {},
    support: { close: 0.16 }
  }
];
const MAX_JAW_TARGET = 0.7;
const JAW_ROTATION_MULTIPLIER = 0.2;
const DIRECT_MORPH_INFLUENCE_LIMIT = 6.5;
const DIRECT_MOUTH_MORPH_SCALE = 2.2;
const DIRECT_MOUTH_OPEN_SUPPORT = 0.56;
const DIRECT_MOUTH_LARGE_SCALE = 2.55;
const DIRECT_MOUTH_DROP_SCALE = 1.78;
const DIRECT_MOUTH_LIFT_SCALE = 0.96;
const DIRECT_MOUTH_SURPRISED_SCALE = 0.82;
const JAWLESS_MOUTH_OPEN_FLOOR = 0.02;
const JAWLESS_AA_FLOOR_SCALE = 0.2;
const JAWLESS_OH_FLOOR_SCALE = 0.08;
const JAWLESS_ACTIVITY_THRESHOLD = 0.1;
const DIRECT_SUPPORT_KEYS = ["open", "drop", "lift", "surprised", "close", "neutral"];
const CJK_VISEME_PATTERNS = [
  [
    { viseme: "aa", durationMs: 98, strength: 0.74 },
    { viseme: "ih", durationMs: 104, strength: 0.58 }
  ],
  [
    { viseme: "aa", durationMs: 94, strength: 0.72 },
    { viseme: "ou", durationMs: 110, strength: 0.62 }
  ],
  [
    { viseme: "ee", durationMs: 92, strength: 0.64 },
    { viseme: "oh", durationMs: 108, strength: 0.68 }
  ],
  [
    { viseme: "ih", durationMs: 88, strength: 0.62 },
    { viseme: "ee", durationMs: 102, strength: 0.58 }
  ],
  [
    { viseme: "ou", durationMs: 96, strength: 0.66 },
    { viseme: "aa", durationMs: 104, strength: 0.7 }
  ],
  [
    { viseme: "aa", durationMs: 78, strength: 0.62 },
    { viseme: "oh", durationMs: 88, strength: 0.68 },
    { viseme: "ih", durationMs: 72, strength: 0.52 }
  ]
];
const FALLBACK_VISEME_PATTERNS = [
  [{ viseme: "aa", durationMs: 96, strength: 0.46 }],
  [{ viseme: "ih", durationMs: 90, strength: 0.44 }],
  [{ viseme: "ou", durationMs: 98, strength: 0.48 }],
  [{ viseme: "ee", durationMs: 92, strength: 0.44 }],
  [{ viseme: "oh", durationMs: 94, strength: 0.46 }]
];
const EMOTION_PRESETS = ["happy", "sad", "angry", "relaxed", "surprised"];
const EXPRESSION_IDLE_DELAY_MS = 3200;
const EXPRESSION_ACTIVE_DAMPING = 12;
const EXPRESSION_HOLD_DAMPING = 8;
const EXPRESSION_RELEASE_DAMPING = 4.2;
const MOTION_IDLE_DELAY_MS = 3800;
const THINKING_POSE_RAMP_MS = 860;
const sessionId = loadOrCreateSessionId();

let app = null;
let currentModel = null;
let currentSceneRoot = null;
let currentVrm = null;
let currentMorphTargetBindings = null;
const fixedGirlTextureState = {
  face: null,
  body: null,
  pending: null
};
let cameraTools = null;
let voiceTools = null;
let availableVoices = [];
let lipSyncDebugPre = null;
const cameraToolRanges = new Map();
const mouthDiagnosticState = {
  active: false,
  startedAtMs: 0
};
const speechState = {
  active: false,
  frames: [],
  totalDurationMs: 0,
  startTimeMs: 0,
  fallbackTimerId: 0,
  bootstrapWatcherId: 0,
  syncMode: "timed",
  currentFrameIndex: -1,
  currentFrameStartedAtMs: 0,
  boundarySupported: false,
  timingScale: 1,
  timingOffsetMs: 0,
  lastBoundaryAtMs: 0,
  lastBoundaryFrameIndex: -1,
  lastBoundaryStrength: 0,
  lastKnownSpeechElapsedMs: 0,
  activeUtteranceToken: 0,
  visemeValues: Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0])),
  directMorphValues: Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0])),
  frameTargets: Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0])),
  liveDirectTargets: Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0])),
  liveSupportTargets: {
    drop: 0,
    lift: 0,
    surprised: 0
  },
  jawValue: 0,
  supportValues: Object.fromEntries(DIRECT_SUPPORT_KEYS.map((key) => [key, 0]))
};
const expressionState = {
  currentValues: Object.fromEntries(EMOTION_PRESETS.map((preset) => [preset, 0])),
  targetValues: Object.fromEntries(EMOTION_PRESETS.map((preset) => [preset, 0])),
  activeEmotion: "relaxed",
  emphasis: 0.24,
  holdUntilMs: 0
};
const motionState = {
  activeGesture: "idle",
  emphasis: 0,
  holdUntilMs: 0,
  currentWeight: 0,
  releaseGesture: "idle",
  gestureStartedAtMs: 0,
  thinkingPoseWeight: 0,
  thinkingPoseTarget: 0
};

bootstrap();

window.addEventListener("error", (event) => {
  showFailure("Viewer error", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  showFailure("Module error", event.reason);
});

if (DEBUG_LIP_SYNC_MODE) {
  lipSyncDebugPre = document.createElement("pre");
  lipSyncDebugPre.id = "lipSyncDebug";
  Object.assign(lipSyncDebugPre.style, {
    position: "fixed",
    left: "12px",
    bottom: "12px",
    zIndex: "9999",
    maxWidth: "min(92vw, 560px)",
    maxHeight: "36vh",
    overflow: "auto",
    margin: "0",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(27, 22, 18, 0.86)",
    color: "#f8efe5",
    font: "12px/1.55 Consolas, monospace",
    whiteSpace: "pre-wrap",
    pointerEvents: "none"
  });
  document.body.appendChild(lipSyncDebugPre);
}

function setElementText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function updateLipSyncDebug() {
  if (!lipSyncDebugPre) {
    return;
  }

  const directMouthValues = {};
  for (const [viseme, targetNames] of Object.entries(DIRECT_MOUTH_MORPH_TARGETS)) {
    const firstTargetName = targetNames[0];
    const binding = currentMorphTargetBindings?.get(firstTargetName)?.[0];
    directMouthValues[viseme] = binding?.mesh?.morphTargetInfluences?.[binding.index] ?? null;
  }
  const supportMouthValues = {};
  for (const [key, targetNames] of Object.entries(DIRECT_MOUTH_SUPPORT_TARGETS)) {
    const firstTargetName = targetNames[0];
    const binding = currentMorphTargetBindings?.get(firstTargetName)?.[0];
    supportMouthValues[key] = binding?.mesh?.morphTargetInfluences?.[binding.index] ?? null;
  }

  const debugState = {
    model: currentModel,
    speechActive: speechState.active,
    boundarySupported: speechState.boundarySupported,
    frameIndex: speechState.currentFrameIndex,
    totalFrames: speechState.frames.length,
    jawValue: Number((speechState.jawValue || 0).toFixed(3)),
    visemes: Object.fromEntries(
      MOUTH_VISEMES.map((viseme) => [viseme, Number((speechState.visemeValues[viseme] || 0).toFixed(3))])
    ),
    liveDirectTargets: Object.fromEntries(
      MOUTH_VISEMES.map((viseme) => [viseme, Number((speechState.liveDirectTargets[viseme] || 0).toFixed(3))])
    ),
    directMorphs: Object.fromEntries(
      Object.entries(directMouthValues).map(([key, value]) => [key, value == null ? null : Number(value.toFixed(3))])
    ),
    supportMorphs: Object.fromEntries(
      Object.entries(supportMouthValues).map(([key, value]) => [key, value == null ? null : Number(value.toFixed(3))])
    ),
    liveSupportTargets: {
      drop: Number((speechState.liveSupportTargets.drop || 0).toFixed(3)),
      lift: Number((speechState.liveSupportTargets.lift || 0).toFixed(3)),
      surprised: Number((speechState.liveSupportTargets.surprised || 0).toFixed(3))
    },
    emotion: {
      active: expressionState.activeEmotion,
      holdUntilMs: Math.max(0, Math.round(expressionState.holdUntilMs - performance.now()))
    }
  };

  lipSyncDebugPre.textContent = JSON.stringify(debugState, null, 2);
}

chatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = chatInput.value.trim();
  if (!content || sendButton.disabled) {
    return;
  }

  addMessage("user", content);
  chatInput.value = "";
  sendButton.disabled = true;
  sendButton.textContent = "送信中...";
  setThinkingMotion();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        modelName: currentModel,
        messages
      })
    });
    const data = await response.json();

    if (!response.ok) {
      if (data?.growth) {
        updateGrowthState(data.growth, data.growthLearning);
      }
      throw new Error(data.error || "Chat request failed.");
    }

    const reply = data.message || "The AI returned an empty response.";
    addMessage("assistant", reply);
    if (data.growth) {
      updateGrowthState(data.growth, data.growthLearning);
    }
    speak(reply);
  } catch (error) {
    console.error(error);
    const errorText = formatError(error);
    if (errorText.includes("APIキーが無効") || /incorrect api key/i.test(errorText)) {
      setElementText(apiState, "API key invalid");
    }
    stopThinkingMotion();
    addMessage("assistant", `Error: ${errorText}`);
  } finally {
    stopThinkingMotion();
    sendButton.disabled = false;
    sendButton.textContent = "送信";
  }
});

modelSelect?.addEventListener("change", async () => {
  if (!app) {
    return;
  }

  const nextModel = modelSelect.value;
  saveSelectedModel(nextModel);

  try {
    await loadModel(nextModel);
  } catch (error) {
    showFailure("Load failed", error);
  }
});

async function bootstrap() {
  try {
    ensureStatusBar();
    verifyDom();
    setupMobileMenu();
    createVoiceTools();
    if (!MINIMAL_APP_MODE) {
      createCameraTools();
    }
    initSpeechSupport();
    await waitForStageLayout();
    app = await initViewer();
    await loadModelList();
    if (!MINIMAL_APP_MODE) {
      await checkApiStatus();
    }
    const restored = MINIMAL_APP_MODE ? false : await loadSavedHistory();
    if (!restored) {
      addMessage("assistant", MINIMAL_GREETING, {
        affectExpression: false
      });
      resetConversationExpression();
    }
  } catch (error) {
    showFailure("Init failed", error);
  }
}

function ensureStatusBar() {
  if (status) {
    return;
  }

  const viewer = document.querySelector(".viewer");
  if (!viewer) {
    return;
  }

  let statusBar = viewer.querySelector(".statusBar");
  if (!statusBar) {
    statusBar = document.createElement("div");
    statusBar.className = "statusBar";
    viewer.appendChild(statusBar);
  }

  status = document.createElement("div");
  status.id = "status";
  status.className = "status";
  statusBar.appendChild(status);
}

function verifyDom() {
  const required = {
    stage: container,
    modelSelect,
    messagesEl,
    chatForm,
    chatInput,
    sendButton,
    mobileMenuButton,
    mobileMenuBackdrop,
    mobileMenuCloseButton
  };

  for (const [name, element] of Object.entries(required)) {
    if (!element) {
      throw new Error(`Missing DOM element: ${name}`);
    }
  }
}

function isMobileLayout() {
  return window.innerWidth <= 979;
}

function updateMobileMenuUi() {
  const isOpen = document.body.dataset.mobileMenu === "open";
  mobileMenuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  mobileMenuBackdrop.hidden = !isOpen;

  if (!isMobileLayout()) {
    document.body.dataset.mobileMenu = "closed";
    mobileMenuBackdrop.hidden = true;
    mobileMenuButton.setAttribute("aria-expanded", "false");
  }
}

function setMobileMenuOpen(nextOpen) {
  document.body.dataset.mobileMenu = nextOpen ? "open" : "closed";
  updateMobileMenuUi();
}

function setupMobileMenu() {
  setMobileMenuOpen(false);

  mobileMenuButton.addEventListener("click", () => {
    setMobileMenuOpen(document.body.dataset.mobileMenu !== "open");
  });

  mobileMenuCloseButton.addEventListener("click", () => {
    setMobileMenuOpen(false);
  });

  mobileMenuBackdrop.addEventListener("click", () => {
    setMobileMenuOpen(false);
  });

  window.addEventListener("resize", updateMobileMenuUi);
}

function loadOrCreateSessionId() {
  try {
    const saved = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (saved) {
      return saved;
    }

    const nextId = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function renderMessage(role, content) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = content;
  messagesEl.appendChild(node);
}

function scoreMatches(text, regex) {
  const matches = String(text || "").match(regex);
  return matches ? matches.length : 0;
}

function buildEmotionTargets(primaryEmotion, emphasis = 0.24) {
  const strength = THREE.MathUtils.clamp(emphasis, 0.16, 0.86);
  const targets = Object.fromEntries(EMOTION_PRESETS.map((preset) => [preset, 0]));

  switch (primaryEmotion) {
    case "happy":
      targets.happy = 0.34 + strength * 0.5;
      targets.relaxed = 0.12 + strength * 0.14;
      break;
    case "sad":
      targets.sad = 0.28 + strength * 0.48;
      break;
    case "angry":
      targets.angry = 0.2 + strength * 0.42;
      targets.sad = 0.06 + strength * 0.08;
      break;
    case "surprised":
      targets.surprised = 0.26 + strength * 0.42;
      targets.happy = 0.04 + strength * 0.08;
      break;
    default:
      targets.relaxed = 0.16 + strength * 0.3;
      break;
  }

  return targets;
}

function analyzeEmotionFromText(text) {
  const source = String(text || "");
  const normalized = source.toLowerCase();
  const positiveScore =
    scoreMatches(source, /(ありがとう|嬉しい|よかった|安心|大丈夫|できます|もちろん|了解|いいですね|素敵|すばらしい|おめでとう|ぜひ|こんにちは|こんばんは|はじめまして)/g) +
    scoreMatches(source, /[!！]/g) * 0.22;
  const sadScore =
    scoreMatches(source, /(すみません|ごめん|申し訳|残念|難しい|できません|できない|失敗|心配|困|つら|ご不便|失礼)/g) +
    scoreMatches(source, /(error|failed|unable|sorry)/gi) * 0.9;
  const warningScore =
    scoreMatches(source, /(注意|危険|警告|禁止|だめ|NG|やめて|必須|避け|無効|削除|上限|制限)/g) +
    scoreMatches(source, /(warning|danger|must not|never)/gi) * 0.9;
  const surpriseScore =
    scoreMatches(source, /(びっくり|驚|おお|えっ|なんと|なるほど)/g) +
    scoreMatches(source, /(?:[?？]+|!{2,}|！？|\?!|!\?)/g) * 0.55;
  const calmScore =
    scoreMatches(source, /(まず|次に|手順|方法|設定|確認|ちなみに|必要|おすすめ|ポイント|コツ|できます|です|ます)/g) +
    Math.min(normalized.length / 180, 1.2);

  const ranked = [
    { emotion: "happy", score: positiveScore },
    { emotion: "sad", score: sadScore },
    { emotion: "angry", score: warningScore },
    { emotion: "surprised", score: surpriseScore },
    { emotion: "relaxed", score: calmScore + 0.18 }
  ].sort((left, right) => right.score - left.score);

  const primary = ranked[0]?.emotion || "relaxed";
  const emphasisBase = ranked[0]?.score || 0.2;
  const emphasis = THREE.MathUtils.clamp(0.22 + emphasisBase * 0.14, 0.2, 0.82);

  return {
    emotion: primary,
    emphasis,
    targets: buildEmotionTargets(primary, emphasis)
  };
}

function setConversationExpression(text) {
  const analysis = analyzeEmotionFromText(text);
  expressionState.activeEmotion = analysis.emotion;
  expressionState.emphasis = analysis.emphasis;
  expressionState.targetValues = analysis.targets;
  expressionState.holdUntilMs = performance.now() + EXPRESSION_IDLE_DELAY_MS;
}

function analyzeMotionFromText(text) {
  const source = String(text || "");
  const normalized = source.toLowerCase();
  const explainScore =
    scoreMatches(source, /(まず|次に|最後に|手順|方法|設定|確認|おすすめ|ポイント|コツ|たとえば|例えば|一覧|やり方|進め方|手短|簡単|準備|使えます|できます|しましょう)/g) +
    scoreMatches(source, /(?:^|\s)\d+\./g) * 0.9;
  const happyScore =
    scoreMatches(source, /(ありがとう|嬉しい|よかった|安心|もちろん|ぜひ|楽しみ|素敵|すばらしい|おめでとう|了解)/g) +
    scoreMatches(source, /[!！]/g) * 0.24;
  const warnScore =
    scoreMatches(source, /(注意|危険|警告|禁止|だめ|NG|避け|無効|削除|上限|制限|必須|やめて)/g) +
    scoreMatches(source, /(warning|danger|must not|never|avoid)/gi) * 0.9;
  const shyScore =
    scoreMatches(source, /(すみません|ごめん|申し訳|残念|難しい|できません|できない|失敗|心配|困|つら|ご不便|失礼)/g) +
    scoreMatches(source, /(sorry|unable|failed)/gi) * 0.82;
  const surprisedScore =
    scoreMatches(source, /(びっくり|驚|おお|えっ|なんと|なるほど)/g) +
    scoreMatches(source, /(?:[?？]+|!{2,}|！？|\?!|!\?)/g) * 0.62;
  const calmScore = Math.min(normalized.length / 160, 1.1) + 0.2;

  const ranked = [
    { gesture: "explain", score: explainScore + 0.18 },
    { gesture: "happy", score: happyScore },
    { gesture: "warn", score: warnScore },
    { gesture: "shy", score: shyScore },
    { gesture: "surprised", score: surprisedScore },
    { gesture: "calm", score: calmScore }
  ].sort((left, right) => right.score - left.score);

  const primary = ranked[0]?.gesture || "calm";
  const emphasisBase = ranked[0]?.score || 0.2;
  return {
    gesture: primary,
    emphasis: THREE.MathUtils.clamp(0.2 + emphasisBase * 0.15, 0.18, 0.86)
  };
}

function setConversationMotion(text) {
  const analysis = analyzeMotionFromText(text);
  motionState.thinkingPoseTarget = 0;
  setMotionGesture(analysis.gesture, analysis.emphasis, performance.now() + MOTION_IDLE_DELAY_MS);
}

function setThinkingMotion() {
  motionState.thinkingPoseTarget = 1;
  setMotionGesture("thinking", 0.58, Number.POSITIVE_INFINITY);
}

function resetConversationExpression() {
  expressionState.activeEmotion = "default";
  expressionState.emphasis = 0;
  expressionState.targetValues = Object.fromEntries(EMOTION_PRESETS.map((preset) => [preset, 0]));
  expressionState.holdUntilMs = 0;
}

function stopThinkingMotion() {
  motionState.thinkingPoseTarget = 0;
  motionState.holdUntilMs = Math.max(motionState.holdUntilMs || 0, performance.now() + 260);
}

function resetConversationMotion() {
  motionState.thinkingPoseTarget = 0;
  motionState.thinkingPoseWeight = 0;
  motionState.currentWeight = 0;
  motionState.releaseGesture = "idle";
  setMotionGesture("idle", 0, 0);
}

function setMotionGesture(gesture, emphasis, holdUntilMs) {
  if (gesture !== "idle" && gesture !== "thinking") {
    motionState.releaseGesture = gesture;
  } else if (
    gesture === "idle"
    && motionState.activeGesture !== "idle"
    && motionState.activeGesture !== "thinking"
  ) {
    motionState.releaseGesture = motionState.activeGesture;
  }
  if (motionState.activeGesture !== gesture) {
    motionState.gestureStartedAtMs = performance.now();
  }
  motionState.activeGesture = gesture;
  motionState.emphasis = emphasis;
  motionState.holdUntilMs = holdUntilMs;
}

function replaceMessages(history) {
  messages.length = 0;
  messagesEl.replaceChildren();
  let latestAssistantContent = "";

  for (const message of history) {
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = String(message.content || "");
    if (!content) {
      continue;
    }

    messages.push({ role, content });
    renderMessage(role, content);
    if (role === "assistant") {
      latestAssistantContent = content;
    }
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (latestAssistantContent) {
    resetConversationExpression();
    resetConversationMotion();
  }
}

async function loadSavedHistory() {
  try {
    const response = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "History request failed.");
    }

    const history = Array.isArray(data.messages) ? data.messages : [];
    if (!history.length) {
      setElementText(dbState, "会話DB準備完了 / まだ保存された会話はありません");
      return false;
    }

    replaceMessages(history);
    const totalCount = Number(data.totalCount) || history.length;
    setElementText(
      dbState,
      totalCount > history.length
        ? `会話履歴を復元 (${history.length} / ${totalCount} messages)`
        : `会話履歴を復元 (${history.length} messages)`
    );
    return true;
  } catch (error) {
    console.error(error);
    setElementText(dbState, "会話履歴の復元に失敗");
    return false;
  }
}

function createCameraTools() {
  const controlsPanel = document.querySelector(".controls");
  if (!controlsPanel || controlsPanel.querySelector("[data-camera-tools='true']")) {
    return;
  }

  ensureCameraToolsStyles();

  const wrapper = document.createElement("div");
  wrapper.dataset.cameraTools = "true";
  wrapper.className = "cameraTools";
  wrapper.innerHTML = `
    <div class="cameraToolsHeader">
      <div class="meta">カメラ</div>
      <div class="cameraToolsActions">
        <button class="cameraTestButton" type="button">口テスト</button>
        <button class="cameraResetButton" type="button">リセット</button>
      </div>
    </div>
    <div class="field">
      <label for="cameraHeightRange">高さ <span class="cameraValue" data-role="heightValue">0.00</span></label>
      <input id="cameraHeightRange" class="cameraRange" type="range" min="-1.8" max="1.2" step="0.01" value="0" />
    </div>
    <div class="field">
      <label for="cameraDistanceRange">ズーム <span class="cameraValue" data-role="distanceValue">0.00</span></label>
      <input id="cameraDistanceRange" class="cameraRange" type="range" min="-3.4" max="1.8" step="0.01" value="0" />
    </div>
    <div class="field">
      <label for="cameraHorizontalRange">左右 <span class="cameraValue" data-role="horizontalValue">0.00</span></label>
      <input id="cameraHorizontalRange" class="cameraRange" type="range" min="-1.2" max="1.2" step="0.01" value="0" />
    </div>
  `;

  controlsPanel.appendChild(wrapper);

  const heightInput = wrapper.querySelector("#cameraHeightRange");
  const distanceInput = wrapper.querySelector("#cameraDistanceRange");
  const horizontalInput = wrapper.querySelector("#cameraHorizontalRange");
  const resetButton = wrapper.querySelector(".cameraResetButton");
  const testButton = wrapper.querySelector(".cameraTestButton");
  const heightValue = wrapper.querySelector("[data-role='heightValue']");
  const distanceValue = wrapper.querySelector("[data-role='distanceValue']");
  const horizontalValue = wrapper.querySelector("[data-role='horizontalValue']");

  const handleInput = () => {
    if (!currentModel) {
      return;
    }

    saveCameraAdjustment(currentModel, {
      heightOffset: Number(heightInput.value),
      distanceOffset: Number(distanceInput.value),
      horizontalOffset: Number(horizontalInput.value)
    });
    applyCurrentCameraFrame();
    updateCameraTools();
  };

  heightInput.addEventListener("input", handleInput);
  distanceInput.addEventListener("input", handleInput);
  horizontalInput.addEventListener("input", handleInput);
  resetButton.addEventListener("click", () => {
    if (!currentModel) {
      return;
    }

    saveCameraAdjustment(currentModel, DEFAULT_CAMERA_ADJUSTMENTS);
    applyCurrentCameraFrame();
    updateCameraTools();
  });
  testButton.addEventListener("click", () => {
    startMouthDiagnosticTest();
  });

  cameraTools = {
    wrapper,
    heightInput,
    distanceInput,
    horizontalInput,
    resetButton,
    testButton,
    heightValue,
    distanceValue,
    horizontalValue
  };

  updateCameraTools();
}

function createVoiceTools() {
  const controlsPanel = document.querySelector(".controls");
  if (!controlsPanel || controlsPanel.querySelector("[data-voice-tools='true']")) {
    return;
  }

  ensureVoiceToolsStyles();

  const wrapper = document.createElement("div");
  wrapper.dataset.voiceTools = "true";
  wrapper.className = "voiceTools";
  wrapper.innerHTML = `
      <div class="voiceToolsHeader">
        <div class="meta">${MINIMAL_APP_MODE ? "ボイス" : "女性ボイス"}</div>
        <label class="voiceToggle">
          <input id="voiceEnabledToggle" type="checkbox" />
          <span>音声ON</span>
      </label>
    </div>
    <div class="field">
      <label for="voiceSelectInput">ボイス</label>
      <select id="voiceSelectInput"></select>
    </div>
    <div class="meta" data-role="voiceStatus">音声を準備中...</div>
  `;

  controlsPanel.appendChild(wrapper);

  const enabledToggle = wrapper.querySelector("#voiceEnabledToggle");
  const voiceSelect = wrapper.querySelector("#voiceSelectInput");
  const voiceStatus = wrapper.querySelector("[data-role='voiceStatus']");

  enabledToggle.addEventListener("change", () => {
    const settings = getVoiceSettings();
    saveVoiceSettings({
      ...settings,
      enabled: enabledToggle.checked
    });

    if (!enabledToggle.checked && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      stopLipSync(currentVrm, true);
    }

    updateVoiceTools();
  });

  voiceSelect.addEventListener("change", () => {
    const settings = getVoiceSettings();
    saveVoiceSettings({
      ...settings,
      voiceURI: voiceSelect.value || ""
    });
    updateVoiceTools();
  });

  voiceTools = {
    wrapper,
    enabledToggle,
    voiceSelect,
    voiceStatus
  };

  updateVoiceTools();
}

function ensureCameraToolsStyles() {
  if (document.getElementById("camera-tools-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "camera-tools-style";
  style.textContent = `
    .cameraTools {
      display: grid;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(98, 67, 39, 0.14);
    }
    .cameraToolsHeader {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .cameraToolsActions {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .cameraTestButton,
    .cameraResetButton {
      border: 1px solid rgba(98, 67, 39, 0.18);
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(255, 252, 247, 0.98);
      color: #2f241b;
      font: inherit;
      cursor: pointer;
    }
    .cameraRange {
      width: 100%;
      accent-color: #b35f31;
    }
    .cameraValue {
      color: #6e5a4b;
      font-size: 0.88rem;
      margin-left: 6px;
    }
  `;
  document.head.appendChild(style);
}

function ensureVoiceToolsStyles() {
  if (document.getElementById("voice-tools-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "voice-tools-style";
  style.textContent = `
    .voiceTools {
      display: grid;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(98, 67, 39, 0.14);
    }
    .voiceToolsHeader {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .voiceToggle {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      color: #6e5a4b;
      font-size: 0.9rem;
    }
    .voiceToggle input {
      accent-color: #b35f31;
    }
  `;
  document.head.appendChild(style);
}

function updateCameraTools() {
  if (!cameraTools) {
    return;
  }

  const fileName = currentModel || modelSelect.value;
  const hasModel = Boolean(fileName);
  const adjustment = hasModel
    ? getCameraAdjustment(fileName)
    : DEFAULT_CAMERA_ADJUSTMENTS;
  const range = hasModel
    ? getCameraToolRange(fileName)
    : {
        minHeightOffset: CAMERA_HEIGHT_RANGE_FALLBACK.min,
        maxHeightOffset: CAMERA_HEIGHT_RANGE_FALLBACK.max,
        minDistanceOffset: CAMERA_DISTANCE_RANGE_FALLBACK.min,
        maxDistanceOffset: CAMERA_DISTANCE_RANGE_FALLBACK.max,
        minHorizontalOffset: CAMERA_HORIZONTAL_RANGE_FALLBACK.min,
        maxHorizontalOffset: CAMERA_HORIZONTAL_RANGE_FALLBACK.max
      };
  const nextHeightValue = clampNumber(
    adjustment.heightOffset,
    range.minHeightOffset,
    range.maxHeightOffset
  );
  const nextDistanceValue = clampNumber(
    adjustment.distanceOffset,
    range.minDistanceOffset,
    range.maxDistanceOffset
  );
  const nextHorizontalValue = clampNumber(
    adjustment.horizontalOffset,
    range.minHorizontalOffset,
    range.maxHorizontalOffset
  );

  cameraTools.heightInput.disabled = !hasModel;
  cameraTools.distanceInput.disabled = !hasModel;
  cameraTools.horizontalInput.disabled = !hasModel;
  cameraTools.resetButton.disabled = !hasModel;
  if (cameraTools.testButton) {
    cameraTools.testButton.disabled = !hasModel;
  }

  cameraTools.heightInput.min = String(range.minHeightOffset);
  cameraTools.heightInput.max = String(range.maxHeightOffset);
  cameraTools.distanceInput.min = String(range.minDistanceOffset);
  cameraTools.distanceInput.max = String(range.maxDistanceOffset);
  cameraTools.horizontalInput.min = String(range.minHorizontalOffset);
  cameraTools.horizontalInput.max = String(range.maxHorizontalOffset);

  cameraTools.heightInput.value = String(nextHeightValue);
  cameraTools.distanceInput.value = String(nextDistanceValue);
  cameraTools.horizontalInput.value = String(nextHorizontalValue);
  cameraTools.heightValue.textContent = formatSignedValue(nextHeightValue);
  cameraTools.distanceValue.textContent = formatSignedValue(nextDistanceValue);
  cameraTools.horizontalValue.textContent = formatSignedValue(nextHorizontalValue);
}

function initSpeechSupport() {
  if (!("speechSynthesis" in window)) {
    updateVoiceTools();
    return;
  }

  refreshAvailableVoices();

  const synth = window.speechSynthesis;
  if (typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", refreshAvailableVoices);
  } else {
    synth.onvoiceschanged = refreshAvailableVoices;
  }

  const primeSpeech = () => {
    try {
      synth.resume();
      refreshAvailableVoices();
    } catch {
      // Ignore browser-specific speech initialization errors.
    }
  };

  window.addEventListener("pointerdown", primeSpeech, { passive: true, once: true });
  window.addEventListener("touchstart", primeSpeech, { passive: true, once: true });
}

function getCuteVoicePriority(voice) {
  const haystack = `${voice?.name || ""} ${voice?.voiceURI || ""}`.trim();
  for (let index = 0; index < CUTE_VOICE_NAME_PRIORITY.length; index += 1) {
    if (CUTE_VOICE_NAME_PRIORITY[index].test(haystack)) {
      return index;
    }
  }
  return CUTE_VOICE_NAME_PRIORITY.length;
}

function refreshAvailableVoices() {
  if (!("speechSynthesis" in window)) {
    availableVoices = [];
    updateVoiceTools();
    return;
  }

  availableVoices = window.speechSynthesis.getVoices().slice().sort((left, right) => {
    const leftJa = /^ja\b/i.test(left.lang || "") ? 1 : 0;
    const rightJa = /^ja\b/i.test(right.lang || "") ? 1 : 0;
    if (leftJa !== rightJa) {
      return rightJa - leftJa;
    }
    const leftFemale = isLikelyFemaleVoice(left) ? 1 : 0;
    const rightFemale = isLikelyFemaleVoice(right) ? 1 : 0;
    if (leftFemale !== rightFemale) {
      return rightFemale - leftFemale;
    }
    const cutePriorityDiff = getCuteVoicePriority(left) - getCuteVoicePriority(right);
    if (cutePriorityDiff !== 0) {
      return cutePriorityDiff;
    }
    return String(left.name || "").localeCompare(String(right.name || ""), "ja");
  });

  updateVoiceTools();
}

function isLikelyFemaleVoice(voice) {
  const haystack = `${voice?.name || ""} ${voice?.voiceURI || ""}`.trim();
  return FEMALE_VOICE_NAME_PATTERN.test(haystack);
}

function getSelectableVoices() {
  if (!availableVoices.length) {
    return [];
  }

  const japaneseFemaleVoices = availableVoices.filter(
    (voice) => /^ja\b/i.test(voice.lang || "") && isLikelyFemaleVoice(voice)
  );
  if (japaneseFemaleVoices.length) {
    return japaneseFemaleVoices;
  }

  const femaleVoices = availableVoices.filter((voice) => isLikelyFemaleVoice(voice));
  if (femaleVoices.length) {
    return femaleVoices;
  }

  const japaneseVoices = availableVoices.filter((voice) => /^ja\b/i.test(voice.lang || ""));
  if (japaneseVoices.length) {
    return japaneseVoices;
  }

  return availableVoices;
}

function updateVoiceTools() {
  if (!voiceTools) {
    return;
  }

  if (!("speechSynthesis" in window)) {
    voiceTools.enabledToggle.checked = false;
    voiceTools.enabledToggle.disabled = true;
    voiceTools.voiceSelect.disabled = true;
    voiceTools.voiceSelect.replaceChildren(new Option("このブラウザは音声非対応", ""));
    voiceTools.voiceStatus.textContent = "このブラウザでは音声読み上げを使えません。";
    return;
  }

  const settings = getVoiceSettings();
  const preferredVoice = getPreferredSpeechVoice(settings);
  const selectableVoices = getSelectableVoices();

  voiceTools.enabledToggle.disabled = false;
  voiceTools.enabledToggle.checked = settings.enabled;

  const nextOptions = [new Option("自動 (女性おすすめ)", "")];
  for (const voice of selectableVoices) {
    const suffix = voice.lang ? ` (${voice.lang})` : "";
    nextOptions.push(new Option(`${voice.name}${suffix}`, voice.voiceURI));
  }

  voiceTools.voiceSelect.replaceChildren(...nextOptions);
  voiceTools.voiceSelect.value = settings.voiceURI || "";
  if (voiceTools.voiceSelect.value !== (settings.voiceURI || "")) {
    voiceTools.voiceSelect.value = "";
  }
  voiceTools.voiceSelect.disabled = !settings.enabled || selectableVoices.length === 0;

  if (!settings.enabled) {
    voiceTools.voiceStatus.textContent = MINIMAL_APP_MODE ? "音声オフ" : "返答音声はオフです。";
    return;
  }

  if (!selectableVoices.length) {
    voiceTools.voiceStatus.textContent = MINIMAL_APP_MODE
      ? "音声を準備中..."
      : "音声を読み込み中です。少し待ってから送信してください。";
    return;
  }

  const label = preferredVoice
    ? `${preferredVoice.name}${preferredVoice.lang ? ` / ${preferredVoice.lang}` : ""}`
    : "システム既定";
  voiceTools.voiceStatus.textContent = MINIMAL_APP_MODE ? label : `返答を ${label} で読み上げます。`;
}

function formatSignedValue(value) {
  const number = Number(value) || 0;
  const sign = number > 0 ? "+" : "";
  return sign + number.toFixed(2);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function getCameraToolRange(fileName) {
  return cameraToolRanges.get(fileName) || {
    minHeightOffset: CAMERA_HEIGHT_RANGE_FALLBACK.min,
    maxHeightOffset: CAMERA_HEIGHT_RANGE_FALLBACK.max,
    minDistanceOffset: CAMERA_DISTANCE_RANGE_FALLBACK.min,
    maxDistanceOffset: CAMERA_DISTANCE_RANGE_FALLBACK.max,
    minHorizontalOffset: CAMERA_HORIZONTAL_RANGE_FALLBACK.min,
    maxHorizontalOffset: CAMERA_HORIZONTAL_RANGE_FALLBACK.max
  };
}

function loadCameraAdjustments() {
  try {
    const raw = window.localStorage.getItem(CAMERA_ADJUSTMENTS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getCameraAdjustment(fileName) {
  const adjustments = loadCameraAdjustments();
  const saved = adjustments[fileName];

  if (!saved || typeof saved !== "object") {
    return { ...DEFAULT_CAMERA_ADJUSTMENTS };
  }

  return {
    heightOffset: Number(saved.heightOffset) || 0,
    distanceOffset: Number(saved.distanceOffset) || 0,
    horizontalOffset: Number(saved.horizontalOffset) || 0
  };
}

function saveCameraAdjustment(fileName, adjustment) {
  if (!fileName) {
    return;
  }

  try {
    const adjustments = loadCameraAdjustments();
    adjustments[fileName] = {
      heightOffset: Number(adjustment.heightOffset) || 0,
      distanceOffset: Number(adjustment.distanceOffset) || 0,
      horizontalOffset: Number(adjustment.horizontalOffset) || 0
    };
    window.localStorage.setItem(CAMERA_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(adjustments));
  } catch {
    // Ignore storage failures so the viewer still works in private browsing modes.
  }
}

function loadVoiceSettings() {
  try {
    const raw = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_VOICE_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? {
          enabled: parsed.enabled !== false,
          voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : ""
        }
      : { ...DEFAULT_VOICE_SETTINGS };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

function getVoiceSettings() {
  return loadVoiceSettings();
}

function saveVoiceSettings(settings) {
  try {
    window.localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify({
      enabled: settings.enabled !== false,
      voiceURI: typeof settings.voiceURI === "string" ? settings.voiceURI : ""
    }));
  } catch {
    // Ignore storage failures so the viewer keeps working.
  }
}

function getPreferredSpeechVoice(settings = getVoiceSettings()) {
  const selectableVoices = getSelectableVoices();
  const selectedVoice = settings.voiceURI
    ? selectableVoices.find((voice) => voice.voiceURI === settings.voiceURI)
    : null;
  if (selectedVoice) {
    return selectedVoice;
  }

  return selectableVoices[0] || availableVoices[0] || null;
}

function applyCurrentCameraFrame() {
  if (!app || !currentSceneRoot || !currentModel) {
    return;
  }

  fitAvatarToView(currentSceneRoot, app.camera, app.lookTarget, currentModel);
}

function setStatus(message, detail) {
  if (!status) {
    return;
  }
  status.textContent = `${message} · ${BUILD_VERSION}`;
  status.title = detail || "";
}

function showFailure(message, error) {
  const detail = formatError(error);
  console.error(message, error);
  setStatus(message, detail);
  let debugFailure = document.getElementById("debugFailure");
  if (!debugFailure) {
    debugFailure = document.createElement("div");
    debugFailure.id = "debugFailure";
    Object.assign(debugFailure.style, {
      position: "absolute",
      left: "12px",
      right: "12px",
      bottom: "12px",
      zIndex: "3",
      padding: "10px 12px",
      borderRadius: "14px",
      background: "rgba(255, 246, 241, 0.95)",
      border: "1px solid rgba(176, 88, 54, 0.24)",
      color: "#8e4720",
      fontSize: "12px",
      lineHeight: "1.45",
      whiteSpace: "pre-wrap",
      boxShadow: "0 12px 24px rgba(74, 50, 28, 0.12)"
    });
    const viewer = document.querySelector(".viewer");
    viewer?.appendChild(debugFailure);
  }
  debugFailure.textContent = detail || message;
}

function formatError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error.message === "string") {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function syncStageHeight() {
  const nextHeight =
    window.innerWidth >= 980
      ? Math.max(window.innerHeight - 32, 520)
      : Math.max(Math.round(window.innerHeight * 0.54), 360);

  container.style.height = `${nextHeight}px`;
}

async function waitForStageLayout() {
  syncStageHeight();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { width, height } = measureStage();
    if (width >= 120 && height >= 120) {
      return;
    }
    await nextFrame();
    syncStageHeight();
  }

  const { width, height } = measureStage();
  if (width < 120 || height < 120) {
    throw new Error("Stage layout did not become ready.");
  }
}

function measureStage() {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.round(rect.width || container.clientWidth || window.innerWidth || 360),
    height: Math.round(
      rect.height ||
        container.clientHeight ||
        Math.max(Math.round(window.innerHeight * 0.54), 360)
    )
  };
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

function verifyWebGL() {
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2", { alpha: true, antialias: true }) ||
    canvas.getContext("webgl", { alpha: true, antialias: true }) ||
    canvas.getContext("experimental-webgl", { alpha: true, antialias: true });

  if (!gl) {
    throw new Error("WebGL is not available in this browser.");
  }
}

async function initViewer() {
  setStatus("Loading viewer...");
  verifyWebGL();

  const stageSize = measureStage();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe5d5");
  scene.fog = new THREE.Fog("#efe5d5", 8, 18);

  const camera = new THREE.PerspectiveCamera(
    30,
    stageSize.width / stageSize.height,
    0.1,
    50
  );
  const lookTarget = new THREE.Vector3(0, 0.36, 0);
  camera.position.set(0.06, 0.5, 2.68);
  applyCameraLookAt(camera, lookTarget, CAMERA_PITCH_DOWN_OFFSET);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stageSize.width, stageSize.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "default";
  container.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight("#fff7ef", "#8f6e55", 1.8));

  const keyLight = new THREE.DirectionalLight("#ffffff", 1.8);
  keyLight.position.set(1.5, 3, 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight("#f2cfa4", 0.8);
  fillLight.position.set(-2, 1.5, 1.5);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 64),
    new THREE.MeshStandardMaterial({
      color: "#caa98f",
      transparent: true,
      opacity: 0.28
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.05;
  scene.add(floor);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const clock = new THREE.Clock();

  const resizeHandler = () => {
    syncStageHeight();
    const size = measureStage();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height, false);
    if (currentSceneRoot && currentModel) {
      fitAvatarToView(currentSceneRoot, camera, lookTarget, currentModel);
    }
  };

  window.addEventListener("resize", resizeHandler);

  function animate() {
    const delta = clock.getDelta();
    const elapsed = clock.elapsedTime;

      if (currentVrm) {
        applyRelaxedPose(currentVrm, elapsed);
        applyConversationMotion(currentVrm, elapsed);
        applyConversationExpression(currentVrm, elapsed, delta);
        applyBlink(currentVrm, elapsed);
        applyLipSync(currentVrm);
        currentVrm.update(delta);
        applyDirectMouthMorphFallback();
      }

    updateLipSyncDebug();
    applyCameraLookAt(camera, lookTarget, CAMERA_PITCH_DOWN_OFFSET);
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  animate();

  return { scene, camera, loader, renderer, resizeHandler, lookTarget };
}

async function loadModelList() {
  const response = await fetch("/api/models");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch model list.");
  }

  const models = Array.isArray(data.models) ? data.models : [];
  if (!models.length) {
    throw new Error("No VRM files were found in /models.");
  }

  modelSelect.innerHTML = "";
  for (const file of models) {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = file;
    modelSelect.appendChild(option);
  }

  const storedModel = loadSelectedModel();
  const preferred = models.includes(FIXED_MODEL_NAME)
    ? FIXED_MODEL_NAME
    : models.includes(storedModel)
    ? storedModel
    : models.includes(data.defaultModel)
      ? data.defaultModel
      : models[0];

  modelSelect.value = preferred;
  saveSelectedModel(preferred);
  await loadModel(preferred);
}

async function loadModel(fileName) {
  if (!app || !fileName) {
    return;
  }

  if (fileName === currentModel) {
    modelSelect.value = fileName;
    return;
  }

  setStatus("Loading avatar...");

  const { loader, scene, camera, lookTarget } = app;
  const nextModel = await loadModelScene(loader, fileName);

  if (currentVrm) {
    stopLipSync(currentVrm, true);
  }

  if (currentSceneRoot) {
    scene.remove(currentSceneRoot);
  }

  currentSceneRoot = nextModel.root;
  currentVrm = nextModel.vrm;
  currentMorphTargetBindings = nextModel.morphTargetBindings;
  currentModel = fileName;

  fitAvatarToView(currentSceneRoot, camera, lookTarget, fileName);
  scene.add(currentSceneRoot);
  if (fileName === FIXED_MODEL_NAME) {
    upgradeFixedGirlBaseTextures(currentSceneRoot);
  }
  updateCameraTools();
  setStatus(nextModel.isBasic ? "Ready (basic)" : nextModel.vrm ? "Ready" : "Ready (basic)");

  if (DEBUG_LIP_SYNC_AUTORUN) {
    window.setTimeout(() => {
      startLipSync("あいうえお こんにちは 今日はFXとゲームの話をしよう", 1);
    }, 600);
  }
}

function getModelAssetFileName(fileName) {
  return fileName === FIXED_MODEL_NAME ? FIXED_MODEL_ASSET_FILE_NAME : fileName;
}

function isFixedGirlFaceMaterial(material) {
  return /Face|Eye/i.test(String(material?.name || ""));
}

function isFixedGirlBodyMaterial(material) {
  const name = String(material?.name || "");
  return /Body|Shoes|Hair|CLOTH/i.test(name);
}

async function loadTextureFromModelFile(fileName) {
  const response = await fetch(`./models/${encodeURIComponent(fileName)}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch texture: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const texture = await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        objectUrl,
        resolve,
        undefined,
        (error) => reject(error || new Error(`Failed to load texture ${fileName}.`))
      );
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function ensureFixedGirlBaseTextures() {
  if (fixedGirlTextureState.face && fixedGirlTextureState.body) {
    return fixedGirlTextureState;
  }

  if (!fixedGirlTextureState.pending) {
    fixedGirlTextureState.pending = Promise.all([
      loadTextureFromModelFile(FIXED_GIRL_FACE_TEXTURE_FILE),
      loadTextureFromModelFile(FIXED_GIRL_BODY_TEXTURE_FILE)
    ])
      .then(([face, body]) => {
        fixedGirlTextureState.face = face;
        fixedGirlTextureState.body = body;
        return fixedGirlTextureState;
      })
      .finally(() => {
        fixedGirlTextureState.pending = null;
      });
  }

  return fixedGirlTextureState.pending;
}

async function upgradeFixedGirlBaseTextures(root) {
  try {
    const { face, body } = await ensureFixedGirlBaseTextures();
    if (currentSceneRoot !== root || currentModel !== FIXED_MODEL_NAME) {
      return;
    }

    root.traverse((object) => {
      if (!object?.isMesh || !object.material) {
        return;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (isFixedGirlFaceMaterial(material)) {
          material.map = face;
          material.needsUpdate = true;
        } else if (isFixedGirlBodyMaterial(material)) {
          material.map = body;
          material.needsUpdate = true;
        }
      }
    });
  } catch (error) {
    console.warn("upgradeFixedGirlBaseTextures failed", error);
  }
}

async function loadModelScene(loader, fileName) {
  const assetFileName = getModelAssetFileName(fileName);
  const modelUrl = `./models/${encodeURIComponent(assetFileName)}`;
  setStatus("Fetching avatar...");

  const response = await fetch(modelUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  setStatus("Parsing avatar...");

  const gltf = await new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Model parsing timed out."));
    }, 20000);

    loader.parse(
      arrayBuffer,
      `${window.location.origin}/models/`,
      (parsed) => {
        window.clearTimeout(timeoutId);
        resolve(parsed);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error || new Error("GLTFLoader could not parse the model."));
      }
    );
  });

  setStatus("Preparing avatar...");

  const vrm = gltf.userData?.vrm || null;
  const deferHeavyPostLoadWork = fileName === FIXED_MODEL_NAME;

  if (vrm && !deferHeavyPostLoadWork) {
    try {
      VRMUtils.rotateVRM0(vrm);
    } catch (error) {
      console.warn("rotateVRM0 failed", error);
    }

    try {
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
    } catch (error) {
      console.warn("removeUnnecessaryVertices failed", error);
    }

    try {
      VRMUtils.combineSkeletons(gltf.scene);
    } catch (error) {
      console.warn("combineSkeletons failed", error);
    }
  }

  const root = vrm?.scene || gltf.scene;
  if (!root) {
    throw new Error("Model scene was empty.");
  }

  root.rotation.y = Math.PI;
  root.traverse((object) => {
    object.frustumCulled = false;
  });

  const morphTargetBindings = deferHeavyPostLoadWork
    ? new Map()
    : collectMorphTargetBindings(root);

  if (deferHeavyPostLoadWork) {
    window.setTimeout(() => {
      try {
        const deferredBindings = collectMorphTargetBindings(root);
        if (currentSceneRoot === root) {
          currentMorphTargetBindings = deferredBindings;
        }
      } catch (error) {
        console.warn("deferred morph binding collection failed", error);
      }
    }, 0);
  }

  return {
    root,
    vrm,
    morphTargetBindings,
    isBasic: false
  };
}

function getNamedNode(root, names = []) {
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (node) {
      return node;
    }
  }
  return null;
}

function createBasicHumanoidAdapter(root) {
  return {
    getNormalizedBoneNode(boneName) {
      return getNamedNode(root, BASIC_HUMANOID_NODE_NAME_MAP[boneName] || []);
    },
    getRawBoneNode(boneName) {
      return getNamedNode(root, BASIC_HUMANOID_NODE_NAME_MAP[boneName] || []);
    }
  };
}

function createBasicVrmAdapter(root) {
  return {
    scene: root,
    humanoid: createBasicHumanoidAdapter(root),
    expressionManager: null,
    update() {}
  };
}

async function loadBasicModelScene(fileName) {
  const response = await fetch(`./models/${encodeURIComponent(fileName)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const basicLoader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    basicLoader.parse(
      arrayBuffer,
      `${window.location.origin}/models/`,
      (gltf) => {
        try {
          const root = gltf.scene;
          if (!root) {
            reject(new Error("Basic model scene was empty."));
            return;
          }

          root.traverse((object) => {
            object.frustumCulled = false;
          });

          resolve({
            root,
            vrm: createBasicVrmAdapter(root),
            morphTargetBindings: new Map(),
            isBasic: true
          });
        } catch (error) {
          reject(error);
        }
      },
      (error) => reject(error || new Error("Basic GLTFLoader could not parse the model."))
    );
  });
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    setElementText(
      apiState,
      data.openaiConfigured
        ? `API ready (${data.model})`
        : "API key missing"
    );

    if (data.database?.available) {
      const sessionCount = Number(data.database.sessionCount) || 0;
      const messageCount = Number(data.database.messageCount) || 0;
      setElementText(
        dbState,
        messageCount
          ? `会話DB ready (${messageCount} messages / ${sessionCount} sessions)`
          : "会話DB ready"
      );
    } else {
      setElementText(dbState, data.database?.message || "会話DB未接続");
    }

    if (data.memoryImport?.available) {
      const chats = Number(data.memoryImport.conversationCount) || 0;
      const memories = Number(data.memoryImport.snippetCount) || 0;
      setElementText(memoryState, `ChatGPT data loaded (${chats} chats / ${memories} memories)`);
    } else {
      setElementText(memoryState, data.memoryImport?.message || "ChatGPTデータ未検出");
    }

    updateGrowthState(data.growth);
  } catch (error) {
    console.error(error);
    setElementText(apiState, "API check failed");
    setElementText(dbState, "会話DB確認失敗");
    setElementText(memoryState, "ChatGPTデータ確認失敗");
    setElementText(growthState, "AI growth 確認失敗");
  }
}

function updateGrowthState(growth, growthLearning = null) {
  if (!growthState) {
    return;
  }

  if (!growth?.available) {
    growthState.textContent = growth?.message || "AI growth unavailable";
    return;
  }

  const parts = [
    `AI growth Lv${growth.level}`,
    `${growth.learnedMemoryCount} memories`,
    `${growth.topicCount} topics`,
    `${growth.experiencePoints} xp`
  ];

  const learnedCount = Number(growthLearning?.learnedCount) || 0;
  const reinforcedCount = Number(growthLearning?.reinforcedCount) || 0;
  const deltaParts = [];
  if (learnedCount > 0) {
    deltaParts.push(`+${learnedCount} learned`);
  }
  if (reinforcedCount > 0) {
    deltaParts.push(`+${reinforcedCount} reinforced`);
  }

  growthState.textContent = deltaParts.length
    ? `${parts.join(" / ")} / ${deltaParts.join(", ")}`
    : parts.join(" / ");
}

function addMessage(role, content, options = {}) {
  const { affectExpression = role === "assistant" } = options;
  const message = { role, content };
  messages.push(message);
  renderMessage(role, content);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (role === "assistant" && affectExpression) {
    setConversationExpression(content);
    setConversationMotion(content);
  }
}

function getVisemeForChar(char) {
  if (!char) {
    return null;
  }

  const lower = char.toLowerCase();
  if ("あかさたなはまやらわがざだばぱぁゃゎアカサタナハマヤラワガザダバパァャヮa".includes(char) || lower === "a") {
    return "aa";
  }
  if ("いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィi".includes(char) || lower === "i") {
    return "ih";
  }
  if ("うくすつぬふむゆるぐずづぶぷぅゅウクスツヌフムユルグズヅブプゥュu".includes(char) || lower === "u") {
    return "ou";
  }
  if ("えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェe".includes(char) || lower === "e") {
    return "ee";
  }
  if ("おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョo".includes(char) || lower === "o") {
    return "oh";
  }
  return null;
}

function isCjkIdeograph(char) {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(char);
}

function selectVisemePattern(char, patterns) {
  const pool = Array.isArray(patterns) && patterns.length ? patterns : FALLBACK_VISEME_PATTERNS;
  const codePoint = String(char || "").codePointAt(0) || 0;
  return pool[codePoint % pool.length];
}

function getJawOpennessForViseme(viseme) {
  return VISEME_JAW_OPENNESS[viseme] ?? 0.68;
}

function collapseVisemePattern(pattern, strengthScale = 1) {
  const normalizedPattern = Array.isArray(pattern) && pattern.length ? pattern : [{ viseme: "aa", durationMs: 120, strength: 0.4 }];
  let strongest = normalizedPattern[0];
  let durationMs = 0;

  for (const part of normalizedPattern) {
    durationMs += Number(part.durationMs) || 0;
    if ((Number(part.strength) || 0) > (Number(strongest?.strength) || 0)) {
      strongest = part;
    }
  }

  return {
    viseme: strongest?.viseme || "aa",
    durationMs: Math.max(90, Math.round(durationMs)),
    strength: THREE.MathUtils.clamp((Number(strongest?.strength) || 0.4) * strengthScale, 0.16, 0.62)
  };
}

function compressLipSyncTargets(targetValues) {
  const useFixedGirlLimits = currentModel === FIXED_MODEL_NAME;
  const maxPeakLimit = useFixedGirlLimits ? FIXED_GIRL_MAX_VISEME_PEAK : MAX_VISEME_PEAK;
  const maxTotalLimit = useFixedGirlLimits ? FIXED_GIRL_MAX_VISEME_TOTAL : MAX_VISEME_TOTAL;
  let maxTarget = 0;
  let totalTarget = 0;

  for (const viseme of MOUTH_VISEMES) {
    const value = Math.max(0, targetValues[viseme] || 0);
    maxTarget = Math.max(maxTarget, value);
    totalTarget += value;
  }

  const peakScale = maxTarget > maxPeakLimit
    ? maxPeakLimit / maxTarget
    : 1;
  const totalScale = totalTarget > maxTotalLimit
    ? maxTotalLimit / totalTarget
    : 1;
  const scale = Math.min(peakScale, totalScale);

  if (scale >= 0.999) {
    return;
  }

  for (const viseme of MOUTH_VISEMES) {
    targetValues[viseme] = (targetValues[viseme] || 0) * scale;
  }
}

function mergeLipSyncFrames(frames) {
  if (!Array.isArray(frames) || frames.length <= 1) {
    return frames || [];
  }

  const merged = [];
  for (const frame of frames) {
    const previous = merged[merged.length - 1];
    const currentSilent = isSilentLipSyncFrame(frame);
    const previousSilent = isSilentLipSyncFrame(previous);
    const shouldMerge = previous
      && (
        (currentSilent && previousSilent)
        || (!currentSilent && !previousSilent && previous.viseme === frame.viseme)
      );

    if (!shouldMerge) {
      merged.push({ ...frame });
      continue;
    }

    previous.durationMs += Number(frame.durationMs) || 0;
    previous.strength = Math.max(Number(previous.strength) || 0, Number(frame.strength) || 0);
    previous.utf16End = frame.utf16End;
    previous.char = `${previous.char || ""}${frame.char || ""}`;
  }

  let hintCursorMs = 0;
  for (const frame of merged) {
    frame.hintStartMs = hintCursorMs;
    hintCursorMs += Number(frame.durationMs) || 0;
    frame.hintEndMs = hintCursorMs;
  }

  return merged;
}

function isSilentLipSyncFrame(frame) {
  return !frame?.viseme || (Number(frame?.strength) || 0) <= 0.01;
}

function resetLiveSpeechMorphTargets() {
  for (const viseme of MOUTH_VISEMES) {
    speechState.frameTargets[viseme] = 0;
  }
  for (const viseme of MOUTH_VISEMES) {
    speechState.liveDirectTargets[viseme] = 0;
  }
  speechState.liveSupportTargets.drop = 0;
  speechState.liveSupportTargets.lift = 0;
  speechState.liveSupportTargets.surprised = 0;
}

function isCurrentUtteranceToken(token) {
  return Boolean(token) && speechState.activeUtteranceToken === token;
}

function collectMorphTargetBindings(root) {
  const bindings = new Map();
  root?.traverse((object) => {
    if (!object?.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) {
      return;
    }

    for (const [targetName, targetIndex] of Object.entries(object.morphTargetDictionary)) {
      if (!bindings.has(targetName)) {
        bindings.set(targetName, []);
      }
      bindings.get(targetName).push({
        mesh: object,
        index: targetIndex
      });
    }
  });
  return bindings;
}

function setMorphTargetValue(targetNames, value) {
  if (!currentMorphTargetBindings || !Array.isArray(targetNames) || !targetNames.length) {
    return;
  }

  const clampedValue = THREE.MathUtils.clamp(value, 0, DIRECT_MORPH_INFLUENCE_LIMIT);
  for (const targetName of targetNames) {
    const bindings = currentMorphTargetBindings.get(targetName);
    if (!bindings?.length) {
      continue;
    }

    for (const binding of bindings) {
      if (!binding?.mesh?.morphTargetInfluences) {
        continue;
      }
      binding.mesh.morphTargetInfluences[binding.index] = clampedValue;
    }
  }
}

function setDirectSpeechMorphValue(viseme, targetValue, blendUp = 0.18, blendDown = 0.24) {
  const targetNames = DIRECT_MOUTH_MORPH_TARGETS[viseme];
  if (!targetNames) {
    return;
  }

  const currentValue = speechState.directMorphValues[viseme] || 0;
  const clampedTarget = THREE.MathUtils.clamp(targetValue, 0, DIRECT_MORPH_INFLUENCE_LIMIT);
  const blend = clampedTarget > currentValue ? blendUp : blendDown;
  const nextValue = THREE.MathUtils.lerp(currentValue, clampedTarget, blend);
  speechState.directMorphValues[viseme] = nextValue < 0.001 ? 0 : nextValue;
  setMorphTargetValue(targetNames, speechState.directMorphValues[viseme]);
}

function setDirectSupportMorphValue(key, targetValue, blendUp = 0.22, blendDown = 0.34) {
  const targetNames = DIRECT_MOUTH_SUPPORT_TARGETS[key];
  if (!targetNames) {
    return;
  }

  const currentValue = speechState.supportValues[key] || 0;
  const clampedTarget = THREE.MathUtils.clamp(targetValue, 0, DIRECT_MORPH_INFLUENCE_LIMIT);
  const blend = clampedTarget > currentValue ? blendUp : blendDown;
  const nextValue = THREE.MathUtils.lerp(currentValue, clampedTarget, blend);
  speechState.supportValues[key] = nextValue < 0.001 ? 0 : nextValue;
  setMorphTargetValue(targetNames, speechState.supportValues[key]);
}

function hasDirectSpeechMorphTargets() {
  if (!currentMorphTargetBindings?.size) {
    return false;
  }

  return ["Fcl_MTH_A", "Fcl_MTH_I", "Fcl_MTH_U", "Fcl_MTH_E", "Fcl_MTH_O", "Fcl_MTH_Down"]
    .every((targetName) => currentMorphTargetBindings.has(targetName));
}

function getJawBoneNode(vrmRef = currentVrm) {
  const humanoid = vrmRef?.humanoid;
  if (!humanoid) {
    return null;
  }

  return humanoid.getNormalizedBoneNode("jaw")
    || humanoid.getRawBoneNode?.("jaw")
    || null;
}

function applyDirectMouthMorphFallback(vrmRef = currentVrm) {
  if (!currentMorphTargetBindings?.size) {
    return;
  }

  if (applyMouthDiagnosticStep(vrmRef)) {
    return;
  }

  const hasJawBone = Boolean(getJawBoneNode(vrmRef));
  const isFixedGirlModel = currentModel === FIXED_MODEL_NAME;
  let dominantViseme = null;
  let dominantValue = 0;
  let secondaryValue = 0;
  let totalValue = 0;
  for (const viseme of MOUTH_VISEMES) {
    const visemeValue = speechState.visemeValues[viseme] || 0;
    if (visemeValue > dominantValue) {
      secondaryValue = dominantValue;
      dominantValue = visemeValue;
      dominantViseme = viseme;
    } else if (visemeValue > secondaryValue) {
      secondaryValue = visemeValue;
    }
    totalValue += visemeValue;
  }
  const speechEnergy = THREE.MathUtils.clamp(
    dominantValue * 0.84 + totalValue * 0.36,
    0,
    DIRECT_MORPH_INFLUENCE_LIMIT
  );
  const aaValue = speechState.visemeValues.aa || 0;
  const ouValue = speechState.visemeValues.ou || 0;
  const eeValue = speechState.visemeValues.ee || 0;
  const ihValue = speechState.visemeValues.ih || 0;
  const ohValue = speechState.visemeValues.oh || 0;
    const mouthActivity = THREE.MathUtils.clamp(dominantValue * 0.76 + totalValue * 0.24, 0, 1);
    const liveDirectPeak = MOUTH_VISEMES.reduce(
      (max, viseme) => Math.max(max, speechState.liveDirectTargets[viseme] || 0),
      0
    );
    const liveSupportPeak = Math.max(
      speechState.liveSupportTargets.drop || 0,
      speechState.liveSupportTargets.lift || 0,
      speechState.liveSupportTargets.surprised || 0
    );
  const effectiveMouthActivity = Math.max(
      mouthActivity,
      THREE.MathUtils.clamp(liveDirectPeak * 0.22, 0, 1),
      THREE.MathUtils.clamp(liveSupportPeak * 0.42, 0, 1)
    );
    const fixedGirlSpeechWindowActive = speechState.active && !hasJawBone && isFixedGirlModel;
    const jawlessSpeechActive = speechState.active && !hasJawBone && effectiveMouthActivity > JAWLESS_ACTIVITY_THRESHOLD;
    const jawlessOpenStrength = jawlessSpeechActive
    ? THREE.MathUtils.clamp(
        0.22
          + dominantValue * 0.68
          + secondaryValue * 0.16
          + aaValue * 0.3
          + ohValue * 0.22
          + ouValue * 0.12,
        0.22,
        1.18
        )
      : 0;

    if (fixedGirlSpeechWindowActive) {
      const currentSpeechFrame = speechState.currentFrameIndex >= 0
        ? speechState.frames[speechState.currentFrameIndex] || null
        : null;
      const nextSpeechFrame = speechState.currentFrameIndex >= 0
        ? speechState.frames[speechState.currentFrameIndex + 1] || null
        : null;
      const hintElapsedMs = speechState.active ? getLipSyncHintElapsedMs(performance.now()) : 0;
      const currentSpeechDurationMs = Math.max(currentSpeechFrame?.durationMs || 0, 1);
      const currentSpeechSilent = isSilentLipSyncFrame(currentSpeechFrame);
      const currentSpeechProgress = currentSpeechFrame
        ? THREE.MathUtils.clamp(
            (hintElapsedMs - currentSpeechFrame.hintStartMs) / currentSpeechDurationMs,
            0,
            1
          )
        : 0;
      const openCurve = Math.sin(
        Math.PI * THREE.MathUtils.clamp(currentSpeechProgress * 0.88 + 0.06, 0, 1)
      );
      const crossFadeToNext = currentSpeechFrame
        ? currentSpeechSilent
          ? THREE.MathUtils.smoothstep(currentSpeechProgress, 0.97, 1)
          : THREE.MathUtils.smoothstep(currentSpeechProgress, 0.66, 0.94)
        : 0;
      const directTargets = Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0]));
      const supportTargets = { open: 0, drop: 0, lift: 0, surprised: 0 };
      const speechDirectGain = currentSpeechSilent ? 1 : 1.12;
      const speechOpenGain = currentSpeechSilent ? 1 : 1.02;
      const speechDropGain = currentSpeechSilent ? 1 : 1.04;
      const speechLiftGain = currentSpeechSilent ? 1 : 0.78;
      const currentPose = currentSpeechFrame?.viseme ? FIXED_GIRL_SPEECH_POSE_MAP[currentSpeechFrame.viseme] : null;
      const nextPose = nextSpeechFrame?.viseme && !isSilentLipSyncFrame(nextSpeechFrame)
        ? FIXED_GIRL_SPEECH_POSE_MAP[nextSpeechFrame.viseme]
        : null;
      const currentPoseWeight = currentPose
        ? THREE.MathUtils.clamp(
            0.12 + (currentSpeechFrame.strength || 0) * (0.62 + openCurve * 0.34),
            0.12,
            0.72
          )
        : 0;
      const nextPoseWeight = nextPose
        ? THREE.MathUtils.clamp(
            (nextSpeechFrame.strength || 0) * crossFadeToNext * 0.66 + crossFadeToNext * 0.02,
            0,
            0.28
          )
        : 0;
      const fixedGirlSpeechIntensity = THREE.MathUtils.clamp(
        Math.max(
          currentPoseWeight * 0.92 + nextPoseWeight * 0.38,
          liveDirectPeak * 0.96,
          liveSupportPeak * 0.88
        ),
        0,
        1
      );
      const fixedGirlOpenStrength = THREE.MathUtils.clamp(
        currentPoseWeight * 0.72
          + nextPoseWeight * 0.28
          + liveDirectPeak * 0.52
          + liveSupportPeak * 0.18,
        0,
        1
      );

      if (currentPose) {
        for (const [targetViseme, value] of Object.entries(currentPose.direct || {})) {
          directTargets[targetViseme] += value * currentPoseWeight;
        }
        supportTargets.open += (currentPose.support?.open || 0) * currentPoseWeight;
        supportTargets.drop += (currentPose.support?.drop || 0) * currentPoseWeight;
        supportTargets.lift += (currentPose.support?.lift || 0) * currentPoseWeight;
        supportTargets.surprised += (currentPose.support?.surprised || 0) * currentPoseWeight;
      }
      if (nextPose) {
        for (const [targetViseme, value] of Object.entries(nextPose.direct || {})) {
          directTargets[targetViseme] += value * nextPoseWeight;
        }
        supportTargets.open += (nextPose.support?.open || 0) * nextPoseWeight;
        supportTargets.drop += (nextPose.support?.drop || 0) * nextPoseWeight;
        supportTargets.lift += (nextPose.support?.lift || 0) * nextPoseWeight;
        supportTargets.surprised += (nextPose.support?.surprised || 0) * nextPoseWeight;
      }

      if (currentSpeechFrame?.viseme && currentPoseWeight > 0.001) {
        directTargets[currentSpeechFrame.viseme] = Math.max(
          directTargets[currentSpeechFrame.viseme] + currentPoseWeight * FIXED_GIRL_LIVE_DOMINANT_BOOST,
          0.03 + currentPoseWeight * 0.14
        );
      }

      for (const viseme of MOUTH_VISEMES) {
        directTargets[viseme] = Math.max(
          directTargets[viseme] * speechDirectGain,
          (speechState.liveDirectTargets[viseme] || 0) * 1.54
        );
      }
      supportTargets.open *= speechOpenGain;
      supportTargets.drop = Math.max(supportTargets.drop * speechDropGain, (speechState.liveSupportTargets.drop || 0) * 1.08);
      supportTargets.lift = Math.max(supportTargets.lift * speechLiftGain, (speechState.liveSupportTargets.lift || 0) * 0.76);
      supportTargets.surprised = Math.max(supportTargets.surprised, (speechState.liveSupportTargets.surprised || 0) * 0.74);

      for (const viseme of MOUTH_VISEMES) {
        setDirectSpeechMorphValue(
          viseme,
          THREE.MathUtils.clamp(
            fixedGirlSpeechIntensity > 0.012 ? directTargets[viseme] : 0,
            0,
            FIXED_GIRL_SPEECH_DIRECT_LIMIT
          ),
          0.28,
          0.32
        );
      }

      const finalDropValue = THREE.MathUtils.clamp(
        Math.max(
          supportTargets.drop + fixedGirlOpenStrength * 0.1,
          fixedGirlSpeechIntensity > 0.012 ? 0.015 + currentPoseWeight * 0.04 : 0
        ),
        0,
        FIXED_GIRL_SPEECH_DROP_LIMIT
      );
      const finalLiftValue = THREE.MathUtils.clamp(
        supportTargets.lift + fixedGirlOpenStrength * 0.02,
        0,
        FIXED_GIRL_SPEECH_LIFT_LIMIT
      );
      const finalSurprisedValue = THREE.MathUtils.clamp(supportTargets.surprised, 0, FIXED_GIRL_SPEECH_SURPRISED_LIMIT);

      setDirectSupportMorphValue(
        "open",
        Math.max(
          supportTargets.open + fixedGirlOpenStrength * 0.04,
          fixedGirlSpeechIntensity > 0.012 ? 0.004 + currentPoseWeight * 0.018 : 0
        ),
        0.16,
        0.26
      );
      setDirectSupportMorphValue("drop", finalDropValue, 0.2, 0.28);
      setDirectSupportMorphValue("lift", finalLiftValue, 0.18, 0.24);
      setDirectSupportMorphValue("surprised", finalSurprisedValue, 0.16, 0.28);
      setDirectSupportMorphValue("close", fixedGirlSpeechIntensity > 0.012 ? 0 : 0.08, 0.26, 0.4);
      setDirectSupportMorphValue("neutral", 0, 0.2, 0.32);
      setMorphTargetValue(DIRECT_MOUTH_CONFLICT_TARGETS, 0);
      return;
    }

    for (const viseme of MOUTH_VISEMES) {
      const targetNames = DIRECT_MOUTH_MORPH_TARGETS[viseme];
    if (!targetNames) {
      continue;
    }

    const rawValue = speechState.visemeValues[viseme] || 0;
    let value = rawValue * DIRECT_MOUTH_MORPH_SCALE;
    if (jawlessSpeechActive) {
      const isDominant = dominantViseme === viseme;
        const fixedGirlValue = viseme === "ou"
          ? THREE.MathUtils.clamp(
              rawValue * 0.82
                + jawlessOpenStrength * 0.28
                + (dominantViseme === "ou" ? dominantValue * 0.14 : 0),
              0,
              0.96
            )
          : viseme === "aa"
            ? THREE.MathUtils.clamp(
                rawValue * 0.42
                  + jawlessOpenStrength * 0.24
                  + (dominantViseme === "aa" ? dominantValue * 0.16 : 0),
                0,
                0.58
              )
          : viseme === "ih"
            ? THREE.MathUtils.clamp(
                rawValue * 0.12
                  + (dominantViseme === "ih" || dominantViseme === "ee" ? dominantValue * 0.06 : 0),
                0,
                0.16
              )
          : viseme === "ee"
              ? THREE.MathUtils.clamp(rawValue * 0.06, 0, 0.1)
              : 0;
      const regularAssist = viseme === "oh"
        ? jawlessOpenStrength * 0.42
        : viseme === "ou"
          ? jawlessOpenStrength * 0.34
          : 0;
      const regularValue = isDominant
        ? THREE.MathUtils.clamp(rawValue * 2.1 + regularAssist, 0, 2.6)
        : rawValue > dominantValue * 0.72
          ? THREE.MathUtils.clamp(rawValue * 0.38, 0, 0.42)
          : 0;
      value = isFixedGirlModel ? fixedGirlValue : regularValue;
    } else if (viseme === "aa" && dominantValue > 0.02) {
      value = Math.max(value, dominantValue * DIRECT_MOUTH_OPEN_SUPPORT);
    }

    setDirectSpeechMorphValue(viseme, value, jawlessSpeechActive ? 0.16 : 0.18, 0.24);
  }

  const openValue = speechState.active
    ? THREE.MathUtils.clamp(speechEnergy * DIRECT_MOUTH_LARGE_SCALE + aaValue * 0.34 + ohValue * 0.26, 0, 1)
    : 0;
  const verticalOpenBias = Math.max(aaValue * 1.04, ohValue * 0.96, speechEnergy * 0.88);
  const dropValue = speechState.active
    ? THREE.MathUtils.clamp(verticalOpenBias * DIRECT_MOUTH_DROP_SCALE, 0, 1)
    : 0;
  const liftValue = speechState.active
    ? THREE.MathUtils.clamp((aaValue * 0.72 + ohValue * 0.42 + speechEnergy * 0.24) * DIRECT_MOUTH_LIFT_SCALE, 0, 0.92)
    : 0;
  const surprisedValue = speechState.active
    ? THREE.MathUtils.clamp((aaValue * 0.78 + ohValue * 0.6 + speechEnergy * 0.22) * DIRECT_MOUTH_SURPRISED_SCALE, 0, 0.92)
    : 0;
  const finalOpenValue = jawlessSpeechActive
    ? 0
    : openValue;
    const finalDropValue = jawlessSpeechActive
      ? THREE.MathUtils.clamp(
          isFixedGirlModel
            ? 0.18 + jawlessOpenStrength * 0.28 + dominantValue * 0.12 + aaValue * 0.14 + ouValue * 0.08
            : 0.46 + jawlessOpenStrength * 1.85 + aaValue * 0.72 + ohValue * 0.62 + ouValue * 0.36,
          isFixedGirlModel ? 0.18 : 0.46,
          isFixedGirlModel ? 0.72 : 2.7
        )
      : dropValue;
    const finalLiftValue = jawlessSpeechActive
      ? isFixedGirlModel
        ? THREE.MathUtils.clamp(
            0.28
              + jawlessOpenStrength * 0.34
              + dominantValue * 0.18
              + ihValue * 0.06,
            0.28,
            0.82
          )
        : 0
      : liftValue;
    const finalSurprisedValue = jawlessSpeechActive
      ? THREE.MathUtils.clamp(
          aaValue * (isFixedGirlModel ? 0.06 : 0.28)
            + ohValue * (isFixedGirlModel ? 0.05 : 0.22)
            + ouValue * (isFixedGirlModel ? 0.04 : 0.16)
            + speechEnergy * (isFixedGirlModel ? 0.04 : 0.18),
          0,
          isFixedGirlModel ? 0.16 : 0.72
        )
      : surprisedValue;
  const finalCloseValue = jawlessSpeechActive
    ? 0
    : !hasJawBone
      ? THREE.MathUtils.clamp(0.16 - mouthActivity * 1.1, 0, 0.16)
      : 0;
  setDirectSupportMorphValue("open", finalOpenValue, jawlessSpeechActive ? 0.14 : 0.18, 0.28);
  setDirectSupportMorphValue("drop", finalDropValue, jawlessSpeechActive ? 0.14 : 0.2, jawlessSpeechActive ? 0.24 : 0.3);
  setDirectSupportMorphValue("lift", finalLiftValue, 0.14, 0.34);
  setDirectSupportMorphValue("surprised", finalSurprisedValue, 0.14, 0.34);
  setDirectSupportMorphValue("close", finalCloseValue, 0.26, 0.4);
  setDirectSupportMorphValue("neutral", 0, 0.2, 0.32);
  setMorphTargetValue(DIRECT_MOUTH_CONFLICT_TARGETS, 0);
}

function startMouthDiagnosticTest() {
  if (!currentMorphTargetBindings?.size) {
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  stopLipSync(currentVrm, true);
  mouthDiagnosticState.active = true;
  mouthDiagnosticState.startedAtMs = performance.now();
  setStatus("口テスト中");
}

function getMouthDiagnosticStep(elapsedMs) {
  const steps = currentModel === FIXED_MODEL_NAME
    ? FIXED_GIRL_DIAGNOSTIC_STEPS
    : [
        {
          durationMs: 220,
          visemes: {},
          support: { close: 0.18 }
        },
        {
          durationMs: 720,
          visemes: { ou: 0.74, aa: 0.26, ih: 0.08 },
          support: { drop: 0.26, lift: 0.42 }
        },
        {
          durationMs: 720,
          visemes: { ou: 0.86, aa: 0.34, ih: 0.12 },
          support: { drop: 0.32, lift: 0.56 }
        },
        {
          durationMs: 640,
          visemes: { ou: 0.66, aa: 0.2, ih: 0.06 },
          support: { drop: 0.22, lift: 0.34 }
        },
        {
          durationMs: 260,
          visemes: {},
          support: { close: 0.16 }
        }
      ];

  let cursorMs = 0;
  for (const step of steps) {
    cursorMs += step.durationMs;
    if (elapsedMs <= cursorMs) {
      return step;
    }
  }
  return null;
}

function applyMouthDiagnosticStep(vrmRef = currentVrm) {
  if (!mouthDiagnosticState.active) {
    return false;
  }

  const elapsedMs = performance.now() - mouthDiagnosticState.startedAtMs;
  const step = getMouthDiagnosticStep(elapsedMs);
  if (!step) {
    mouthDiagnosticState.active = false;
    resetVisemes(vrmRef);
    setStatus(currentVrm ? "Ready" : "Loading avatar...");
    return false;
  }

  const manager = vrmRef?.expressionManager;
  if (manager) {
    for (const viseme of MOUTH_VISEMES) {
      setVisemeValue(manager, viseme, 0);
      speechState.visemeValues[viseme] = 0;
    }
  }

  for (const key of DIRECT_SUPPORT_KEYS) {
    speechState.supportValues[key] = 0;
  }
  setMorphTargetValue(Object.values(DIRECT_MOUTH_MORPH_TARGETS).flat(), 0);
  setMorphTargetValue(Object.values(DIRECT_MOUTH_SUPPORT_TARGETS).flat(), 0);
  setMorphTargetValue(DIRECT_MOUTH_CONFLICT_TARGETS, 0);

  for (const [viseme, value] of Object.entries(step.visemes || {})) {
    setMorphTargetValue(DIRECT_MOUTH_MORPH_TARGETS[viseme], value);
  }
  for (const [key, value] of Object.entries(step.support || {})) {
    setMorphTargetValue(DIRECT_MOUTH_SUPPORT_TARGETS[key], value);
  }

  return true;
}

function buildLipSyncFrames(text) {
  const frames = [];
  let utf16Index = 0;
  let hintCursorMs = 0;
  let previousViseme = "aa";

  const pushFrame = (frame) => {
    const durationMs = Number(frame.durationMs) || 0;
    frames.push({
      ...frame,
      hintStartMs: hintCursorMs,
      hintEndMs: hintCursorMs + durationMs
    });
    hintCursorMs += durationMs;
  };

  const pushPatternFrames = (char, pattern, strengthScale = 1, durationScale = 1) => {
    const normalizedPattern = Array.isArray(pattern) && pattern.length
      ? pattern
      : [{ viseme: "aa", durationMs: 120, strength: 0.4 }];
    const utf16Start = utf16Index;
    const utf16End = utf16Index + char.length;

    for (const part of normalizedPattern) {
      pushFrame({
        char,
        viseme: part.viseme,
        durationMs: Math.max(64, Math.round((Number(part.durationMs) || 0) * durationScale)),
        strength: THREE.MathUtils.clamp((Number(part.strength) || 0.4) * strengthScale, 0.18, 0.78),
        utf16Start,
        utf16End
      });
      previousViseme = part.viseme || previousViseme;
    }
  };

  for (const char of Array.from(String(text || ""))) {
    if (/\s/.test(char)) {
      pushFrame({
        char,
        viseme: null,
        durationMs: 110,
        strength: 0,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      utf16Index += char.length;
      continue;
    }

    if (/[っッ]/.test(char)) {
      pushFrame({
        char,
        viseme: null,
        durationMs: 90,
        strength: 0,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      utf16Index += char.length;
      continue;
    }

    if (/[。、,.!?！？]/.test(char)) {
      pushFrame({
        char,
        viseme: null,
        durationMs: 160,
        strength: 0,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      utf16Index += char.length;
      continue;
    }

    if (char === "ー") {
      pushFrame({
        char,
        viseme: previousViseme,
        durationMs: 100,
        strength: 0.32,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      utf16Index += char.length;
      continue;
    }

    const viseme = getVisemeForChar(char);
    if (viseme) {
      pushFrame({
        char,
        viseme,
        durationMs: 126,
        strength: 0.56,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      previousViseme = viseme;
    } else if (isCjkIdeograph(char)) {
      const pattern = selectVisemePattern(char, CJK_VISEME_PATTERNS);
      pushPatternFrames(char, pattern, 0.72, 0.84);
    } else {
      const pattern = selectVisemePattern(char, FALLBACK_VISEME_PATTERNS);
      const collapsed = collapseVisemePattern(pattern, 0.62);
      pushFrame({
        char,
        viseme: collapsed.viseme,
        durationMs: collapsed.durationMs,
        strength: collapsed.strength,
        utf16Start: utf16Index,
        utf16End: utf16Index + char.length
      });
      previousViseme = collapsed.viseme;
    }

    utf16Index += char.length;
  }

  if (!frames.length) {
    pushFrame({
      char: "",
      viseme: null,
      durationMs: 220,
      strength: 0,
      utf16Start: 0,
      utf16End: 0
    });
  }

  return mergeLipSyncFrames(frames);
}

function clearLipSyncTimer() {
  if (speechState.fallbackTimerId) {
    window.clearTimeout(speechState.fallbackTimerId);
    speechState.fallbackTimerId = 0;
  }
}

function clearSpeechBootstrapWatcher() {
  if (speechState.bootstrapWatcherId) {
    window.clearInterval(speechState.bootstrapWatcherId);
    speechState.bootstrapWatcherId = 0;
  }
}

function scheduleLipSyncTimeout(delayMs) {
  clearLipSyncTimer();
  speechState.fallbackTimerId = window.setTimeout(() => {
    stopLipSync();
  }, Math.max(delayMs || 0, 320));
}

function resetVisemes(vrmRef) {
  const manager = vrmRef?.expressionManager;
  for (const viseme of MOUTH_VISEMES) {
    speechState.directMorphValues[viseme] = 0;
    speechState.frameTargets[viseme] = 0;
  }
  if (manager) {
    for (const viseme of MOUTH_VISEMES) {
      speechState.visemeValues[viseme] = 0;
      setVisemeValue(manager, viseme, 0);
    }
  }

  resetLiveSpeechMorphTargets();

  const jaw = getJawBoneNode(vrmRef);
  if (jaw) {
    if (typeof jaw.userData.defaultLipSyncRotationX !== "number") {
      jaw.userData.defaultLipSyncRotationX = jaw.rotation.x;
    }
    speechState.jawValue = 0;
    jaw.rotation.x = jaw.userData.defaultLipSyncRotationX;
  }

  for (const key of DIRECT_SUPPORT_KEYS) {
    speechState.supportValues[key] = 0;
  }
  setMorphTargetValue(Object.values(DIRECT_MOUTH_SUPPORT_TARGETS).flat(), 0);
  setMorphTargetValue(DIRECT_MOUTH_CONFLICT_TARGETS, 0);
}

function setExpressionValue(manager, presetName, value) {
  try {
    manager.setValue(presetName, value);
  } catch {
    // Ignore presets that are not available on the loaded VRM.
  }
}

function setVisemeValue(manager, viseme, value) {
  const presetNames = VISEME_PRESET_ALIASES[viseme] || [viseme];
  for (const presetName of presetNames) {
    setExpressionValue(manager, presetName, value);
  }
}

function applyConversationExpression(vrmRef, elapsed, delta) {
  const manager = vrmRef?.expressionManager;
  if (!manager) {
    return;
  }

  const nowMs = performance.now();
  const returningToDefault = !speechState.active && nowMs > expressionState.holdUntilMs;
  if (returningToDefault) {
    expressionState.targetValues = Object.fromEntries(EMOTION_PRESETS.map((preset) => [preset, 0]));
  }

  const expressionSpeechSuppression = speechState.active ? 0 : 1;
  const speakingBoost = speechState.active
    ? 1
    : 1 + 0.08 * Math.sin(elapsed * 6.4) + 0.05;
  const damping = speechState.active
    ? EXPRESSION_ACTIVE_DAMPING
    : returningToDefault
      ? EXPRESSION_RELEASE_DAMPING
      : EXPRESSION_HOLD_DAMPING;
  const safeDelta = Math.max(delta || 0, 1 / 120);

  for (const preset of EMOTION_PRESETS) {
    const targetBase = (expressionState.targetValues[preset] || 0) * expressionSpeechSuppression;
    const target = THREE.MathUtils.clamp(targetBase * speakingBoost, 0, 1);
    const nextValue = THREE.MathUtils.damp(
      expressionState.currentValues[preset] || 0,
      target,
      damping,
      safeDelta
    );
    expressionState.currentValues[preset] = nextValue < 0.001 ? 0 : nextValue;
    setExpressionValue(manager, preset, nextValue);
  }
}

function addBoneRotation(node, x = 0, y = 0, z = 0) {
  if (!node) {
    return;
  }

  node.rotation.x += x;
  node.rotation.y += y;
  node.rotation.z += z;
}

function applyConversationMotion(vrmRef, elapsed) {
  const humanoid = vrmRef?.humanoid;
  if (!humanoid) {
    return;
  }

  const nowMs = performance.now();
  if (!speechState.active && nowMs > motionState.holdUntilMs && motionState.activeGesture !== "thinking") {
    setMotionGesture("idle", 0, 0);
  }

  const currentWeight = motionState.currentWeight || 0;
  const fadingReleaseGesture = motionState.activeGesture === "idle" && currentWeight > 0.006
    ? motionState.releaseGesture
    : "idle";
  const primaryGesture = motionState.activeGesture === "thinking"
    ? "idle"
    : (motionState.activeGesture === "idle" ? fadingReleaseGesture : motionState.activeGesture);
  const baseTargetWeight = motionState.activeGesture === "idle" || motionState.activeGesture === "thinking"
    ? 0
    : THREE.MathUtils.clamp(
        0.18 + motionState.emphasis * 0.76 + (speechState.active ? 0.08 : 0),
        0,
        1
      );
  const speechMotionScale = speechState.active ? 0.54 : 1;
  const targetWeight = baseTargetWeight * speechMotionScale;
  const weightLerp = speechState.active
    ? 0.14
    : targetWeight > currentWeight
      ? 0.1
      : 0.055;
  motionState.currentWeight = THREE.MathUtils.lerp(
    currentWeight,
    targetWeight,
    weightLerp
  );
  const thinkingTarget = motionState.thinkingPoseTarget || 0;
  const thinkingRamp = motionState.activeGesture === "thinking"
    ? THREE.MathUtils.smoothstep(
        THREE.MathUtils.clamp(
          (nowMs - (motionState.gestureStartedAtMs || nowMs)) / THINKING_POSE_RAMP_MS,
          0,
          1
        ),
        0,
        1
      )
    : 1;
  const effectiveThinkingTarget = thinkingTarget * thinkingRamp;
  const thinkingLerp = effectiveThinkingTarget > (motionState.thinkingPoseWeight || 0)
    ? 0.032
    : 0.016;
  motionState.thinkingPoseWeight = THREE.MathUtils.lerp(
    motionState.thinkingPoseWeight || 0,
    effectiveThinkingTarget,
    thinkingLerp
  );

  if (
    motionState.activeGesture === "thinking"
    && effectiveThinkingTarget < 0.001
    && (motionState.thinkingPoseWeight || 0) < 0.004
  ) {
    motionState.activeGesture = "idle";
  }

  if (motionState.activeGesture === "idle" && (motionState.currentWeight || 0) < 0.01) {
    motionState.releaseGesture = "idle";
  }

  const weight = motionState.currentWeight;
  const thinkingWeight = motionState.thinkingPoseWeight || 0;
  if (weight < 0.004 && thinkingWeight < 0.004) {
    return;
  }
  const speechHeadScale = speechState.active ? 0.1 : 1;
  const speechTorsoScale = speechState.active ? 0.64 : 1;
  const speechArmScale = speechState.active ? 0.72 : 1;
  const speechThinkingScale = speechState.active ? 0.42 : 1;
  const torsoWeight = weight * speechTorsoScale;
  const headWeight = weight * speechHeadScale;
  const armWeight = weight * speechArmScale;
  const thinkingTorsoWeight = thinkingWeight * speechThinkingScale;
  const thinkingHeadWeight = thinkingWeight * speechThinkingScale;

  const spine = humanoid.getNormalizedBoneNode("spine");
  const chest = humanoid.getNormalizedBoneNode("chest");
  const neck = humanoid.getNormalizedBoneNode("neck");
  const head = humanoid.getNormalizedBoneNode("head");
  const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
  const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
  const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
  const leftHand = humanoid.getNormalizedBoneNode("leftHand");
  const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
  const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
  const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
  const rightHand = humanoid.getNormalizedBoneNode("rightHand");
  const talkingPulse = speechState.active
    ? 0.52 + 0.48 * Math.sin(elapsed * 6.3)
    : 0.38 + 0.24 * Math.sin(elapsed * 2.2);

  if (thinkingWeight > 0.003) {
    addBoneRotation(spine, 0.005 * thinkingTorsoWeight, 0, -0.006 * thinkingTorsoWeight);
    addBoneRotation(chest, 0.006 * thinkingTorsoWeight, 0, -0.01 * thinkingTorsoWeight);
    addBoneRotation(
      neck,
      0.008 * thinkingHeadWeight + Math.sin(elapsed * 0.98) * 0.0025 * thinkingHeadWeight,
      0.008 * thinkingHeadWeight,
      -0.03 * thinkingHeadWeight
    );
    addBoneRotation(
      head,
      0.013 * thinkingHeadWeight + Math.sin(elapsed * 1.08) * 0.0035 * thinkingHeadWeight,
      0.012 * thinkingHeadWeight,
      -0.054 * thinkingHeadWeight
    );
    addBoneRotation(leftUpperArm, -0.004 * thinkingTorsoWeight, -0.028 * thinkingTorsoWeight, 0.045 * thinkingTorsoWeight);
    addBoneRotation(leftLowerArm, -0.012 * thinkingTorsoWeight, 0, 0.032 * thinkingTorsoWeight);
    addBoneRotation(rightUpperArm, 0.004 * thinkingTorsoWeight, -0.008 * thinkingTorsoWeight, -0.014 * thinkingTorsoWeight);
    addBoneRotation(rightLowerArm, 0.007 * thinkingTorsoWeight, 0, -0.01 * thinkingTorsoWeight);
  }

  switch (primaryGesture) {
    case "explain":
        addBoneRotation(spine, 0.016 * torsoWeight, Math.sin(elapsed * 1.6) * 0.014 * torsoWeight, 0);
        addBoneRotation(chest, 0.012 * torsoWeight, Math.sin(elapsed * 1.8 + 0.4) * 0.02 * torsoWeight, 0);
      addBoneRotation(neck, Math.sin(elapsed * 2.1) * 0.008 * headWeight, 0.016 * headWeight, 0);
      addBoneRotation(head, Math.sin(elapsed * 2.3) * 0.014 * headWeight, 0.02 * headWeight, 0);
      addBoneRotation(rightUpperArm, -0.08 * armWeight - 0.04 * talkingPulse * armWeight, -0.1 * armWeight, 0.14 * armWeight);
      addBoneRotation(rightLowerArm, -0.08 * talkingPulse * armWeight, -0.04 * armWeight, 0.18 * armWeight);
      addBoneRotation(rightHand, 0, -0.04 * armWeight, 0.08 * talkingPulse * armWeight);
      addBoneRotation(leftUpperArm, -0.02 * armWeight, 0.04 * armWeight, -0.06 * armWeight);
      break;
    case "happy":
      addBoneRotation(spine, 0.012 * torsoWeight + Math.sin(elapsed * 4.2) * 0.016 * torsoWeight, Math.sin(elapsed * 2.8) * 0.012 * torsoWeight, 0);
      addBoneRotation(chest, 0.016 * torsoWeight + Math.sin(elapsed * 4.2 + 0.4) * 0.012 * torsoWeight, 0, Math.sin(elapsed * 3.1) * 0.012 * torsoWeight);
      addBoneRotation(neck, -0.01 * headWeight, 0, 0);
      addBoneRotation(head, -0.03 * headWeight + Math.sin(elapsed * 4.2 + 0.6) * 0.018 * headWeight, 0, Math.sin(elapsed * 3.4) * 0.01 * headWeight);
      addBoneRotation(leftUpperArm, -0.05 * armWeight, 0.1 * armWeight, -0.08 * armWeight);
      addBoneRotation(rightUpperArm, -0.05 * armWeight, -0.1 * armWeight, 0.08 * armWeight);
      addBoneRotation(leftLowerArm, 0.02 * armWeight, 0, -0.08 * talkingPulse * armWeight);
      addBoneRotation(rightLowerArm, 0.02 * armWeight, 0, 0.08 * talkingPulse * armWeight);
      break;
    case "warn":
      addBoneRotation(spine, 0.03 * torsoWeight, 0, 0);
      addBoneRotation(chest, 0.024 * torsoWeight, 0, 0);
      addBoneRotation(neck, 0, Math.sin(elapsed * 3.8) * 0.022 * headWeight, 0);
      addBoneRotation(head, 0, Math.sin(elapsed * 3.8) * 0.034 * headWeight, 0);
      addBoneRotation(rightUpperArm, -0.1 * armWeight, -0.14 * armWeight, 0.16 * armWeight);
      addBoneRotation(rightLowerArm, -0.08 * armWeight, -0.05 * armWeight, 0.22 * armWeight);
      addBoneRotation(rightHand, 0, -0.06 * armWeight, 0.08 * armWeight);
      addBoneRotation(leftUpperArm, -0.01 * armWeight, 0.03 * armWeight, -0.03 * armWeight);
      break;
    case "shy":
      addBoneRotation(spine, -0.016 * torsoWeight, 0, 0);
      addBoneRotation(chest, -0.01 * torsoWeight, 0, 0);
      addBoneRotation(neck, 0.024 * headWeight, 0.018 * headWeight, 0);
      addBoneRotation(head, 0.05 * headWeight, 0.03 * headWeight, -0.014 * headWeight);
      addBoneRotation(leftUpperArm, 0.04 * armWeight, -0.07 * armWeight, 0.08 * armWeight);
      addBoneRotation(rightUpperArm, 0.04 * armWeight, 0.07 * armWeight, -0.08 * armWeight);
      addBoneRotation(leftLowerArm, 0.03 * armWeight, 0, 0.06 * armWeight);
      addBoneRotation(rightLowerArm, 0.03 * armWeight, 0, -0.06 * armWeight);
      break;
    case "surprised":
      addBoneRotation(spine, -0.02 * torsoWeight, 0, 0);
      addBoneRotation(chest, -0.018 * torsoWeight, 0, 0);
      addBoneRotation(neck, -0.022 * headWeight, 0, 0);
      addBoneRotation(head, -0.05 * headWeight - Math.sin(elapsed * 5.6) * 0.01 * headWeight, 0, Math.sin(elapsed * 4.1) * 0.01 * headWeight);
      addBoneRotation(leftUpperArm, -0.08 * armWeight, 0.11 * armWeight, -0.1 * armWeight);
      addBoneRotation(rightUpperArm, -0.08 * armWeight, -0.11 * armWeight, 0.1 * armWeight);
      addBoneRotation(leftLowerArm, -0.03 * armWeight, 0, -0.05 * armWeight);
      addBoneRotation(rightLowerArm, -0.03 * armWeight, 0, 0.05 * armWeight);
      break;
    default:
      addBoneRotation(spine, 0.008 * torsoWeight, Math.sin(elapsed * 1.7) * 0.01 * torsoWeight, 0);
      addBoneRotation(chest, 0.006 * torsoWeight, Math.sin(elapsed * 1.9 + 0.4) * 0.012 * torsoWeight, 0);
      addBoneRotation(head, Math.sin(elapsed * 1.8) * 0.008 * headWeight, Math.sin(elapsed * 2.1) * 0.01 * headWeight, 0);
      addBoneRotation(rightUpperArm, -0.03 * armWeight, -0.04 * armWeight, 0.08 * armWeight);
      addBoneRotation(rightLowerArm, -0.04 * talkingPulse * armWeight, 0, 0.08 * armWeight);
      addBoneRotation(leftHand, 0, 0, Math.sin(elapsed * 2.2) * 0.008 * armWeight);
      break;
  }
}

function stopLipSync(vrmRef = currentVrm, immediate = false) {
  clearLipSyncTimer();
  clearSpeechBootstrapWatcher();
  speechState.active = false;
  speechState.frames = [];
  speechState.totalDurationMs = 0;
  speechState.startTimeMs = 0;
  speechState.syncMode = "timed";
  speechState.currentFrameIndex = -1;
  speechState.currentFrameStartedAtMs = 0;
  speechState.boundarySupported = false;
  speechState.timingScale = 1;
  speechState.timingOffsetMs = 0;
  speechState.lastBoundaryAtMs = 0;
  speechState.lastBoundaryFrameIndex = -1;
  speechState.lastBoundaryStrength = 0;
  speechState.lastKnownSpeechElapsedMs = 0;
  resetLiveSpeechMorphTargets();
  if (immediate) {
    resetVisemes(vrmRef);
  }
}

function startLipSync(text, rate = 1) {
  stopLipSync();
  speechState.frames = buildLipSyncFrames(text);
  speechState.totalDurationMs = speechState.frames.reduce(
    (total, frame) => total + frame.durationMs,
    0
  );
  speechState.startTimeMs = performance.now();
  speechState.active = true;
  speechState.syncMode = "timed";
  const normalizedRate = Math.max(rate, 0.65);
  speechState.timingScale = (1 / normalizedRate) * (
    currentModel === FIXED_MODEL_NAME
      ? FIXED_GIRL_FALLBACK_TIMING_SCALE
      : 1
  );
  speechState.timingOffsetMs = 0;
  speechState.currentFrameIndex = speechState.frames.length ? 0 : -1;
  speechState.currentFrameStartedAtMs = speechState.startTimeMs;
  speechState.lastBoundaryAtMs = speechState.startTimeMs;
  speechState.lastKnownSpeechElapsedMs = 0;
  const charCount = Array.from(String(text || "")).length;
  const estimatedSpeechDurationMs = Math.max(
    speechState.totalDurationMs * speechState.timingScale * 1.18 + 1100,
    (
      charCount
        * (currentModel === FIXED_MODEL_NAME
          ? FIXED_GIRL_FALLBACK_CHAR_DURATION_MS
          : 120)
    ) / normalizedRate + 1100,
    1800
  );
  scheduleLipSyncTimeout(estimatedSpeechDurationMs);
}

function findLipSyncFrameIndexByCharOffset(charOffset) {
  if (!Number.isFinite(charOffset) || charOffset < 0) {
    return -1;
  }

  for (let index = 0; index < speechState.frames.length; index += 1) {
    const frame = speechState.frames[index];
    if (charOffset < frame.utf16End) {
      return index;
    }
  }

  return speechState.frames.length - 1;
}

function findLipSyncFrameIndexByHintElapsed(hintElapsedMs) {
  if (!Number.isFinite(hintElapsedMs)) {
    return -1;
  }

  for (let index = 0; index < speechState.frames.length; index += 1) {
    if (hintElapsedMs < speechState.frames[index].hintEndMs) {
      return index;
    }
  }

  const lastFrame = speechState.frames[speechState.frames.length - 1];
  if (lastFrame && hintElapsedMs <= lastFrame.hintEndMs + 160) {
    return speechState.frames.length - 1;
  }

  return -1;
}

function getActualSpeechElapsedMs(nowMs) {
  if (speechState.boundarySupported && speechState.lastBoundaryAtMs > 0) {
    return Math.max(
      speechState.lastKnownSpeechElapsedMs || 0,
      (speechState.lastKnownSpeechElapsedMs || 0) + Math.max(0, nowMs - speechState.lastBoundaryAtMs)
    );
  }

  return Math.max(0, nowMs - speechState.startTimeMs);
}

function getLipSyncHintElapsedMs(nowMs) {
  const actualElapsedMs = getActualSpeechElapsedMs(nowMs);
  speechState.lastKnownSpeechElapsedMs = actualElapsedMs;
  const scale = THREE.MathUtils.clamp(speechState.timingScale || 1, 0.35, 3.6);
  const leadMs = currentModel === FIXED_MODEL_NAME ? FIXED_GIRL_SPEECH_LEAD_MS : 0;
  return Math.max(0, (actualElapsedMs + leadMs - (speechState.timingOffsetMs || 0)) / scale);
}

function syncLipSyncToSpeechBoundary(event) {
  if (!speechState.active) {
    return;
  }

  const nowMs = performance.now();
  const rawElapsedSeconds = Number(event?.elapsedTime);
  const actualElapsedMs = Number.isFinite(rawElapsedSeconds) && rawElapsedSeconds >= 0
    ? rawElapsedSeconds * 1000
    : Math.max(0, nowMs - speechState.startTimeMs);

  if (FIXED_GIRL_DISABLE_BOUNDARY_SYNC && currentModel === FIXED_MODEL_NAME) {
    const frameIndex = findLipSyncFrameIndexByCharOffset(Number(event?.charIndex));
    const frame = frameIndex >= 0 ? speechState.frames[frameIndex] || null : null;
    const hintElapsedMs = frame
      ? frame.hintStartMs + frame.durationMs * (frame.viseme ? 0.08 : 0.28)
      : speechState.totalDurationMs;
    if (hintElapsedMs > 12) {
      const expectedElapsedMs = hintElapsedMs * (speechState.timingScale || 1);
      const nextOffsetMs = actualElapsedMs - expectedElapsedMs;
      speechState.timingOffsetMs = THREE.MathUtils.lerp(
        speechState.timingOffsetMs || 0,
        nextOffsetMs,
        0.42
      );
    }
    speechState.boundarySupported = true;
    speechState.syncMode = "timed";
    speechState.startTimeMs = nowMs - actualElapsedMs;
    speechState.lastBoundaryAtMs = nowMs;
    speechState.lastBoundaryFrameIndex = frameIndex;
    speechState.lastBoundaryStrength = frame?.strength || 0.72;
    speechState.lastKnownSpeechElapsedMs = actualElapsedMs;
    const remainingActualMs = Math.max(
      0,
      speechState.totalDurationMs * (speechState.timingScale || 1) - actualElapsedMs
    );
    scheduleLipSyncTimeout(Math.max(remainingActualMs + 1200, 1500));
    return;
  }

  const frameIndex = findLipSyncFrameIndexByCharOffset(Number(event?.charIndex));
  if (frameIndex < 0) {
    return;
  }
  speechState.startTimeMs = nowMs - actualElapsedMs;
  const frame = speechState.frames[frameIndex] || null;
  const hintElapsedMs = frame
    ? frame.hintStartMs + frame.durationMs * (frame.viseme ? 0.12 : 0.36)
    : speechState.totalDurationMs;

  if (hintElapsedMs > 24) {
    const expectedElapsedMs = hintElapsedMs * (speechState.timingScale || 1);
    const nextOffsetMs = actualElapsedMs - expectedElapsedMs;
    speechState.timingOffsetMs = THREE.MathUtils.lerp(
      speechState.timingOffsetMs || 0,
      nextOffsetMs,
      0.28
    );
  }

  speechState.boundarySupported = true;
  speechState.syncMode = "timed";
  speechState.currentFrameIndex = frameIndex;
  speechState.currentFrameStartedAtMs = nowMs;
  speechState.lastBoundaryAtMs = nowMs;
  speechState.lastBoundaryFrameIndex = frameIndex;
  speechState.lastBoundaryStrength = frame?.strength || 0.72;
  speechState.lastKnownSpeechElapsedMs = actualElapsedMs;

  const remainingHintMs = Math.max(0, speechState.totalDurationMs - hintElapsedMs);
  scheduleLipSyncTimeout(Math.max(remainingHintMs * speechState.timingScale + 1400, 1900));
}

function applyLipSync(vrmRef) {
  const manager = vrmRef?.expressionManager;
  const jaw = getJawBoneNode(vrmRef);
  const useDirectMorphSpeech = !jaw && hasDirectSpeechMorphTargets();
  const useFixedGirlDirectSpeech = useDirectMorphSpeech && currentModel === FIXED_MODEL_NAME;

  if (!manager && !jaw) {
    return;
  }

  const targetValues = Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0]));
  let targetJaw = 0;
  let fixedGirlLiveTargets = null;
  let fixedGirlLiveSupport = null;

  if (speechState.active) {
    const nowMs = performance.now();
    const hintElapsedMs = getLipSyncHintElapsedMs(nowMs);
    const currentIndex = findLipSyncFrameIndexByHintElapsed(hintElapsedMs);

    if (currentIndex === -1) {
      if (!speechState.boundarySupported && hintElapsedMs > speechState.totalDurationMs + 160) {
        stopLipSync(vrmRef);
      }
    } else {
      speechState.currentFrameIndex = currentIndex;
      const currentFrame = speechState.frames[currentIndex];
      const previousFrame = speechState.frames[currentIndex - 1] || null;
      const nextFrame = speechState.frames[currentIndex + 1] || null;
      const silentFrame = isSilentLipSyncFrame(currentFrame);
      const frameDurationMs = Math.max(currentFrame.durationMs || 0, 1);
      const frameProgress = THREE.MathUtils.clamp(
        (hintElapsedMs - currentFrame.hintStartMs) / frameDurationMs,
        0,
        1
      );
      const openCurve = Math.sin(Math.PI * THREE.MathUtils.clamp(frameProgress * 0.88 + 0.06, 0, 1));
        const currentPulse = silentFrame
          ? 0
          : (currentFrame.strength || 0) * (
              useFixedGirlDirectSpeech
                ? 0.16 + openCurve * 0.42
                : 0.14 + openCurve * 0.64
            );
      const currentJawOpen = getJawOpennessForViseme(currentFrame.viseme);
      const nextJawOpen = getJawOpennessForViseme(nextFrame?.viseme);
      const crossFadeToNext = silentFrame
        ? THREE.MathUtils.smoothstep(frameProgress, 0.97, 1)
        : THREE.MathUtils.smoothstep(frameProgress, 0.66, 0.94);
      const holdCurrent = silentFrame ? 0 : 1 - crossFadeToNext * 0.22;

      if (useFixedGirlDirectSpeech && !silentFrame) {
        fixedGirlLiveTargets = Object.fromEntries(MOUTH_VISEMES.map((viseme) => [viseme, 0]));
        fixedGirlLiveSupport = { drop: 0, lift: 0, surprised: 0 };
        const currentFrameStrength = THREE.MathUtils.clamp(
          (currentFrame.strength || 0) * (0.46 + openCurve * 0.34),
          0,
          0.72
        );
        if (currentFrame.viseme) {
          fixedGirlLiveTargets[currentFrame.viseme] = Math.max(
            fixedGirlLiveTargets[currentFrame.viseme],
            currentFrameStrength * FIXED_GIRL_LIVE_FRAME_DIRECT_FLOOR
          );
          fixedGirlLiveTargets.aa = Math.max(
            fixedGirlLiveTargets.aa,
            currentFrameStrength * (currentFrame.viseme === "aa" ? 1.22 : 0.76)
          );
        }
        if (nextFrame?.viseme && !isSilentLipSyncFrame(nextFrame)) {
          fixedGirlLiveTargets[nextFrame.viseme] = Math.max(
            fixedGirlLiveTargets[nextFrame.viseme],
            (nextFrame.strength || 0) * crossFadeToNext * FIXED_GIRL_LIVE_FRAME_NEXT_FLOOR
          );
        }

        const currentSupportMap = FIXED_GIRL_LIVE_SUPPORT_FLOOR_MAP[currentFrame.viseme] || {};
        fixedGirlLiveSupport.drop = Math.max(
          fixedGirlLiveSupport.drop,
          (currentSupportMap.drop || 0) * (0.54 + currentFrameStrength * 0.92)
        );
        fixedGirlLiveSupport.drop = Math.max(
          fixedGirlLiveSupport.drop,
          0.08 + currentFrameStrength * 0.18
        );
        fixedGirlLiveSupport.lift = Math.max(
          fixedGirlLiveSupport.lift,
          (currentSupportMap.lift || 0) * (0.44 + currentFrameStrength * 0.72)
        );
          fixedGirlLiveSupport.lift = Math.max(
            fixedGirlLiveSupport.lift,
            currentFrame.viseme === "ih" || currentFrame.viseme === "ee"
            ? 0.015 + currentFrameStrength * 0.032
            : 0.006 + currentFrameStrength * 0.018
        );
        fixedGirlLiveSupport.surprised = Math.max(
          fixedGirlLiveSupport.surprised,
          (currentSupportMap.surprised || 0) * (0.36 + currentFrameStrength * 0.42)
        );

        if (nextFrame?.viseme && !isSilentLipSyncFrame(nextFrame)) {
          const nextSupportMap = FIXED_GIRL_LIVE_SUPPORT_FLOOR_MAP[nextFrame.viseme] || {};
          fixedGirlLiveSupport.drop = Math.max(
            fixedGirlLiveSupport.drop,
            (nextSupportMap.drop || 0) * crossFadeToNext * 0.72
          );
          fixedGirlLiveSupport.lift = Math.max(
            fixedGirlLiveSupport.lift,
            (nextSupportMap.lift || 0) * crossFadeToNext * 0.62
          );
          fixedGirlLiveSupport.surprised = Math.max(
            fixedGirlLiveSupport.surprised,
            (nextSupportMap.surprised || 0) * crossFadeToNext * 0.48
          );
        }
      }

      if (!silentFrame && previousFrame?.viseme && frameProgress < 0.12) {
        const carry = previousFrame.strength * (1 - frameProgress / 0.12) * 0.05;
        targetValues[previousFrame.viseme] = Math.max(
          targetValues[previousFrame.viseme],
          carry
        );
      }

        if (currentFrame.viseme) {
          targetValues[currentFrame.viseme] = Math.max(
            targetValues[currentFrame.viseme],
            currentPulse * holdCurrent * (useFixedGirlDirectSpeech ? 0.92 : 1.24)
          );
        }

        if (nextFrame?.viseme) {
          targetValues[nextFrame.viseme] = Math.max(
            targetValues[nextFrame.viseme],
            nextFrame.strength * crossFadeToNext * (
              silentFrame
                ? (useFixedGirlDirectSpeech ? FIXED_GIRL_SILENT_NEXT_BLEND : 0.12)
                : useFixedGirlDirectSpeech
                  ? 0.18
                  : 0.34
            )
          );
        }

      compressLipSyncTargets(targetValues);

      let dominantJaw = 0;
      for (const viseme of MOUTH_VISEMES) {
        dominantJaw = Math.max(
          dominantJaw,
          (targetValues[viseme] || 0) * getJawOpennessForViseme(viseme)
        );
      }
      const speechJawFloor = silentFrame
        ? 0
        : THREE.MathUtils.clamp(
            0.16 + currentPulse * 0.6 + crossFadeToNext * 0.08,
            0.18,
            0.44
          );
      targetJaw = silentFrame
        ? Math.max(dominantJaw * 0.28, (nextFrame?.strength || 0) * nextJawOpen * crossFadeToNext * 0.08)
        : Math.max(dominantJaw * 1.12, speechJawFloor, (nextFrame?.strength || 0) * nextJawOpen * crossFadeToNext * 0.22);
    }

    for (const viseme of MOUTH_VISEMES) {
      speechState.frameTargets[viseme] = targetValues[viseme] || 0;
    }

    if (speechState.lastBoundaryFrameIndex >= 0) {
      const boundaryAgeMs = nowMs - speechState.lastBoundaryAtMs;
      const boundaryFrame = speechState.frames[speechState.lastBoundaryFrameIndex] || null;
      const currentFrame = speechState.frames[speechState.currentFrameIndex] || null;
      const boundarySilent = isSilentLipSyncFrame(currentFrame);
      const sameVisemeBoundary = boundaryFrame?.viseme
        && currentFrame?.viseme
        && boundaryFrame.viseme === currentFrame.viseme;
      const boundaryWindowMs = boundarySilent ? 0 : 120;
      if (sameVisemeBoundary && boundaryAgeMs < boundaryWindowMs) {
        const boundaryBoost = (1 - boundaryAgeMs / boundaryWindowMs)
          * (speechState.lastBoundaryStrength || 0.72)
          * 0.08;
        if (boundaryFrame?.viseme) {
          targetValues[boundaryFrame.viseme] = Math.max(
            targetValues[boundaryFrame.viseme],
            boundaryBoost
          );
        }
        targetJaw = Math.max(targetJaw, boundaryBoost * 0.38);
      }
    }
  }

  if (useFixedGirlDirectSpeech && fixedGirlLiveTargets && fixedGirlLiveSupport) {
    for (const viseme of MOUTH_VISEMES) {
      speechState.liveDirectTargets[viseme] = fixedGirlLiveTargets[viseme] || 0;
    }
    speechState.liveSupportTargets.drop = fixedGirlLiveSupport.drop || 0;
    speechState.liveSupportTargets.lift = fixedGirlLiveSupport.lift || 0;
    speechState.liveSupportTargets.surprised = fixedGirlLiveSupport.surprised || 0;
  } else {
    resetLiveSpeechMorphTargets();
  }

  const blendFactor = speechState.active
    ? (speechState.boundarySupported ? 0.3 : 0.22)
    : 0.18;
  if (manager) {
    let dominantViseme = null;
    let dominantTarget = 0;
    for (const viseme of MOUTH_VISEMES) {
      const targetValue = targetValues[viseme] || 0;
      if (targetValue > dominantTarget) {
        dominantTarget = targetValue;
        dominantViseme = viseme;
      }
    }
    const silenceDecayMode = speechState.active && dominantTarget < 0.08;

    for (const viseme of MOUTH_VISEMES) {
      const currentValue = speechState.visemeValues[viseme] || 0;
      const rawTargetValue = targetValues[viseme] || 0;
        const targetValue = dominantViseme && viseme !== dominantViseme
          ? rawTargetValue * (silenceDecayMode ? 0.28 : 0.46)
          : rawTargetValue;
        const scaledTargetValue = useFixedGirlDirectSpeech
          ? targetValue * (dominantViseme === viseme ? 1.52 : 1.24)
          : targetValue;
        const visemeBlendFactor = speechState.active
          ? silenceDecayMode
            ? (scaledTargetValue > currentValue ? (useFixedGirlDirectSpeech ? 0.32 : 0.12) : 0.42)
            : scaledTargetValue > currentValue
              ? (
                  useFixedGirlDirectSpeech
                    ? (speechState.boundarySupported ? 0.66 : 0.56)
                    : (speechState.boundarySupported ? 0.34 : 0.24)
                )
              : 0.22
          : 0.18;
        const nextValue = THREE.MathUtils.lerp(
          currentValue,
          scaledTargetValue,
          visemeBlendFactor
        );
        speechState.visemeValues[viseme] = nextValue;
        setVisemeValue(manager, viseme, useDirectMorphSpeech ? 0 : nextValue);
      }
    }

  if (jaw) {
    if (typeof jaw.userData.defaultLipSyncRotationX !== "number") {
      jaw.userData.defaultLipSyncRotationX = jaw.rotation.x;
    }
    const jawBlendFactor = speechState.active
      ? targetJaw < 0.06
        ? 0.44
        : targetJaw > (speechState.jawValue || 0)
          ? Math.min(blendFactor + 0.1, 0.38)
          : 0.24
      : blendFactor;
    speechState.jawValue = THREE.MathUtils.lerp(
      speechState.jawValue || 0,
      Math.min(targetJaw, MAX_JAW_TARGET),
      jawBlendFactor
    );
    jaw.rotation.x = jaw.userData.defaultLipSyncRotationX + speechState.jawValue * JAW_ROTATION_MULTIPLIER;
  }

  if (!speechState.active) {
    const remaining = MOUTH_VISEMES.reduce(
      (max, viseme) => Math.max(max, speechState.visemeValues[viseme] || 0),
      speechState.jawValue || 0
    );
    if (remaining < 0.01) {
      resetVisemes(vrmRef);
    }
  }
}

function speak(text) {
  if (!text) {
    return;
  }

  const voiceSettings = getVoiceSettings();
  if (!voiceSettings.enabled) {
    return;
  }

  if (!("speechSynthesis" in window)) {
    if (voiceTools?.voiceStatus) {
      voiceTools.voiceStatus.textContent = "このブラウザでは音声読み上げを使えません。";
    }
    return;
  }

  refreshAvailableVoices();

  const rate = CUTE_VOICE_RATE;
  const voice = getPreferredSpeechVoice(voiceSettings);
  const utterance = new SpeechSynthesisUtterance(text);
  const waitForBoundaryBootstrap = currentModel === FIXED_MODEL_NAME;
  const utteranceToken = (speechState.activeUtteranceToken || 0) + 1;
  speechState.activeUtteranceToken = utteranceToken;
  let lipSyncBootstrapped = false;
  clearSpeechBootstrapWatcher();
  const beginLipSync = () => {
    if (lipSyncBootstrapped || !isCurrentUtteranceToken(utteranceToken)) {
      return;
    }
    lipSyncBootstrapped = true;
    clearSpeechBootstrapWatcher();
    startLipSync(text, rate);
  };
  utterance.lang = voice?.lang || "ja-JP";
  utterance.voice = voice || null;
  utterance.rate = rate;
  utterance.pitch = CUTE_VOICE_PITCH;
  utterance.onstart = () => {
    if (!isCurrentUtteranceToken(utteranceToken)) {
      return;
    }
    if (!waitForBoundaryBootstrap) {
      beginLipSync();
    }
    if (voiceTools?.voiceStatus) {
      voiceTools.voiceStatus.textContent = "読み上げ中です。";
    }
  };
  utterance.onboundary = (event) => {
    if (!isCurrentUtteranceToken(utteranceToken)) {
      return;
    }
    beginLipSync();
    syncLipSyncToSpeechBoundary(event);
  };
  utterance.onend = () => {
    if (!isCurrentUtteranceToken(utteranceToken)) {
      return;
    }
    clearSpeechBootstrapWatcher();
    stopLipSync();
    speechState.activeUtteranceToken = 0;
    updateVoiceTools();
  };
  utterance.onerror = () => {
    if (!isCurrentUtteranceToken(utteranceToken)) {
      return;
    }
    clearSpeechBootstrapWatcher();
    stopLipSync();
    speechState.activeUtteranceToken = 0;
    if (voiceTools?.voiceStatus) {
      voiceTools.voiceStatus.textContent = "音声の再生に失敗しました。";
    }
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  const bootstrapWatchStartedAtMs = performance.now();
  speechState.bootstrapWatcherId = window.setInterval(() => {
    if (!isCurrentUtteranceToken(utteranceToken)) {
      clearSpeechBootstrapWatcher();
      return;
    }
    const waitedMs = performance.now() - bootstrapWatchStartedAtMs;
    if (window.speechSynthesis.speaking) {
      if (!waitForBoundaryBootstrap || waitedMs > 260) {
        beginLipSync();
      }
      return;
    }
    if (waitedMs > 2200) {
      beginLipSync();
    }
  }, 70);
}

function applyCameraLookAt(cameraRef, lookTargetRef, pitchDownOffset = 0) {
  if (!cameraRef || !lookTargetRef) {
    return;
  }

  if (!pitchDownOffset) {
    cameraRef.lookAt(lookTargetRef);
    return;
  }

  const direction = lookTargetRef.clone().sub(cameraRef.position);
  const radius = Math.max(direction.length(), 0.0001);
  const horizontalDistance = Math.max(Math.hypot(direction.x, direction.z), 0.0001);
  const currentPitch = Math.atan2(direction.y, horizontalDistance);
  const adjustedPitch = currentPitch - pitchDownOffset;
  const adjustedHorizontalDistance = Math.cos(adjustedPitch) * radius;
  const horizontalScale = adjustedHorizontalDistance / horizontalDistance;
  const adjustedDirection = new THREE.Vector3(
    direction.x * horizontalScale,
    Math.sin(adjustedPitch) * radius,
    direction.z * horizontalScale
  );

  cameraRef.lookAt(cameraRef.position.clone().add(adjustedDirection));
}

function fitAvatarToView(root, cameraRef, lookTargetRef, fileName) {
  const stageSize = measureStage();
  const isMobileViewport = stageSize.width <= MOBILE_STAGE_BREAKPOINT;
  const rootRotation = MODEL_ROOT_ROTATION_OVERRIDES[fileName] || DEFAULT_ROOT_ROTATION;
  root.rotation.set(
    isMobileViewport ? rootRotation.mobilePitch : 0,
    rootRotation.yaw + (isMobileViewport ? rootRotation.mobileYawOffset : 0),
    0
  );
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const stageAspect = stageSize.width / Math.max(stageSize.height, 1);
  const verticalFov = THREE.MathUtils.degToRad(cameraRef.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * stageAspect);
  box.getSize(size);
  const bodyAnchor = getBodyAnchorPoint(currentVrm, box);

  root.position.x = -bodyAnchor.x;
  root.position.z = -bodyAnchor.z;
  root.position.y = -(box.min.y + 1.02);
  root.updateMatrixWorld(true);

  const centeredBox = new THREE.Box3().setFromObject(root);
  const centeredSize = new THREE.Vector3();
  centeredBox.getSize(centeredSize);

  const preset = MODEL_CAMERA_OVERRIDES[fileName] || DEFAULT_CAMERA;
  const adjustment = getCameraAdjustment(fileName);
  const baseTargetY = Math.max(preset.minTargetY, centeredSize.y * preset.targetYFactor);
  const baseCameraY = Math.max(
    Math.max(preset.minCameraY, centeredSize.y * preset.cameraYFactor),
    baseTargetY + 0.06
  );
  const baseCameraZ = Math.max(preset.minCameraZ, centeredSize.y * preset.cameraZFactor);
  const fitHeightCameraZ = (centeredSize.y * 0.64) / Math.tan(verticalFov / 2);
  const horizontalHalfSpan = Math.max(
    Math.abs(centeredBox.min.x),
    Math.abs(centeredBox.max.x),
    centeredSize.x * 0.5
  );
  const widthMargin = stageSize.width <= MOBILE_STAGE_BREAKPOINT ? 1.28 : 1.08;
  const fitWidthCameraZ = horizontalFov > 0.0001
    ? (horizontalHalfSpan * widthMargin) / Math.tan(horizontalFov / 2)
    : baseCameraZ;
  const minFitCameraZ = Math.max(baseCameraZ, fitHeightCameraZ, fitWidthCameraZ);

  const minHeightOffset = -Math.max(baseCameraY + 0.4, centeredSize.y * 1.05, 1.7);
  const maxHeightOffset = Math.max(1.2, centeredSize.y * 0.5);
  const minDistanceOffset = -Math.max(minFitCameraZ * 0.72, 2.3);
  const maxDistanceOffset = Math.max(minFitCameraZ * 0.9, 2.1);
  const horizontalOffsetLimit = Math.max(
    Math.abs(CAMERA_HORIZONTAL_RANGE_FALLBACK.min),
    Math.abs(CAMERA_HORIZONTAL_RANGE_FALLBACK.max),
    horizontalHalfSpan * (isMobileViewport ? 1.6 : 1.25),
    0.72
  );
  const minHorizontalOffset = -horizontalOffsetLimit;
  const maxHorizontalOffset = horizontalOffsetLimit;

  const heightOffset = clampNumber(
    adjustment.heightOffset,
    minHeightOffset,
    maxHeightOffset
  );
  const distanceOffset = clampNumber(
    adjustment.distanceOffset,
    minDistanceOffset,
    maxDistanceOffset
  );
  const horizontalOffset = clampNumber(
    adjustment.horizontalOffset,
    minHorizontalOffset,
    maxHorizontalOffset
  );

  cameraToolRanges.set(fileName, {
    minHeightOffset,
    maxHeightOffset,
    minDistanceOffset,
    maxDistanceOffset,
    minHorizontalOffset,
    maxHorizontalOffset
  });

  if (
    heightOffset !== adjustment.heightOffset ||
    distanceOffset !== adjustment.distanceOffset ||
    horizontalOffset !== adjustment.horizontalOffset
  ) {
    saveCameraAdjustment(fileName, {
      heightOffset,
      distanceOffset,
      horizontalOffset
    });
  }

  // Move the camera and look target together so height changes feel like
  // a vertical camera translation rather than a tilt adjustment.
  const targetY = baseTargetY + heightOffset;
  const cameraY = baseCameraY + heightOffset;
  const cameraZ = Math.max(0.38, minFitCameraZ + distanceOffset);

  lookTargetRef.set(0, targetY, 0);
  cameraRef.position.set(0, cameraY, cameraZ);
  applyCameraLookAt(cameraRef, lookTargetRef, CAMERA_PITCH_DOWN_OFFSET);
  if (!isMobileViewport) {
    centerFocusPointHorizontally(cameraRef, lookTargetRef, currentVrm, centeredBox, horizontalFov);
  } else {
    centerModelHorizontallyInView(
      root,
      cameraRef,
      currentVrm,
      centeredBox,
      horizontalFov,
      MOBILE_PROJECTED_X_TARGET
    );
  }

  lookTargetRef.x += horizontalOffset;
  cameraRef.position.x += horizontalOffset;
  applyCameraLookAt(cameraRef, lookTargetRef, CAMERA_PITCH_DOWN_OFFSET);
}

function centerFocusPointHorizontally(cameraRef, lookTargetRef, vrmRef, fittedBox, horizontalFov) {
  const focusPoint = getFocusPoint(vrmRef, fittedBox);
  const boxWidth = Math.max(fittedBox.max.x - fittedBox.min.x, 0.01);
  const maxShift = boxWidth * 0.18;
  let totalShift = 0;

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
    const remainingShift = Math.max(maxShift - Math.abs(totalShift), 0);
    const clampedDeltaX = THREE.MathUtils.clamp(deltaX, -remainingShift, remainingShift);

    cameraRef.position.x += clampedDeltaX;
    lookTargetRef.x += clampedDeltaX;
    totalShift += clampedDeltaX;
    applyCameraLookAt(cameraRef, lookTargetRef, CAMERA_PITCH_DOWN_OFFSET);
  }
}

function centerModelHorizontallyInView(
  root,
  cameraRef,
  vrmRef,
  fittedBox,
  horizontalFov,
  targetProjectedX = 0
) {
  const boxWidth = Math.max(fittedBox.max.x - fittedBox.min.x, 0.01);
  const maxShift = boxWidth * 0.6;
  let totalShift = 0;

  for (let step = 0; step < 5; step += 1) {
    root.updateMatrixWorld(true);
    const liveBox = new THREE.Box3().setFromObject(root);
    const focusPoint = getBodyAnchorPoint(vrmRef, liveBox);
    const projected = focusPoint.clone().project(cameraRef);
    const projectedDelta = projected.x - targetProjectedX;
    if (Math.abs(projectedDelta) < 0.0035) {
      break;
    }

    const focusInCamera = focusPoint.clone().applyMatrix4(cameraRef.matrixWorldInverse);
    const depth = Math.max(Math.abs(focusInCamera.z), 0.01);
    const halfWidth = Math.max(Math.tan(horizontalFov / 2) * depth, 0.0001);
    const deltaX = projectedDelta * halfWidth;
    const remainingShift = Math.max(maxShift - Math.abs(totalShift), 0);
    const clampedDeltaX = THREE.MathUtils.clamp(deltaX, -remainingShift, remainingShift);

    root.position.x -= clampedDeltaX;
    totalShift += clampedDeltaX;
  }

  root.updateMatrixWorld(true);
}

function getBodyAnchorPoint(vrmRef, fittedBox) {
  const point = new THREE.Vector3();
  const sum = new THREE.Vector3();
  const boneNames = ["hips", "spine", "chest", "upperChest", "neck", "head"];
  let count = 0;

  for (const boneName of boneNames) {
    const node = vrmRef?.humanoid?.getNormalizedBoneNode(boneName);
    if (!node) {
      continue;
    }

    node.getWorldPosition(point);
    sum.add(point);
    count += 1;
  }

  if (count > 0) {
    return sum.divideScalar(count);
  }

  fittedBox.getCenter(point);
  return point;
}

function getFocusPoint(vrmRef, fittedBox) {
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

function loadSelectedModel() {
  try {
    return window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveSelectedModel(fileName) {
  if (!fileName) {
    return;
  }

  try {
    window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, fileName);
  } catch {
    // Ignore storage failures so the viewer still works in private browsing modes.
  }
}

function applyRelaxedPose(vrmRef, elapsed) {
  const humanoid = vrmRef.humanoid;
  if (!humanoid) {
    return;
  }

  const spine = humanoid.getNormalizedBoneNode("spine");
  const chest = humanoid.getNormalizedBoneNode("chest");
  const neck = humanoid.getNormalizedBoneNode("neck");
  const head = humanoid.getNormalizedBoneNode("head");
  const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
  const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
  const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
  const leftHand = humanoid.getNormalizedBoneNode("leftHand");
  const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
  const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
  const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
  const rightHand = humanoid.getNormalizedBoneNode("rightHand");
  const relaxedPose = RELAXED_POSE_OVERRIDES[currentModel] || DEFAULT_RELAXED_POSE;
  const upperBodyPose =
    RELAXED_UPPER_BODY_OVERRIDES[currentModel] || DEFAULT_RELAXED_UPPER_BODY;

  const motionSuppression = THREE.MathUtils.clamp(
    Math.max(motionState.currentWeight || 0, motionState.thinkingPoseWeight || 0),
    0,
    1
  );
  const breatheScale = 1 - motionSuppression * 0.45;
  const nodScale = 1 - motionSuppression * 0.82;
  const breathe = Math.sin(elapsed * 0.9) * 0.012 * breatheScale;
  const nod =
    Math.sin(elapsed * 0.7) * 0.018 * nodScale * (upperBodyPose.nodScale ?? 1);

  if (spine) {
    spine.rotation.x = upperBodyPose.spineX + breathe;
    spine.rotation.y = 0;
    spine.rotation.z = 0;
  }

  if (chest) {
    chest.rotation.x = upperBodyPose.chestX + breathe * 0.7;
    chest.rotation.y = 0;
    chest.rotation.z = 0;
  }

  if (neck) {
    neck.rotation.x = upperBodyPose.neckX + nod;
    neck.rotation.y = 0;
    neck.rotation.z = 0;
  }

  if (head) {
    head.rotation.x = upperBodyPose.headX + nod * 0.8;
    head.rotation.y = 0;
    head.rotation.z = 0;
  }

  if (leftShoulder) {
    leftShoulder.rotation.x = relaxedPose.leftShoulder.x;
    leftShoulder.rotation.y = relaxedPose.leftShoulder.y;
    leftShoulder.rotation.z = relaxedPose.leftShoulder.z;
  }

  if (leftUpperArm) {
    leftUpperArm.rotation.x = relaxedPose.leftUpperArm.x;
    leftUpperArm.rotation.y = relaxedPose.leftUpperArm.y;
    leftUpperArm.rotation.z = relaxedPose.leftUpperArm.z;
  }

  if (leftLowerArm) {
    leftLowerArm.rotation.x = relaxedPose.leftLowerArm.x;
    leftLowerArm.rotation.y = relaxedPose.leftLowerArm.y;
    leftLowerArm.rotation.z = relaxedPose.leftLowerArm.z;
  }

  if (leftHand) {
    leftHand.rotation.x = relaxedPose.leftHand.x;
    leftHand.rotation.y = relaxedPose.leftHand.y;
    leftHand.rotation.z = relaxedPose.leftHand.z;
  }

  if (rightShoulder) {
    rightShoulder.rotation.x = relaxedPose.rightShoulder.x;
    rightShoulder.rotation.y = relaxedPose.rightShoulder.y;
    rightShoulder.rotation.z = relaxedPose.rightShoulder.z;
  }

  if (rightUpperArm) {
    rightUpperArm.rotation.x = relaxedPose.rightUpperArm.x;
    rightUpperArm.rotation.y = relaxedPose.rightUpperArm.y;
    rightUpperArm.rotation.z = relaxedPose.rightUpperArm.z;
  }

  if (rightLowerArm) {
    rightLowerArm.rotation.x = relaxedPose.rightLowerArm.x;
    rightLowerArm.rotation.y = relaxedPose.rightLowerArm.y;
    rightLowerArm.rotation.z = relaxedPose.rightLowerArm.z;
  }

  if (rightHand) {
    rightHand.rotation.x = relaxedPose.rightHand.x;
    rightHand.rotation.y = relaxedPose.rightHand.y;
    rightHand.rotation.z = relaxedPose.rightHand.z;
  }
}

function applyBlink(vrmRef, elapsed) {
  const manager = vrmRef.expressionManager;
  if (!manager) {
    return;
  }

  manager.setValue("blink", 0);
  const blink = Math.max(0, Math.sin(elapsed * 0.9 + 1.2) * 12 - 11);
  manager.setValue("blinkLeft", blink);
  manager.setValue("blinkRight", blink);
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enabled = false;
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 300;
controls.zoomSpeed = 0.3;
controls.rotateSpeed = 0.3;
controls.update();

function createGlowMaterial(color, size = 128, opacity = 0.55) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Sprite(material);
}


const centralGlow = createGlowMaterial('rgba(255,255,255,0.8)', 156, 0.25);
centralGlow.scale.set(8, 8, 1);
scene.add(centralGlow);

for (let i = 0; i < 15; i++) {
  const hue = Math.random() * 360;
  const color = `hsla(${hue}, 80%, 50%, 0.6)`;
  const nebula = createGlowMaterial(color, 256);
  nebula.scale.set(100, 100, 1);
  nebula.position.set(
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175
  );
  scene.add(nebula);
}


const galaxyParameters = {
  count: 100000,
  arms: 6,
  radius: 100,
  spin: 0.5,
  randomness: 0.2,
  randomnessPower: 20,
  insideColor: new THREE.Color(0xd63ed6),
  outsideColor: new THREE.Color(0x48b8b8),
};

const defaultHeartImages = Array.from({ length: 2 }, (_, i) => `images/img${i + 1}.jpg`);

const heartImages = [
  ...(window.dataCCD?.data?.heartImages || []),
  ...defaultHeartImages,
];

const textureLoader = new THREE.TextureLoader();
const numGroups = heartImages.length;



const maxDensity = 50000;

const minDensity = 2000;

const maxGroupsForScale = 14;

let pointsPerGroup;

if (numGroups <= 1) {
  pointsPerGroup = maxDensity;
} else if (numGroups >= maxGroupsForScale) {
  pointsPerGroup = minDensity;
} else {
  const t = (numGroups - 1) / (maxGroupsForScale - 1);
  pointsPerGroup = Math.floor(maxDensity * (1 - t) + minDensity * t);
}

if (pointsPerGroup * numGroups > galaxyParameters.count) {
  pointsPerGroup = Math.floor(galaxyParameters.count / numGroups);
}

console.log(`Số lượng ảnh: ${numGroups}, Điểm mỗi ảnh: ${pointsPerGroup}`);

const positions = new Float32Array(galaxyParameters.count * 3);
const colors = new Float32Array(galaxyParameters.count * 3);


let pointIdx = 0;
for (let i = 0; i < galaxyParameters.count; i++) {
  const radius = Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
  const branchAngle = (i % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
  const spinAngle = radius * galaxyParameters.spin;

  const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 1.2; 
  const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
  const totalAngle = branchAngle + spinAngle;

  if (radius < 30 && Math.random() < 0.8) continue;

  const i3 = pointIdx * 3;
  positions[i3] = Math.cos(totalAngle) * radius + randomX;
  positions[i3 + 1] = randomY;
  positions[i3 + 2] = Math.sin(totalAngle) * radius + randomZ;

  const mixedColor = new THREE.Color(0xff66ff);
  mixedColor.lerp(new THREE.Color(0x66ffff), radius / galaxyParameters.radius);
  mixedColor.multiplyScalar(0.7 + 0.3 * Math.random());
  colors[i3] = mixedColor.r;
  colors[i3 + 1] = mixedColor.g;
  colors[i3 + 2] = mixedColor.b;

  pointIdx++;
}

const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, pointIdx * 3), 3));
galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, pointIdx * 3), 3));

const galaxyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uSize: { value: 50.0 * renderer.getPixelRatio() },
    uRippleTime: { value: -1.0 },
    uRippleSpeed: { value: 40.0 },
    uRippleWidth: { value: 20.0 }
  },
  vertexShader: `
        uniform float uSize;
        uniform float uTime;
        uniform float uRippleTime;
        uniform float uRippleSpeed;
        uniform float uRippleWidth;

        varying vec3 vColor;

        void main() {
            // Lấy màu gốc từ geometry (giống hệt vertexColors: true)
            vColor = color;

            vec4 modelPosition = modelMatrix * vec4(position, 1.0);

            // ---- LOGIC HIỆU ỨNG GỢN SÓNG ----
            if (uRippleTime > 0.0) {
                float rippleRadius = (uTime - uRippleTime) * uRippleSpeed;
                float particleDist = length(modelPosition.xyz);

                float strength = 1.0 - smoothstep(rippleRadius - uRippleWidth, rippleRadius + uRippleWidth, particleDist);
                strength *= smoothstep(rippleRadius + uRippleWidth, rippleRadius - uRippleWidth, particleDist);

                if (strength > 0.0) {
                    vColor += vec3(strength * 2.0); // Làm màu sáng hơn khi sóng đi qua
                }
            }

            vec4 viewPosition = viewMatrix * modelPosition;
            gl_Position = projectionMatrix * viewPosition;
            // Dòng này làm cho các hạt nhỏ hơn khi ở xa, mô phỏng hành vi của PointsMaterial
            gl_PointSize = uSize / -viewPosition.z;
        }
    `,
  fragmentShader: `
        varying vec3 vColor;
        void main() {
            // Làm cho các hạt có hình tròn thay vì hình vuông
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;

            gl_FragColor = vec4(vColor, 1.0);
        }
    `,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  vertexColors: true
});
const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
scene.add(galaxy);

function createNeonTexture(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const aspectRatio = image.width / image.height;
  let drawWidth, drawHeight, offsetX, offsetY;
  if (aspectRatio > 1) {
    drawWidth = size;
    drawHeight = size / aspectRatio;
    offsetX = 0;
    offsetY = (size - drawHeight) / 2;
  } else {
    drawHeight = size;
    drawWidth = size * aspectRatio;
    offsetX = (size - drawWidth) / 2;
    offsetY = 0;
  }
  ctx.clearRect(0, 0, size, size);
  const cornerRadius = size * 0.1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(offsetX + cornerRadius, offsetY);
  ctx.lineTo(offsetX + drawWidth - cornerRadius, offsetY);
  ctx.arcTo(offsetX + drawWidth, offsetY, offsetX + drawWidth, offsetY + cornerRadius, cornerRadius);
  ctx.lineTo(offsetX + drawWidth, offsetY + drawHeight - cornerRadius);
  ctx.arcTo(offsetX + drawWidth, offsetY + drawHeight, offsetX + drawWidth - cornerRadius, offsetY + drawHeight, cornerRadius);
  ctx.lineTo(offsetX + cornerRadius, offsetY + drawHeight);
  ctx.arcTo(offsetX, offsetY + drawHeight, offsetX, offsetY + drawHeight - cornerRadius, cornerRadius);
  ctx.lineTo(offsetX, offsetY + cornerRadius);
  ctx.arcTo(offsetX, offsetY, offsetX + cornerRadius, offsetY, cornerRadius);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

for (let group = 0; group < numGroups; group++) {
  const groupPositions = new Float32Array(pointsPerGroup * 3);
  const groupColorsNear = new Float32Array(pointsPerGroup * 3);
  const groupColorsFar = new Float32Array(pointsPerGroup * 3);
  let validPointCount = 0;

  for (let i = 0; i < pointsPerGroup; i++) {
    const idx = validPointCount * 3;
    const globalIdx = group * pointsPerGroup + i;
    const radius = Math.pow(Math.random(), galaxyParameters.randomnessPower) * galaxyParameters.radius;
    if (radius < 30) continue;

    const branchAngle = (globalIdx % galaxyParameters.arms) / galaxyParameters.arms * Math.PI * 2;
    const spinAngle = radius * galaxyParameters.spin;

    const randomX = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
    const randomY = (Math.random() - 0.5) * galaxyParameters.randomness * radius * 0.5;
    const randomZ = (Math.random() - 0.5) * galaxyParameters.randomness * radius;
    const totalAngle = branchAngle + spinAngle;

    groupPositions[idx] = Math.cos(totalAngle) * radius + randomX;
    groupPositions[idx + 1] = randomY;
    groupPositions[idx + 2] = Math.sin(totalAngle) * radius + randomZ;

    const colorNear = new THREE.Color(0xffffff);
    groupColorsNear[idx] = colorNear.r;
    groupColorsNear[idx + 1] = colorNear.g;
    groupColorsNear[idx + 2] = colorNear.b;

    const colorFar = galaxyParameters.insideColor.clone();
    colorFar.lerp(galaxyParameters.outsideColor, radius / galaxyParameters.radius);
    colorFar.multiplyScalar(0.7 + 0.3 * Math.random());
    groupColorsFar[idx] = colorFar.r;
    groupColorsFar[idx + 1] = colorFar.g;
    groupColorsFar[idx + 2] = colorFar.b;

    validPointCount++;
  }

  if (validPointCount === 0) continue;


  const groupGeometryNear = new THREE.BufferGeometry();
  groupGeometryNear.setAttribute('position', new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3));
  groupGeometryNear.setAttribute('color', new THREE.BufferAttribute(groupColorsNear.slice(0, validPointCount * 3), 3));

  const groupGeometryFar = new THREE.BufferGeometry();
  groupGeometryFar.setAttribute('position', new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3));
  groupGeometryFar.setAttribute('color', new THREE.BufferAttribute(groupColorsFar.slice(0, validPointCount * 3), 3));

  const posAttr = groupGeometryFar.getAttribute('position');
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < posAttr.count; i++) {
    cx += posAttr.getX(i);
    cy += posAttr.getY(i);
    cz += posAttr.getZ(i);
  }
  cx /= posAttr.count;
  cy /= posAttr.count;
  cz /= posAttr.count;
  groupGeometryNear.translate(-cx, -cy, -cz);
  groupGeometryFar.translate(-cx, -cy, -cz);

  const img = new window.Image();
  img.crossOrigin = "Anonymous";
  img.src = heartImages[group];
  img.onload = () => {
    const neonTexture = createNeonTexture(img, 256);

    const materialNear = new THREE.PointsMaterial({
      size: 1.8,
      map: neonTexture,
      transparent: false,
      alphaTest: 0.2,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NormalBlending,
      vertexColors: true
    });

    const materialFar = new THREE.PointsMaterial({
      size: 1.8,
      map: neonTexture,
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    const pointsObject = new THREE.Points(groupGeometryFar, materialFar);
    pointsObject.position.set(cx, cy, cz);

    pointsObject.userData.materialNear = materialNear;
    pointsObject.userData.geometryNear = groupGeometryNear;
    pointsObject.userData.materialFar = materialFar;
    pointsObject.userData.geometryFar = groupGeometryFar;

    scene.add(pointsObject);
  };
}


const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const starCount = 20000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 900;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.7,
  transparent: true,
  opacity: 0.7,
  depthWrite: false
});
const starField = new THREE.Points(starGeometry, starMaterial);
starField.name = 'starfield';
starField.renderOrder = 999;
scene.add(starField);

let shootingStars = [];

function createShootingStar() {
  const trailLength = 100;

  const headGeometry = new THREE.SphereGeometry(2, 32, 32);
  const headMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);

  const glowGeometry = new THREE.SphereGeometry(3, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            varying vec3 vNormal;
            uniform float time;
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * (0.8 + sin(time * 5.0) * 0.2));
            }
        `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  head.add(glow);

  const atmosphereGeometry = new THREE.SphereGeometry(planetRadius * 1.05, 48, 48);
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xe0b3ff) }
    },
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
        }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });

  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  planet.add(atmosphere); 
  const curve = createRandomCurve();
  const trailPoints = [];
  for (let i = 0; i < trailLength; i++) {
    const progress = i / (trailLength - 1);
    trailPoints.push(curve.getPoint(progress));
  }
  const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x99eaff,
    transparent: true,
    opacity: 0.7,
    linewidth: 2
  });
  const trail = new THREE.Line(trailGeometry, trailMaterial);

  const shootingStarGroup = new THREE.Group();
  shootingStarGroup.add(head);
  shootingStarGroup.add(trail);
  shootingStarGroup.userData = {
    curve: curve,
    progress: 0,
    speed: 0.001 + Math.random() * 0.001,
    life: 0,
    maxLife: 300,
    head: head,
    trail: trail,
    trailLength: trailLength,
    trailPoints: trailPoints,
  };
  scene.add(shootingStarGroup);
  shootingStars.push(shootingStarGroup);
}

function createRandomCurve() {
  const points = [];
  const startPoint = new THREE.Vector3(-200 + Math.random() * 100, -100 + Math.random() * 200, -100 + Math.random() * 200);
  const endPoint = new THREE.Vector3(600 + Math.random() * 200, startPoint.y + (-100 + Math.random() * 200), startPoint.z + (-100 + Math.random() * 200));
  const controlPoint1 = new THREE.Vector3(startPoint.x + 200 + Math.random() * 100, startPoint.y + (-50 + Math.random() * 100), startPoint.z + (-50 + Math.random() * 100));
  const controlPoint2 = new THREE.Vector3(endPoint.x - 200 + Math.random() * 100, endPoint.y + (-50 + Math.random() * 100), endPoint.z + (-50 + Math.random() * 100));

  points.push(startPoint, controlPoint1, controlPoint2, endPoint);
  return new THREE.CubicBezierCurve3(startPoint, controlPoint1, controlPoint2, endPoint);
}



function createPlanetTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, size / 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.00, '#f8bbd0');
  gradient.addColorStop(0.12, '#f48fb1');
  gradient.addColorStop(0.22, '#f06292');
  gradient.addColorStop(0.35, '#ffffff');
  gradient.addColorStop(0.50, '#e1aaff');
  gradient.addColorStop(0.62, '#a259f7');
  gradient.addColorStop(0.75, '#b2ff59');
  gradient.addColorStop(1.00, '#3fd8c7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const spotColors = ['#f8bbd0', '#f8bbd0', '#f48fb1', '#f48fb1', '#f06292', '#f06292', '#ffffff', '#e1aaff', '#a259f7', '#b2ff59'];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 30 + Math.random() * 120;
    const color = spotColors[Math.floor(Math.random() * spotColors.length)];
    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, color + 'cc');
    spotGradient.addColorStop(1, color + '00');
    ctx.fillStyle = spotGradient;
    ctx.fillRect(0, 0, size, size);
  }


  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.bezierCurveTo(Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size, Math.random() * size);
    ctx.strokeStyle = 'rgba(180, 120, 200, ' + (0.12 + Math.random() * 0.18) + ')';
    ctx.lineWidth = 8 + Math.random() * 18;
    ctx.stroke();
  }


  if (ctx.filter !== undefined) {
    ctx.filter = 'blur(2px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  return new THREE.CanvasTexture(canvas);
}


const stormShader = {
  uniforms: {
    time: { value: 0.0 },
    baseTexture: { value: null }
  },
  vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
  fragmentShader: `
        uniform float time;
        uniform sampler2D baseTexture;
        varying vec2 vUv;
        void main() {
            vec2 uv = vUv;
            float angle = length(uv - vec2(0.5)) * 3.0;
            float twist = sin(angle * 3.0 + time) * 0.1;
            uv.x += twist * sin(time * 0.5);
            uv.y += twist * cos(time * 0.5);
            vec4 texColor = texture2D(baseTexture, uv);
            float noise = sin(uv.x * 10.0 + time) * sin(uv.y * 10.0 + time) * 0.1;
            texColor.rgb += noise * vec3(0.8, 0.4, 0.2);
            gl_FragColor = texColor;
        }
    `
};


const planetRadius = 10;
const planetGeometry = new THREE.SphereGeometry(planetRadius, 48, 48);
const planetTexture = createPlanetTexture();
const planetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    baseTexture: { value: planetTexture }
 

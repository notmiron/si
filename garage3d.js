import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

(function () {
  var canvas = document.getElementById('garageCanvas');
  if (!canvas) return;

  // ─── Renderer ───────────────────────────────────────────
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 3.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x050608, 1);

  // ─── Scene & Camera ─────────────────────────────────────
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050608, 0.025);

  var camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.6, 5.5);
  camera.lookAt(0, 1.4, -4);

  // ─── Procedural Textures ────────────────────────────────
  function makeTexture(size, basR, basG, basB, noise) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(' + basR + ',' + basG + ',' + basB + ')';
    ctx.fillRect(0, 0, size, size);
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * noise;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function makeNormal(size, str) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * str));
      d[i + 1] = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * str));
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Concrete
  var concTex = makeTexture(512, 22, 22, 26, 25);
  concTex.repeat.set(3, 3);
  var concNrm = makeNormal(512, 40);
  concNrm.repeat.set(3, 3);

  // Floor
  var floorTex = makeTexture(512, 14, 14, 18, 15);
  floorTex.repeat.set(5, 5);
  var floorNrm = makeNormal(512, 25);
  floorNrm.repeat.set(5, 5);

  // Metal door
  var metalTex = makeTexture(256, 38, 38, 44, 10);
  metalTex.repeat.set(1, 14);
  var metalNrm = makeNormal(256, 18);
  metalNrm.repeat.set(1, 14);

  // ─── Materials ──────────────────────────────────────────
  var concreteMat = new THREE.MeshStandardMaterial({
    map: concTex,
    normalMap: concNrm,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.88,
    metalness: 0.0,
    color: 0x5a5a65,
  });

  var floorMat = new THREE.MeshPhysicalMaterial({
    map: floorTex,
    normalMap: floorNrm,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.25,
    metalness: 0.08,
    color: 0x252530,
    reflectivity: 0.8,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
  });

  var doorMat = new THREE.MeshStandardMaterial({
    map: metalTex,
    normalMap: metalNrm,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.4,
    metalness: 0.85,
    color: 0x5a5a65,
  });

  var frameMat = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.92,
    color: 0x1e1e22,
  });

  // ─── Room Geometry ──────────────────────────────────────
  var RW = 10; // room width
  var RD = 12; // room depth
  var RH = 4.5; // room height
  var WALL_Z = -RD / 2 + 1; // back wall z = -5
  var DW = 5.2; // door width
  var DH = 3.4; // door height

  // Floor
  var floorGeo = new THREE.PlaneGeometry(RW, RD);
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  var ceilGeo = new THREE.PlaneGeometry(RW, RD);
  var ceil = new THREE.Mesh(ceilGeo, concreteMat.clone());
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, RH, 0);
  scene.add(ceil);

  // Left wall
  var lwGeo = new THREE.PlaneGeometry(RD, RH);
  var lw = new THREE.Mesh(lwGeo, concreteMat);
  lw.rotation.y = Math.PI / 2;
  lw.position.set(-RW / 2, RH / 2, 0);
  lw.receiveShadow = true;
  scene.add(lw);

  // Right wall
  var rw = new THREE.Mesh(lwGeo.clone(), concreteMat);
  rw.rotation.y = -Math.PI / 2;
  rw.position.set(RW / 2, RH / 2, 0);
  rw.receiveShadow = true;
  scene.add(rw);

  // Back wall — 3 pieces around the door opening
  var sideW = (RW - DW) / 2;
  // left piece
  var bwl = new THREE.Mesh(
    new THREE.PlaneGeometry(sideW, RH),
    concreteMat
  );
  bwl.position.set(-(DW / 2 + sideW / 2), RH / 2, WALL_Z);
  scene.add(bwl);

  // right piece
  var bwr = new THREE.Mesh(
    new THREE.PlaneGeometry(sideW, RH),
    concreteMat
  );
  bwr.position.set(DW / 2 + sideW / 2, RH / 2, WALL_Z);
  scene.add(bwr);

  // top piece (above door)
  var bwt = new THREE.Mesh(
    new THREE.PlaneGeometry(DW, RH - DH),
    concreteMat
  );
  bwt.position.set(0, DH + (RH - DH) / 2, WALL_Z);
  scene.add(bwt);

  // ─── Door Frame ─────────────────────────────────────────
  var FT = 0.12; // frame thickness
  var FD = 0.18; // frame depth

  var fleft = new THREE.Mesh(new THREE.BoxGeometry(FT, DH + FT, FD), frameMat);
  fleft.position.set(-DW / 2 - FT / 2, DH / 2, WALL_Z + FD / 2);
  scene.add(fleft);

  var fright = new THREE.Mesh(new THREE.BoxGeometry(FT, DH + FT, FD), frameMat);
  fright.position.set(DW / 2 + FT / 2, DH / 2, WALL_Z + FD / 2);
  scene.add(fright);

  var ftop = new THREE.Mesh(new THREE.BoxGeometry(DW + FT * 2, FT, FD), frameMat);
  ftop.position.set(0, DH + FT / 2, WALL_Z + FD / 2);
  scene.add(ftop);

  // ─── Roller Door (group of panels) ──────────────────────
  var doorGroup = new THREE.Group();
  var PANELS = 14;
  var pH = DH / PANELS;
  var pGap = 0.006;

  for (var p = 0; p < PANELS; p++) {
    var panel = new THREE.Mesh(
      new THREE.BoxGeometry(DW - 0.04, pH - pGap, 0.055),
      doorMat
    );
    panel.position.set(0, pH / 2 + p * pH, WALL_Z + 0.09);
    panel.castShadow = true;
    panel.receiveShadow = true;
    doorGroup.add(panel);
  }
  scene.add(doorGroup);

  // ─── Structural pillars ─────────────────────────────────
  var pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    roughness: 0.8,
    metalness: 0.1,
  });
  [-RW / 2 + 0.15, RW / 2 - 0.15].forEach(function (x) {
    var pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, RH, 0.25),
      pillarMat
    );
    pillar.position.set(x, RH / 2, WALL_Z + 2.5);
    pillar.castShadow = true;
    scene.add(pillar);
  });

  // ─── Lights ─────────────────────────────────────────────
  // Ambient fill
  scene.add(new THREE.AmbientLight(0x2a2a3e, 1.5));

  // Hemisphere light (sky/ground fill)
  var hemi = new THREE.HemisphereLight(0x3a3a50, 0x1a1a20, 1.0);
  scene.add(hemi);

  // Fluorescent tube (emissive mesh + 2 point lights)
  var tubeW = 2.5;
  var tubeGeo = new THREE.BoxGeometry(tubeW, 0.04, 0.12);
  var tubeMat = new THREE.MeshBasicMaterial({
    color: 0xfff0dd,
    transparent: true,
    opacity: 0.85,
  });
  var tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.position.set(0, RH - 0.06, WALL_Z + 2.5);
  scene.add(tubeMesh);

  // Tube housing
  var housingGeo = new THREE.BoxGeometry(tubeW + 0.3, 0.08, 0.2);
  var housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.3 });
  var housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.set(0, RH - 0.03, WALL_Z + 2.5);
  scene.add(housing);

  var tl1 = new THREE.PointLight(0xfff0dd, 15.0, 20, 1.2);
  tl1.position.set(-0.6, RH - 0.15, WALL_Z + 2.5);
  tl1.castShadow = true;
  tl1.shadow.mapSize.set(1024, 1024);
  tl1.shadow.bias = -0.002;
  scene.add(tl1);

  var tl2 = new THREE.PointLight(0xfff0dd, 15.0, 20, 1.2);
  tl2.position.set(0.6, RH - 0.15, WALL_Z + 2.5);
  scene.add(tl2);

  // Fill light behind camera
  var fillLight = new THREE.PointLight(0x8888aa, 4.0, 18, 1.5);
  fillLight.position.set(0, 3, 5);
  scene.add(fillLight);

  // Additional fill lights along walls
  var wallFillL = new THREE.PointLight(0x667788, 3.0, 12, 1.5);
  wallFillL.position.set(-RW / 2 + 1, 2.5, 0);
  scene.add(wallFillL);

  var wallFillR = new THREE.PointLight(0x667788, 3.0, 12, 1.5);
  wallFillR.position.set(RW / 2 - 1, 2.5, 0);
  scene.add(wallFillR);

  // Under-door light reference (no colored accents)
  var underLight = { intensity: 0 };

  // ─── Post-Processing ────────────────────────────────────
  var composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  var bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // strength
    0.5, // radius
    0.82 // threshold
  );
  composer.addPass(bloomPass);

  // Film grain pass
  var grainShader = {
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
      amount: { value: 0.06 },
    },
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tDiffuse;',
      'uniform float time;',
      'uniform float amount;',
      'varying vec2 vUv;',
      'float rand(vec2 co) {',
      '  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
      '}',
      'void main() {',
      '  vec4 color = texture2D(tDiffuse, vUv);',
      '  float grain = rand(vUv * time) * amount;',
      '  color.rgb += grain - amount * 0.5;',
      '  gl_FragColor = color;',
      '}',
    ].join('\n'),
  };
  var grainPass = new ShaderPass(grainShader);
  composer.addPass(grainPass);

  // ─── Animation Loop ─────────────────────────────────────
  var startTime = Date.now();

  function animate() {
    requestAnimationFrame(animate);

    var t = window._garageProgress || 0;
    var elapsed = (Date.now() - startTime) * 0.001;

    // Door slides up (starts at 10% scroll, done at 55%)
    var doorT = Math.max(0, Math.min(1, (t - 0.1) / 0.45));
    doorGroup.position.y = doorT * (DH + 1.5);

    // Camera dolly in (0% → 80%)
    var camT = Math.min(t / 0.8, 1);
    // Ease: smooth step
    var camE = camT * camT * (3 - 2 * camT);
    camera.position.z = 5.5 - camE * 5.8;
    camera.position.y = 1.6 + camE * 0.25;
    camera.lookAt(0, 1.4 + camE * 0.15, WALL_Z);

    // Tube light flicker
    var flicker = Math.sin(elapsed * 8.3) * 0.3 + Math.sin(elapsed * 13.7) * 0.15;
    tl1.intensity = 15.0 + flicker;
    tl2.intensity = 15.0 - flicker;

    // Under-door light grows as door opens
    underLight.intensity = 3.0 + doorT * 4.0;

    // Film grain time
    grainPass.uniforms.time.value = elapsed;

    // Canvas fade out (70% → 100%)
    var fadeT = Math.max(0, (t - 0.7) / 0.3);
    canvas.style.opacity = String(1 - fadeT);

    composer.render();
  }

  animate();

  // ─── Resize ─────────────────────────────────────────────
  function onResize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', onResize, { passive: true });
})();

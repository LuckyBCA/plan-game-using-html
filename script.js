import * as THREE from "three";

// --- Basic Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 500, 2000); // Add fog for depth perception

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  3000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb); // Sky blue background
renderer.shadowMap.enabled = true; // Enable shadows
document.body.appendChild(renderer.domElement);

// --- HUD Elements ---
const speedometer = document.getElementById("speedometer");
const altimeter = document.getElementById("altimeter");

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xaaaaaa); // Soft ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(100, 150, 100);
directionalLight.castShadow = true;
// Configure shadow properties
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 50;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
scene.add(directionalLight);

// --- Ground / Runway ---
const groundSize = 4000;
const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x55aa55,
  side: THREE.DoubleSide,
}); // Green grass
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate flat
ground.receiveShadow = true;
scene.add(ground);

// Runway
const runwayWidth = 50;
const runwayLength = 1000;
const runwayGeometry = new THREE.PlaneGeometry(runwayWidth, runwayLength);
const runwayMaterial = new THREE.MeshStandardMaterial({
  color: 0x404040,
  side: THREE.DoubleSide,
});
const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
runway.rotation.x = -Math.PI / 2;
runway.position.y = 0.01; // Slightly above ground to prevent z-fighting
runway.position.z = -(runwayLength / 2) + 200; // Position it starting near origin
runway.receiveShadow = true;
scene.add(runway);

// --- Simple Plane Model ---
const plane = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Light grey body
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red wings

// Fuselage
const fuselageGeometry = new THREE.BoxGeometry(1, 1, 5); // x, y, z dimensions
const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
fuselage.castShadow = true;
plane.add(fuselage);

// Wings
const wingGeometry = new THREE.BoxGeometry(8, 0.2, 1.5); // Span, thickness, chord
const wing = new THREE.Mesh(wingGeometry, wingMaterial);
wing.position.z = -0.5; // Position along fuselage
wing.castShadow = true;
plane.add(wing);

// Tail Fin (Vertical Stabilizer)
const tailFinGeometry = new THREE.BoxGeometry(0.2, 1.5, 1);
const tailFin = new THREE.Mesh(tailFinGeometry, wingMaterial);
tailFin.position.z = 2; // Back of the fuselage
tailFin.position.y = 0.75;
tailFin.castShadow = true;
plane.add(tailFin);

// Horizontal Stabilizer
const hStabGeometry = new THREE.BoxGeometry(3, 0.15, 0.8);
const hStab = new THREE.Mesh(hStabGeometry, wingMaterial);
hStab.position.z = 2.2;
hStab.position.y = 0.5; // Attach near base of tail fin
hStab.castShadow = true;
plane.add(hStab);

const initialPlanePosition = new THREE.Vector3(0, 1.0, 0);
const initialPlaneRotation = new THREE.Euler(0, Math.PI, 0); // Point down the runway

plane.position.copy(initialPlanePosition);
plane.rotation.copy(initialPlaneRotation);
scene.add(plane);

// --- Set Initial Camera Position ---
// Calculate initial camera position based on plane's starting state
const initialCameraOffset = new THREE.Vector3(0, 5, 15); // Same offset as in animate
initialCameraOffset.applyQuaternion(plane.quaternion); // Apply initial plane rotation
const initialCameraPosition = new THREE.Vector3();
initialCameraPosition.copy(plane.position).add(initialCameraOffset);

camera.position.copy(initialCameraPosition);
camera.lookAt(plane.position); // Look at the plane's initial position

// --- Cityscape Generation ---
const cityArea = 1500; // Square area size around origin
const buildingMaxHeight = 150;
const buildingPadding = 10; // Minimum space between buildings
const numBuildings = 200;
const buildings = new THREE.Group();

// Simple window texture function
function createWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.fillStyle = "#BBB"; // Building color
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#444"; // Window color
  for (let y = 4; y < canvas.height - 4; y += 8) {
    for (let x = 4; x < canvas.width - 4; x += 8) {
      context.fillRect(x, y, 4, 4); // Simple square windows
    }
  }
  return new THREE.CanvasTexture(canvas);
}

const buildingTexture = createWindowTexture();
buildingTexture.wrapS = THREE.RepeatWrapping;
buildingTexture.wrapT = THREE.RepeatWrapping;

for (let i = 0; i < numBuildings; i++) {
  const width = Math.random() * 30 + 15; // Random width
  const depth = Math.random() * 30 + 15; // Random depth
  const height = Math.random() * buildingMaxHeight + 20; // Random height

  const buildingGeometry = new THREE.BoxGeometry(width, height, depth);

  // Adjust texture repeat based on building size
  const buildingMaterial = new THREE.MeshStandardMaterial({
    map: buildingTexture,
  });
  // Clone material for unique texture offsets if needed, but usually not necessary for this effect
  buildingMaterial.map.repeat.set(
    Math.ceil(width / 10),
    Math.ceil(height / 10),
  );
  buildingMaterial.map.needsUpdate = true; // Important when changing repeat

  const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

  // Random position, avoiding runway area
  let posX, posZ;
  const placeTryLimit = 10; // Prevent infinite loops
  let tries = 0;
  do {
    posX = (Math.random() - 0.5) * cityArea;
    posZ = (Math.random() - 0.5) * cityArea;
    tries++;
  } while (
    tries < placeTryLimit &&
    Math.abs(posX) < runwayWidth / 2 + buildingPadding + width / 2 &&
    posZ > -runwayLength - buildingPadding - depth / 2 &&
    posZ < 200 + buildingPadding + depth / 2
  );

  if (tries < placeTryLimit) {
    // Only place if a suitable spot was found
    building.position.set(posX, height / 2, posZ); // Position base on the ground
    building.castShadow = true;
    building.receiveShadow = true;
    buildings.add(building);
  }
}
scene.add(buildings);

// --- Physics and Control Variables ---
let speed = 0;
const maxSpeed = 200;
const minSpeed = 0;
const acceleration = 0.5;
const deceleration = 0.3;
const takeoffSpeed = 50;
const climbRate = 0.5; // Rate of vertical speed increase after takeoff
const gravity = 0.98; // Simplified gravity effect
let verticalSpeed = 0;
let crashed = false; // Track crash state

const rollSpeed = 1.5;
const pitchSpeed = 1.0;
const yawSpeed = 1.0;

const keys = {}; // Keep track of pressed keys

// --- Reset Function ---
function resetPlane() {
  plane.position.copy(initialPlanePosition);
  plane.rotation.copy(initialPlaneRotation);
  speed = 0;
  verticalSpeed = 0;
  crashed = false;
  // Instantly move camera back to initial relative position on reset
  const resetCameraOffset = new THREE.Vector3(0, 5, 15);
  resetCameraOffset.applyQuaternion(plane.quaternion);
  const resetCameraPosition = new THREE.Vector3();
  resetCameraPosition.copy(plane.position).add(resetCameraOffset);
  camera.position.copy(resetCameraPosition);
  camera.lookAt(plane.position);
  console.log("Plane Reset");
}

// --- Event Listeners ---
document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  // Reset on Backspace
  if (event.code === "Backspace") {
    resetPlane();
  }
});
document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

// Handle window resize
window.addEventListener(
  "resize",
  () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  },
  false,
);

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta(); // Time since last frame in seconds

  // Don't update physics if crashed
  if (crashed) {
    renderer.render(scene, camera); // Keep rendering
    return;
  }

  // --- Handle Input and Update Physics ---
  let appliedThrust = 0;
  let appliedRoll = 0;
  let appliedPitch = 0;
  let appliedYaw = 0;

  // Throttle (W/S or Up/Down Arrows)
  if (keys["KeyW"] || keys["ArrowUp"]) appliedThrust = acceleration;
  if (keys["KeyS"] || keys["ArrowDown"]) appliedThrust = -deceleration * 2; // Stronger braking

  // Roll (A/D or Left/Right Arrows)
  if (keys["KeyA"] || keys["ArrowLeft"]) appliedRoll = rollSpeed;
  if (keys["KeyD"] || keys["ArrowRight"]) appliedRoll = -rollSpeed;

  // Pitch (R/F) - Nose Up/Down
  if (keys["KeyF"]) appliedPitch = pitchSpeed; // Nose Up
  if (keys["KeyR"]) appliedPitch = -pitchSpeed; // Nose Down

  // Yaw (Q/E) - Rudder Left/Right
  if (keys["KeyQ"]) appliedYaw = yawSpeed;
  if (keys["KeyE"]) appliedYaw = -yawSpeed;

  // Update Speed
  speed += appliedThrust * deltaTime;
  // Apply drag/friction (simple linear drag)
  if (appliedThrust === 0 && !isOnGround) {
    // Less drag on ground
    speed -= deceleration * deltaTime * (1 + speed / maxSpeed); // Slightly increase drag with speed
  } else if (appliedThrust === 0 && isOnGround) {
    speed -= deceleration * 2 * deltaTime; // More friction on ground
  }
  speed = Math.max(minSpeed, Math.min(speed, maxSpeed)); // Clamp speed

  // --- Apply Rotations ---
  // Rotations are applied relative to the plane's local axes

  // Yaw (Turn left/right) - Rotate around local Y axis
  plane.rotateY(appliedYaw * deltaTime);

  // Pitch (Nose up/down) - Rotate around local X axis
  plane.rotateX(appliedPitch * deltaTime);

  // Roll (Bank left/right) - Rotate around local Z axis
  plane.rotateZ(appliedRoll * deltaTime);

  // --- Handle Takeoff and Flight ---
  const altitude = plane.position.y;
  const isOnGround = altitude <= 1.01; // Slightly more tolerance

  if (isOnGround) {
    verticalSpeed = 0; // No vertical movement on ground
    plane.position.y = 1.0; // Keep it firmly on ground level

    // Takeoff condition - require slight pitch up
    const pitchAngle = plane.rotation.x; // Pitch relative to plane's frame
    if (speed > takeoffSpeed && pitchAngle < -0.05) {
      // Nose pitched up slightly (negative X rotation)
      verticalSpeed = climbRate * (speed / takeoffSpeed); // Initial jump based on speed excess
      console.log("Takeoff!");
    } else if (speed > takeoffSpeed * 0.8 && pitchAngle > 0.1) {
      // Nose pitched down too much on ground at speed
      console.log("Nose dragged on runway!");
    }
  } else {
    // --- In the Air ---
    // Basic Lift Simulation: Proportional to speed squared (simplified) and angle of attack (approximated by pitch)
    // We need the plane's upward direction vector relative to the world
    const localUp = new THREE.Vector3(0, 1, 0);
    const worldUp = localUp.applyQuaternion(plane.quaternion);

    // Simplified lift: More lift if speed is high enough to counteract gravity
    // This is VERY basic - just enough to stay airborne easily
    let lift = 0;
    if (speed > takeoffSpeed * 0.5) {
      // Lower speed threshold for some lift
      const pitchEffect = Math.max(0, worldUp.y);
      // Basic Stall: Reduce lift significantly if pitched up too much at low speed
      const pitchAngle = plane.rotation.x;
      let stallFactor = 1.0;
      if (speed < takeoffSpeed * 0.9 && pitchAngle < -0.8) {
        // Pitched up significantly (e.g., > ~45 deg) at lower speed
        stallFactor = 0.1; // Drastically reduce lift
        console.log("Stall warning!");
      }
      lift = speed * speed * 0.001 * pitchEffect * stallFactor;
    }

    // Apply Gravity
    verticalSpeed -= gravity * deltaTime;

    // Apply Lift
    verticalSpeed += lift * deltaTime;

    // Update altitude
    plane.position.y += verticalSpeed * deltaTime;

    // Ground collision / Landing
    if (plane.position.y < 1.0) {
      plane.position.y = 1.0;
      // Crash detection: Check vertical speed and roll angle on impact
      const rollAngle = Math.abs(plane.rotation.z % (Math.PI * 2)); // Normalize roll angle
      const maxSafeLandingVSpeed = -5; // Max vertical speed (negative) for safe landing
      const maxSafeRollAngle = 0.5; // Max roll angle (radians, ~28 degrees) for safe landing

      if (
        verticalSpeed < maxSafeLandingVSpeed ||
        rollAngle > maxSafeRollAngle
      ) {
        console.log(
          "Crashed! Vertical Speed:",
          verticalSpeed.toFixed(2),
          "Roll Angle:",
          rollAngle.toFixed(2),
        );
        speed = 0;
        crashed = true;
        speedometer.textContent = "CRASHED";
        altimeter.textContent = "Press Backspace";
      } else {
        console.log("Landed Safely. VSpeed:", verticalSpeed.toFixed(2));
        speed *= 0.7; // Lose more speed on landing
      }
      verticalSpeed = 0; // Stop vertical movement
    }
  }

  // --- Update Position based on Speed and Direction ---
  const forwardVector = new THREE.Vector3(0, 0, -1); // Plane's local forward axis is -Z
  forwardVector.applyQuaternion(plane.quaternion); // Rotate vector by plane's orientation

  plane.position.add(forwardVector.multiplyScalar(speed * deltaTime));

  // --- Update Camera ---
  // Simple third-person follow camera
  const cameraOffset = new THREE.Vector3(0, 5, 15); // Behind and slightly above
  const cameraTargetPosition = new THREE.Vector3(); // Renamed from cameraTarget

  // Apply plane's rotation to the offset vector
  cameraOffset.applyQuaternion(plane.quaternion);
  // Add the rotated offset to the plane's position
  cameraTargetPosition.copy(plane.position).add(cameraOffset);

  // Smoothly interpolate camera position (lerp)
  camera.position.lerp(cameraTargetPosition, 0.1); // Adjust 0.1 for faster/slower camera follow

  // Make camera look at the plane (or slightly in front for better view)
  const lookAtTarget = new THREE.Vector3();
  const lookAheadDistance = 5; // Look slightly ahead of the plane
  const forwardVectorLookAt = new THREE.Vector3(0, 0, -1);
  forwardVectorLookAt.applyQuaternion(plane.quaternion);
  lookAtTarget.copy(plane.position).add(forwardVectorLookAt.multiplyScalar(lookAheadDistance));
  // Smoothly interpolate lookAt target as well? Optional, can be jittery
  // camera.lookAt(lookAtTarget); // Look slightly ahead
  camera.lookAt(plane.position); // Keep looking directly at the plane for now

  // --- Update HUD ---
  if (!crashed) {
    speedometer.textContent = `Speed: ${speed.toFixed(1)}`;
    altimeter.textContent = `Altitude: ${Math.max(0, altitude - 1.0).toFixed(
      1,
    )}`; // Show altitude above ground (assuming ground is at y=0)
  }

  // --- Render ---
  renderer.render(scene, camera);
}

// Start the animation loop
animate();

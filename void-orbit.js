(function () {
    "use strict";

    var canvas = document.getElementById("voidCanvas");
    var startButton = document.getElementById("startButton");
    var randomizeButton = document.getElementById("randomizeButton");
    var panicButton = document.getElementById("panicButton");
    var collapseSlider = document.getElementById("collapseSlider");
    var dreadSlider = document.getElementById("dreadSlider");
    var densitySlider = document.getElementById("densitySlider");
    var massSlider = document.getElementById("massSlider");
    var collapseReadout = document.getElementById("collapseReadout");
    var dreadReadout = document.getElementById("dreadReadout");
    var densityReadout = document.getElementById("densityReadout");
    var massReadout = document.getElementById("massReadout");
    var spatialReadout = document.getElementById("spatialReadout");

    var audio = null;
    var master = null;
    var compressor = null;
    var analyser = null;
    var delay = null;
    var delayFeedback = null;
    var delayFilter = null;
    var drone = null;
    var bodies = [];
    var stars = [];

    // This voice counter was added after bug testing max collapse. Without it,
    // the planets could trigger so many overlapping sounds that WebAudio would
    // eventually stop making sound until the page was refreshed. Also sounded horrible
    var activeVoices = 0;
    var maxVoices = 26;
    var lastFrame = performance.now();
    var collapse = Number(collapseSlider.value) / 100;
    var dread = Number(dreadSlider.value) / 100;
    var density = Number(densitySlider.value);
    var planetMass = Number(massSlider.value) / 100;
    var flash = 0;
    var eventHorizonPulse = 0;
    var scene = null;
    var camera = null;
    var renderer = null;
    var starField = null;
    var singularity = null;
    var singularityGlow = null;
    var horizonRing = null;

    function makeOrbitLine() {
        var points = [];
        for (var i = 0; i <= 160; i += 1) {
            var angle = (i / 160) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
        }

        var geometry = new THREE.BufferGeometry().setFromPoints(points);
        var material = new THREE.LineBasicMaterial({
            color: 0xd8c8ff,
            transparent: true,
            opacity: 0.16
        });
        return new THREE.LineLoop(geometry, material);
    }

    function setupThree() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2500);
        camera.position.set(0, 0, 720);

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        renderer.setClearColor(0x050506, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        var ambient = new THREE.AmbientLight(0x6b5a8d, 1.35);
        var key = new THREE.PointLight(0xb38cff, 3.2, 900);
        key.position.set(0, 0, 240);
        scene.add(ambient);
        scene.add(key);

        var singularityGeometry = new THREE.SphereGeometry(58, 48, 32);
        var singularityMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        singularity = new THREE.Mesh(singularityGeometry, singularityMaterial);
        scene.add(singularity);

        var glowGeometry = new THREE.SphereGeometry(118, 48, 32);
        var glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x6f49a5,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        singularityGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        scene.add(singularityGlow);

        horizonRing = makeOrbitLine();
        horizonRing.material.opacity = 0.32;
        scene.add(horizonRing);
    }

    function resizeCanvas() {
        var rect = canvas.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function makeStars() {
        if (starField) {
            scene.remove(starField);
            starField.geometry.dispose();
            starField.material.dispose();
        }

        stars = [];
        var positions = [];

        // The star field is intentionally much wider than the orbit system so
        // the full black background still feels occupied on large screens.
        for (var i = 0; i < 850; i += 1) {
            var x = randomBetween(-1500, 1500);
            var y = randomBetween(-900, 900);
            var z = randomBetween(-760, 180);
            stars.push({
                x: x,
                y: y,
                z: z,
                phase: randomBetween(0, Math.PI * 2)
            });
            positions.push(x, y, z);
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        var material = new THREE.PointsMaterial({
            color: 0xe6e0ff,
            size: 2.6,
            transparent: true,
            opacity: 0.66,
            sizeAttenuation: true
        });
        starField = new THREE.Points(geometry, material);
        scene.add(starField);
    }

    function makeBody(index, total) {
        // Re-seeding uses the current slider values, so a high collapse or dread
        // setting creates a different kind of system instead of only changing
        // bodies that already exist.
        var baseRadius = randomBetween(150 - collapse * 58, 350 - collapse * 112) + index * (14 + dread * 10);
        var speedScale = 1 + collapse * 1.35 + dread * 0.65;
        var body = {
            id: index,
            radius: baseRadius,
            baseRadius: baseRadius,
            angle: randomBetween(0, Math.PI * 2),
            speed: randomBetween(0.22, 0.78) * speedScale * (index % 2 === 0 ? 1 : -1),
            size: (randomBetween(7, 15) + collapse * 4) * planetMass,
            carrier: randomBetween(65, 190) * (1 + index * 0.11) * (1 + dread * 0.24),
            ratio: [1.33, 1.414, 1.618, 2.17, 2.71, 3.33, 4.25][index % 7],
            triggerClock: randomBetween(0, 1.2),
            triggerInterval: randomBetween(0.85, 2.1) * (1 - collapse * 0.22),
            hue: 258 + (index / Math.max(1, total)) * 78,
            decay: randomBetween(0.08, 0.22) * (1 - dread * 0.22),
            glitch: 0
        };

        var geometry = new THREE.SphereGeometry(body.size, 32, 20);
        var material = new THREE.MeshStandardMaterial({
            color: new THREE.Color("hsl(" + body.hue + ", 92%, 62%)"),
            emissive: new THREE.Color("hsl(" + body.hue + ", 92%, 34%)"),
            emissiveIntensity: 1.4,
            roughness: 0.45,
            metalness: 0.18
        });
        body.mesh = new THREE.Mesh(geometry, material);
        body.mesh.position.z = 0;
        body.orbitLine = makeOrbitLine();
        body.orbitLine.material.opacity = 0.08 + dread * 0.08;
        scene.add(body.orbitLine);
        scene.add(body.mesh);
        return body;
    }

    function seedBodies() {
        bodies.forEach(function (body) {
            scene.remove(body.mesh);
            scene.remove(body.orbitLine);
            body.mesh.geometry.dispose();
            body.mesh.material.dispose();
            body.orbitLine.geometry.dispose();
            body.orbitLine.material.dispose();
        });
        bodies = [];
        for (var i = 0; i < density; i += 1) {
            bodies.push(makeBody(i, density));
        }
        flash = Math.max(flash, 0.3 + dread * 0.25);
        eventHorizonPulse = 1;
    }

    function updateReadouts() {
        collapse = Number(collapseSlider.value) / 100;
        dread = Number(dreadSlider.value) / 100;
        density = Number(densitySlider.value);
        planetMass = Number(massSlider.value) / 100;
        collapseReadout.textContent = Math.round(collapse * 100) + "%";
        dreadReadout.textContent = Math.round(dread * 100) + "%";
        densityReadout.textContent = density + " bodies";
        massReadout.textContent = Math.round(planetMass * 100) + "%";
        if (planetMass < 0.75) {
            spatialReadout.textContent = "Spatial field: distant";
        } else if (planetMass > 1.35) {
            spatialReadout.textContent = "Spatial field: close pass";
        } else {
            spatialReadout.textContent = "Spatial field: balanced";
        }
    }

    function makeDistortionCurve(amount) {
        var samples = 2048;
        var curve = new Float32Array(samples);
        var k = amount * 120;
        for (var i = 0; i < samples; i += 1) {
            var x = (i * 2) / samples - 1;
            curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
        }
        return curve;
    }

    function makeNoiseBuffer(seconds) {
        // A short fading noise buffer gives each planet a breathy texture. This
        // helped the sound feel less like hard objects clicking together. Like pool balls hitting each other/a wall
        var length = Math.floor(audio.sampleRate * seconds);
        var buffer = audio.createBuffer(1, length, audio.sampleRate);
        var data = buffer.getChannelData(0);

        for (var i = 0; i < length; i += 1) {
            var fade = 1 - i / length;
            data[i] = (Math.random() * 2 - 1) * fade * fade;
        }

        return buffer;
    }

    function startDrone() {
        if (drone) {
            return;
        }

        // The drone is the constant pressure under the sequencer. The orbit
        // sounds sit on top of this so the piece feels more like a black hole
        // environment and less like isolated notes floating around.
        var now = audio.currentTime;
        var low = audio.createOscillator();
        var rub = audio.createOscillator();
        var lowGain = audio.createGain();
        var rubGain = audio.createGain();
        var filter = audio.createBiquadFilter();
        var gain = audio.createGain();

        low.type = "sawtooth";
        rub.type = "triangle";
        low.frequency.value = 34;
        rub.frequency.value = 34.7;
        low.detune.value = -8;
        rub.detune.value = 11;
        lowGain.gain.value = 0.18;
        rubGain.gain.value = 0.12;
        filter.type = "lowpass";
        filter.frequency.value = 180;
        filter.Q.value = 8;
        gain.gain.value = 0.0001;

        low.connect(lowGain);
        rub.connect(rubGain);
        lowGain.connect(filter);
        rubGain.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        low.start(now);
        rub.start(now);
        drone = {
            low: low,
            rub: rub,
            filter: filter,
            gain: gain
        };
        updateDrone();
    }

    function updateDrone() {
        if (!audio || !drone) {
            return;
        }

        var now = audio.currentTime;
        var targetGain = 0.035 + dread * 0.055 + collapse * 0.04;
        var base = 29 + collapse * 18;
        drone.low.frequency.linearRampToValueAtTime(base, now + 0.18);
        drone.rub.frequency.linearRampToValueAtTime(base * (1.012 + dread * 0.026), now + 0.18);
        drone.filter.frequency.linearRampToValueAtTime(120 + dread * 280 + collapse * 90, now + 0.25);
        drone.filter.Q.linearRampToValueAtTime(6 + dread * 16, now + 0.25);
        drone.gain.gain.linearRampToValueAtTime(targetGain, now + 0.35);

        if (delay) {
            delay.delayTime.linearRampToValueAtTime(0.18 + dread * 0.22, now + 0.25);
            delayFeedback.gain.linearRampToValueAtTime(0.22 + dread * 0.34, now + 0.25);
            delayFilter.frequency.linearRampToValueAtTime(650 + collapse * 1200, now + 0.25);
        }
    }

    function ensureAudio() {
        if (audio) {
            return audio.resume();
        }

        // WebAudio has to start from a user click, so the audio graph is built
        // when the Awaken Audio button is pressed.
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        audio = new AudioContext();
        master = audio.createGain();
        compressor = audio.createDynamicsCompressor();
        analyser = audio.createAnalyser();
        delay = audio.createDelay(1.2);
        delayFeedback = audio.createGain();
        delayFilter = audio.createBiquadFilter();

        master.gain.value = 0.54;
        compressor.threshold.value = -22;
        compressor.knee.value = 18;
        compressor.ratio.value = 9;
        compressor.attack.value = 0.018;
        compressor.release.value = 0.34;
        analyser.fftSize = 512;
        delay.delayTime.value = 0.28;
        delayFeedback.gain.value = 0.36;
        delayFilter.type = "lowpass";
        delayFilter.frequency.value = 900;

        delay.connect(delayFilter);
        delayFilter.connect(delayFeedback);
        delayFeedback.connect(delay);
        delayFilter.connect(master);
        master.connect(compressor);
        compressor.connect(analyser);
        analyser.connect(audio.destination);
        return audio.resume().then(function () {
            startDrone();
        });
    }

    function triggerBody(body, distanceRatio, pan, depth) {
        if (!audio || audio.state !== "running") {
            return;
        }

        // Safety check from debugging: full collapse used to create too many
        // simultaneous oscillators. Skipping extra voices keeps the patch alive
        // instead of letting the browser audio engine get overwhelmed.
        if (activeVoices >= maxVoices) {
            return;
        }

        activeVoices += 1;
        var now = audio.currentTime;
        var closeness = 1 - distanceRatio;
        var massPresence = Math.max(0.45, Math.min(1.8, body.size / 12));

        // Closer and larger planets get longer, louder, more unstable tones.
        // This is the main link between the visual black hole metaphor and the
        // FM synthesis.
        var duration = 0.62 + body.decay + closeness * 0.82 + dread * 0.28 + massPresence * 0.12;
        var attack = 0.045 + dread * 0.075 + closeness * 0.055;
        var carrierFreq = body.carrier * (0.42 + collapse * 0.52 + closeness * 0.88);
        var modFreq = carrierFreq * body.ratio * (0.48 + dread * 0.28);
        var index = 35 + dread * 260 + closeness * 460;

        var carrier = audio.createOscillator();
        var modulator = audio.createOscillator();
        var modGain = audio.createGain();
        var amp = audio.createGain();
        var filter = audio.createBiquadFilter();
        var shaper = audio.createWaveShaper();
        var panner = audio.createPanner();
        var noise = audio.createBufferSource();
        var noiseAmp = audio.createGain();
        var noiseFilter = audio.createBiquadFilter();

        carrier.type = closeness > 0.62 ? "triangle" : "sine";
        modulator.type = "triangle";
        carrier.frequency.setValueAtTime(carrierFreq, now);
        carrier.frequency.exponentialRampToValueAtTime(Math.max(20, carrierFreq * (0.58 + closeness * 0.22)), now + duration);
        modulator.frequency.setValueAtTime(modFreq, now);
        modGain.gain.setValueAtTime(index * 0.18, now);
        modGain.gain.linearRampToValueAtTime(Math.max(1, index), now + attack);
        modGain.gain.exponentialRampToValueAtTime(1, now + duration);

        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.linearRampToValueAtTime((0.045 + closeness * 0.07 + dread * 0.022) * massPresence, now + attack);
        amp.gain.linearRampToValueAtTime(0.025 + dread * 0.018, now + duration * 0.58);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(180 + closeness * 920 + dread * 620, now);
        filter.frequency.exponentialRampToValueAtTime(80 + closeness * 420 + collapse * 360, now + duration);
        filter.Q.setValueAtTime(5 + dread * 10, now);
        shaper.curve = makeDistortionCurve(dread * 0.22 + closeness * 0.36);
        shaper.oversample = "2x";

        // The noise layer is filtered and faded so it reads as air/friction
        // around the planet instead of a sharp percussion hit.
        noise.buffer = makeNoiseBuffer(duration);
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(140 + dread * 780 + closeness * 520, now);
        noiseFilter.Q.setValueAtTime(0.7 + dread * 2.3, now);
        noiseAmp.gain.setValueAtTime(0.0001, now);
        noiseAmp.gain.linearRampToValueAtTime((0.014 + dread * 0.028 + closeness * 0.018) * massPresence, now + attack * 1.4);
        noiseAmp.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.92);

        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.maxDistance = 8;
        panner.rolloffFactor = 1.7;
        panner.coneInnerAngle = 80;
        panner.coneOuterAngle = 230;
        panner.coneOuterGain = 0.34;

        // Planet mass also changes the perceived spatial distance. Making the
        // big planets sound closer made the PannerNode effect much easier to
        // notice during testing as before you could maybe hear something in the left ear once a milliena.
        if (panner.positionX) {
            panner.positionX.setValueAtTime(Math.max(-4, Math.min(4, pan * (2.4 + planetMass * 1.4))), now);
            panner.positionY.setValueAtTime(Math.sin(body.angle) * 0.6, now);
            panner.positionZ.setValueAtTime(depth, now);
        } else {
            panner.setPosition(Math.max(-4, Math.min(4, pan * (2.4 + planetMass * 1.4))), Math.sin(body.angle) * 0.6, depth);
        }

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(filter);
        filter.connect(shaper);
        shaper.connect(amp);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseAmp);
        noiseAmp.connect(panner);
        amp.connect(panner);
        panner.connect(master);
        panner.connect(delay);

        carrier.start(now);
        modulator.start(now);
        noise.start(now);
        carrier.stop(now + duration + 0.03);
        modulator.stop(now + duration + 0.03);
        noise.stop(now + duration + 0.03);
        carrier.onended = function () {
            // When a voice finishes, free up one slot so future planets can
            // still speak. This is the other half of the audio-cutout fix.
            activeVoices = Math.max(0, activeVoices - 1);
        };

        body.glitch = 1;
        flash = Math.max(flash, closeness * 0.55 + 0.14);
        eventHorizonPulse = 1;
    }

    function drawBackground(width, height, time) {
        if (starField) {
            starField.rotation.z = time * 0.000035;
            starField.material.opacity = 0.48 + Math.sin(time * 0.0012) * 0.1;
        }
    }

    function drawSingularity(cx, cy, time) {
        var pulse = 1 + Math.sin(time * 0.004) * 0.045 + eventHorizonPulse * 0.12;
        var horizon = 78 + collapse * 70;
        singularity.scale.setScalar((horizon * 0.72 * pulse) / 58);
        singularityGlow.scale.setScalar((horizon * 2.15 * pulse) / 118);
        singularityGlow.material.opacity = 0.16 + eventHorizonPulse * 0.16 + collapse * 0.06;
        horizonRing.scale.set(horizon * pulse, horizon * pulse, 1);
        horizonRing.rotation.z = time * 0.0003;
    }

    function drawBody(body, cx, cy, dt, width, height) {
        var sink = collapse * collapse * 115;
        var wobble = Math.sin(performance.now() * 0.0012 + body.id) * dread * 22;
        var radius = Math.max(54, body.baseRadius - sink + wobble);
        var speedBoost = 1 + collapse * 2.8 + dread * 0.7 + (1 - radius / Math.max(width, height)) * 0.8;
        body.angle += body.speed * speedBoost * dt;
        body.radius = radius;

        var x = Math.cos(body.angle) * radius;
        var y = Math.sin(body.angle) * radius * 0.62;
        var distanceRatio = Math.max(0, Math.min(1, radius / 420));
        var pan = x / Math.max(1, width * 0.36);

        body.orbitLine.scale.set(radius, radius * 0.62, 1);
        body.orbitLine.rotation.z = Math.sin(performance.now() * 0.0002 + body.id) * 0.04;
        body.mesh.position.set(x, y, Math.sin(body.angle) * 90);

        // Audio triggering is based on elapsed time, not orbit speed. This was
        // changed during debugging because max collapse made the visuals spin
        // fast enough to overload the sound engine.
        body.triggerClock += dt;
        if (body.triggerClock >= body.triggerInterval) {
            var massDepth = 1.9 - Math.max(0.45, Math.min(1.8, body.size / 12));
            var depth = Math.sin(body.angle) > 0 ? -1.4 - dread * 1.4 - massDepth : 0.35 + collapse * 1.4 + massDepth;
            triggerBody(body, distanceRatio, pan, depth);
            body.triggerClock = 0;
            body.triggerInterval = randomBetween(0.85, 2.1) * (1 - collapse * 0.22);
        }

        body.glitch *= 0.86;
        var bodySize = body.size + body.glitch * 9 + (1 - distanceRatio) * 5;
        var meshScale = bodySize / Math.max(1, body.size);
        body.mesh.scale.setScalar(meshScale);
        body.mesh.rotation.x += dt * (0.8 + dread);
        body.mesh.rotation.y += dt * (1.1 + collapse);
        body.mesh.material.emissiveIntensity = 1.2 + body.glitch * 2.6 + (1 - distanceRatio) * 0.8;
    }

    function animate(now) {
        var dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;

        var width = canvas.clientWidth;
        var height = canvas.clientHeight;
        var cx = 0;
        var cy = 0;

        drawBackground(width, height, now);
        drawSingularity(cx, cy, now);
        bodies.forEach(function (body) {
            drawBody(body, cx, cy, dt, width, height);
        });

        if (flash > 0.01) {
            scene.background = new THREE.Color().setRGB(0.018 + flash * 0.08, 0.016 + flash * 0.06, 0.026 + flash * 0.1);
            flash *= 0.82;
        } else {
            scene.background = new THREE.Color(0x050506);
        }
        eventHorizonPulse *= 0.88;
        renderer.render(scene, camera);

        window.requestAnimationFrame(animate);
    }

    startButton.addEventListener("click", function () {
        ensureAudio().then(function () {
            startButton.textContent = "Audio Live";
        });
    });

    randomizeButton.addEventListener("click", function () {
        updateReadouts();
        makeStars();
        seedBodies();
    });

    panicButton.addEventListener("click", function () {
        collapseSlider.value = 100;
        dreadSlider.value = 100;
        massSlider.value = 180;
        updateReadouts();
        seedBodies();
    });

    [collapseSlider, dreadSlider, densitySlider, massSlider].forEach(function (slider) {
        slider.addEventListener("input", function () {
            var oldDensity = density;
            var oldMass = planetMass;
            updateReadouts();
            if (density !== oldDensity || planetMass !== oldMass) {
                seedBodies();
            }
            updateDrone();
        });
    });

    window.addEventListener("resize", resizeCanvas);
    setupThree();
    resizeCanvas();
    makeStars();
    updateReadouts();
    seedBodies();
    window.requestAnimationFrame(animate);
}());

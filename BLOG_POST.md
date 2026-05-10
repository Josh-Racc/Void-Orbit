# Void Orbit: Building a Cosmic Horror Sequencer with WebAudio

Void Orbit is an interactive WebAudio instrument built around the image of a collapsing orbital system. The screen shows a Three.js black hole surrounded by moving 3D planets, but the planets are not just visual decoration. Each one acts like a sequencer voice. As the bodies orbit the singularity, they trigger sounds whose character depends on their distance from the center, their size, and the current state of the system. The result is meant to feel less like a traditional beat machine and more like listening to an unstable astronomical machine slowly lose control.

The original idea started as a geometric orbit sequencer, where orbiting objects would trigger musical events. I shifted the concept toward cosmic horror because WebAudio synthesis can naturally produce strange, unstable, metallic, and noisy sounds. Instead of fighting those qualities, I wanted to make them part of the aesthetic. The black hole became a useful metaphor for connecting visual motion to sound design: when planets move closer to the center, the sound becomes denser, darker, and more unstable.

## Interface and Interaction

The interface is intentionally simple. The user sees the orbiting bodies, the central void, and a small control panel. The visual layer uses Three.js: the planets are sphere meshes, the orbit paths are line loops, the stars are a point cloud, and the singularity is a black sphere with a purple additive glow. The main controls are Collapse, Dread, Orbit density, Planet mass, Re-seed System, and Total Collapse.

Collapse changes how close the orbital system feels to falling inward. Visually, higher collapse pulls the bodies closer to the center and makes the system move more aggressively. Sonically, it changes the base pitch behavior, timing, drone pressure, and filtering. Dread controls how harsh and unstable the sound is. Orbit density changes how many bodies are active. Planet mass changes the size of the planets and also affects how close they sound in the spatial audio field. Re-seed System generates a new version of the orbiting system using the current slider values, so the same settings can produce different patterns.

I removed the original page navigation and bottom explanatory text so the project feels more like a self-contained instrument than a normal website. The first screen is the piece itself.

## FM Synthesis as the Core Sound

The main synthesis idea is frequency modulation, or FM synthesis. Each triggered planet creates a short FM voice. One oscillator acts as the carrier, and another oscillator acts as the modulator. The modulator is connected to the carrier frequency through a GainNode, which controls the modulation depth.

I used non-integer frequency ratios for the FM voices, such as 1.414, 1.618, 2.17, and 2.71. Integer ratios tend to sound more harmonic and instrument-like, while these ratios create less stable tones. That instability fits the project better because the goal is not to make clean melodies. The goal is to create metallic, uneasy, shifting sounds that feel connected to a horror environment.

The modulation index changes based on how close a planet is to the singularity. A planet that is farther away produces a more restrained tone, while a planet closer to the center gets a stronger modulation index and a more unstable sound. This makes the visual metaphor directly affect the DSP. The black hole is not only something on screen; it changes the synthesis patch.

## Envelopes, Noise, and the Pool Ball Problem

One of the first issues I ran into was that the sound was too clicky. The short triggered notes started to sound like pool balls hitting each other. That was not the texture I wanted. The project needed to sound like pressure, friction, and distant machinery rather than hard objects colliding.

To fix this, I changed the envelopes. Instead of extremely short attacks and releases, the voices now have slower attacks and longer decays. The amplitude envelope swells in slightly instead of snapping on immediately. I also changed the filtering from a sharp bandpass-focused sound to a darker lowpass shape, which removed some of the hard transient quality.

I added a short filtered noise buffer to each planet voice. The noise fades out over the duration of the sound and passes through a filter before reaching the panner. This gives each trigger a breathy or friction-like quality. It is not meant to sound like a drum hit; it is meant to sound like something moving through an unstable field.

There is also a continuous low drone underneath the orbiting voices. The drone uses two low oscillators that are slightly detuned from each other, then filtered and mixed quietly under the rest of the patch. This gives the piece a constant sense of pressure. Without the drone, the planet sounds felt too isolated. With it, the system feels more like one connected environment.

## Spatial Audio with PannerNode

The main technique I explored beyond the class material was spatial audio using PannerNode. Each planet sound is sent through a PannerNode before reaching the master output. The panner uses HRTF-style positioning, and the sound source is placed based on the planet's visual position.

At first, the panning was technically working but not very obvious. It was easy to miss unless a sound happened far to one side. To make the spatial audio clearer, I added the Planet mass control. Larger planets now look bigger and sound closer, while smaller planets feel farther away. This makes the connection between the visual object and the perceived sound position easier to notice.

The PannerNode position uses the planet's horizontal location for left-right movement, and a depth value to create a front/back sense of space. Larger planets use a more noticeable spatial position and louder presence, so the user can hear the difference when changing planet mass. This made the spatial audio feel like part of the instrument rather than just an invisible technical feature.

## Re-seeding the System

The Re-seed System button creates a new set of orbiting bodies. Each new planet gets a randomized orbit radius, speed, FM ratio, size, color, trigger timing, and carrier frequency. The important detail is that re-seeding uses the current slider settings. If Collapse is high when the user re-seeds, the new system is generated as a more collapsed system from the start. If Planet mass is high, the new planets are generated larger and sound closer.

This makes re-seeding feel like changing the state of the simulation rather than just randomizing decoration. The user can set the conditions of the black hole system, then generate a new version of it.

## Debugging the Audio Cutout

One bug showed up when Collapse was set to the maximum value. The visuals became intense, which was good, but the audio eventually stopped playing until the page was refreshed. The cause was that the original trigger logic was tied too closely to orbit speed. At high collapse, the planets moved so quickly that they triggered too many overlapping WebAudio nodes.

The fix was to separate visual speed from audio trigger timing. The planets can still spin quickly on screen, but the audio now triggers based on elapsed time rather than angular speed. I also added an active voice counter with a maximum voice limit. If too many sounds are already playing, the system skips extra triggers until some voices finish.

This was an important design lesson. The most dramatic visual state should not be allowed to break the audio engine. The final version keeps the feeling of collapse while preventing the browser from being overwhelmed by too many oscillators, noise buffers, filters, panners, and delay sends at once.

## Effects and Signal Flow

Each planet voice uses a small WebAudio graph. The FM carrier passes through a filter, a waveshaper, an amplitude envelope, and then a PannerNode. The filtered noise layer also goes into the panner. From there, the signal goes to the master output and also into a delay line.

The delay is filtered and fed back into itself to create a smeared tail. This helps the sounds feel like they are hanging in space rather than appearing and disappearing instantly. The master output runs through a compressor to keep the full patch under control, especially when multiple planets are active.

The main signal flow is:

```text
Modulator Oscillator -> Modulation Gain -> Carrier Frequency
Carrier Oscillator -> Filter -> Waveshaper -> Amplitude Envelope -> PannerNode
Noise Buffer -> Noise Filter -> Noise Envelope -> PannerNode
PannerNode -> Master / Delay
Delay -> Filter -> Feedback -> Delay
Master -> Compressor -> Destination
```

## Connecting the Visuals and Sound

The most important design choice in Void Orbit is that the visuals and sound are controlled by the same system. Distance from the center affects FM intensity and filtering. Planet mass affects the Three.js sphere scale and the spatial audio distance. Collapse affects orbit behavior, drone pressure, and timing. Dread affects harshness, filter resonance, and delay behavior.

This makes the project feel like one audiovisual instrument rather than a canvas animation with sound effects attached. The user can understand the sound through the image, and the image feels more meaningful because it has audible consequences.

## Conclusion

Void Orbit combines FM synthesis, WebAudio modulation techniques, spatial audio, Three.js visuals, and procedural motion into an interactive horror sequencer. The class concept at the center of the project is FM synthesis. The low-level WebAudio technique is using GainNodes to control modulation depth and envelopes. The new technique I explored independently is PannerNode spatial audio, especially connecting apparent distance to planet mass.

The final piece is not meant to produce a polished song in the traditional sense. It is closer to a sound toy, simulation, and audiovisual performance system. The user shapes the conditions of a collapsing orbit, then listens to the system respond. My favorite part of the project is that the strange sounds are not treated as mistakes. The instability is the point. It reminded me of a mix of Alien isolation and Dead Space, my favorite horror games so, that was the inspiration.

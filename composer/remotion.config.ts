import { Config } from "@remotion/cli/config";

// Required for WebGL/WebGPU (Three.js effects layer, M2) to render headlessly.
Config.setChromiumOpenGlRenderer("angle");

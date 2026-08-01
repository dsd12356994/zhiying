import * as THREE from "three";

// new THREE.Color(hexString) runs the value through three.js's automatic
// sRGB->linear decode (ColorManagement is on by default). That's correct for
// materials three.js re-encodes on output (MeshStandardMaterial etc), but a
// raw ShaderMaterial writes gl_FragColor straight to the framebuffer with no
// re-encoding -- so that decode just makes everything render far too dark.
// Parse the hex ourselves and use the numeric constructor, which stores the
// values as given with no conversion.
export const hexToThreeColor = (hex: string): THREE.Color => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return new THREE.Color(r, g, b);
};

// GLSL for the SDF dog. The distance functions mirror sdf-math.ts (the tested CPU reference).
//
// How it draws: a flat quad is placed over the dog. For every pixel of that quad we shoot a ray
// straight into the screen (orthographic camera) and "march" along it: ask the SDF "how far am I
// from the dog?", step forward by that distance, repeat until we touch the surface or give up.
// All shapes are blended with a smooth-min so they melt together like clay.

export const MAX_SHAPES = 32

export const SDF_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const SDF_FRAG = /* glsl */ `
#define MAX_SHAPES ${MAX_SHAPES}

uniform int uCount;
uniform float uKind[MAX_SHAPES];     // 0 sphere, 1 capsule, 2 ellipsoid, 3 roundCone
uniform vec3 uParams[MAX_SHAPES];    // shape sizes (see dog-file.ts), zero padded
uniform float uBlend[MAX_SHAPES];    // smooth-min radius with the rest of the body
uniform vec3 uColor[MAX_SHAPES];     // linear RGB
uniform mat4 uInv[MAX_SHAPES];       // world -> shape-local
uniform mat4 uViewProj;              // for writing a correct depth
uniform float uPixel;                // one device pixel in world units

varying vec3 vWorld;

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdShape(int i, vec3 p) {
  vec3 q = (uInv[i] * vec4(p, 1.0)).xyz;
  float kind = uKind[i];
  vec3 a = uParams[i];
  if (kind < 0.5) {
    return length(q) - a.x;                                   // sphere [r]
  }
  if (kind < 1.5) {
    float x = clamp(q.x, -a.y, a.y);                          // capsule [r, halfLength]
    return length(vec3(q.x - x, q.y, q.z)) - a.x;
  }
  if (kind < 2.5) {
    float k0 = length(q / a);                                 // ellipsoid [rx, ry, rz]
    float k1 = length(q / (a * a));
    if (k1 < 1e-6) return -min(a.x, min(a.y, a.z));
    return k0 * (k0 - 1.0) / k1;
  }
  float b = (a.x - a.y) / a.z;                                // roundCone [rA, rB, length]
  float c = sqrt(1.0 - b * b);
  float rho = length(q.yz);
  float k = -rho * b + q.x * c;
  if (k < 0.0) return length(vec2(rho, q.x)) - a.x;
  if (k > c * a.z) return length(vec2(rho, q.x - a.z)) - a.y;
  return rho * c + q.x * b - a.x;
}

float map(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uCount) break;
    float di = sdShape(i, p);
    d = (i == 0) ? di : smin(d, di, uBlend[i]);
  }
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.5;
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

void main() {
  // One ray per pixel, starting in front of the dog and pointing into the screen.
  vec3 ro = vec3(vWorld.xy, 150.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);

  float t = 0.0;
  float dMin = 1e5;
  float tMin = 0.0;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    float d = map(ro + rd * t);
    if (d < dMin) { dMin = d; tMin = t; }
    if (d < 0.02) { hit = true; tMin = t; break; }
    t += max(d, 0.05);
    if (t > 300.0) break;
  }

  // Edge anti-aliasing: a ray that just misses the dog still covers part of the pixel.
  float cover = hit ? 1.0 : clamp(0.5 - dMin / uPixel, 0.0, 1.0);
  if (cover <= 0.0) discard;

  vec3 p = ro + rd * tMin;
  vec3 n = calcNormal(p);

  // Colour: each shape votes for its colour, weighted by how close the surface is to it.
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uCount) break;
    // Soft-blended shapes (big blend) mix colours softly; hard small shapes (eyes, nose) stay crisp.
    float w = exp(-max(sdShape(i, p), 0.0) / (0.5 + 0.2 * uBlend[i]));
    col += uColor[i] * w;
    wsum += w;
  }
  col /= max(wsum, 1e-4);

  // Ambient occlusion: darken creases (under the chin, between the legs) by sampling the SDF
  // a little way out along the normal.
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 1.5 * float(i);
    occ += (h - map(p + n * h)) * sca;
    sca *= 0.7;
  }
  float ao = clamp(1.0 - 0.06 * occ, 0.0, 1.0);

  // Lighting. World y points DOWN, so "up" is -y. Key light: warm, upper-left, in front.
  vec3 L = normalize(vec3(-0.5, -0.8, 0.7));
  float wrap = clamp((dot(n, L) + 0.35) / 1.35, 0.0, 1.0);
  float key = wrap * wrap * (3.0 - 2.0 * wrap);
  vec3 keyCol = vec3(1.0, 0.94, 0.84) * 1.15;

  // Fill light: cool, from the other side, so the shadow side is not dead black.
  float fill = clamp(dot(n, normalize(vec3(0.7, -0.1, 0.5))) * 0.5 + 0.5, 0.0, 1.0);
  vec3 fillCol = vec3(0.45, 0.55, 0.78) * 0.45;

  // Sky/ground ambient.
  float sky = clamp(-n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(vec3(0.20, 0.17, 0.15), vec3(0.42, 0.46, 0.55), sky) * 0.55;

  vec3 lit = col * (keyCol * key + fillCol * fill + amb) * ao;

  // Rim light: a bright edge where the surface turns away from the viewer.
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
  lit += vec3(1.0, 0.92, 0.82) * rim * 0.35 * ao;

  // Soft sheen so a black coat still shows its form.
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  lit += vec3(1.0, 0.95, 0.9) * pow(max(dot(n, hv), 0.0), 22.0) * 0.16 * ao;

  gl_FragColor = vec4(lit, cover);
  #include <colorspace_fragment>

  // Write depth so other things (and later the fur splats) sort correctly against the dog.
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
}
`

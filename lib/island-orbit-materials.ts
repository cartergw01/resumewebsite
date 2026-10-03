import { MeshStandardMaterial } from "three";

// Fine grain complements the Blender-baked color. It is evaluated in the
// island's coordinates, so wood and stone stay attached while the camera turns.
const noise = `
varying vec3 vIslandSurface;
float islandHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float islandNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(islandHash(i), islandHash(i+vec3(1,0,0)), f.x),
                 mix(islandHash(i+vec3(0,1,0)), islandHash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(islandHash(i+vec3(0,0,1)), islandHash(i+vec3(1,0,1)), f.x),
                 mix(islandHash(i+vec3(0,1,1)), islandHash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export function addIslandGrain(material: MeshStandardMaterial) {
  const wood = /walnut|oak|wood|timber/i.test(material.name);
  const stone = /shale|mineral|limestone|humus|earth|plaster/i.test(material.name);
  if (!wood && !stone) return;
  material.customProgramCacheKey = () => wood ? "island-wood-v1" : "island-stone-v1";
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vIslandSurface;\n${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nvIslandSurface = position;");
    shader.fragmentShader = noise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      float grain = islandNoise(vIslandSurface * ${wood ? "vec3(0.9, 40.0, 40.0)" : "vec3(25.0)"});
      float fineGrain = islandNoise(vIslandSurface * ${wood ? "vec3(2.0, 100.0, 100.0)" : "vec3(80.0)"});
      diffuseColor.rgb *= mix(${wood ? "0.66, 1.23" : "0.8, 1.17"}, grain) * mix(0.92, 1.05, fineGrain);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      float relief = grain * ${wood ? "0.003" : "0.009"};
      vec3 grainX = dFdx(-vViewPosition), grainY = dFdy(-vViewPosition);
      vec3 rX = cross(grainY, normal), rY = cross(normal, grainX);
      float det = dot(grainX, rX);
      normal = normalize(abs(det) * normal - sign(det) * (dFdx(relief) * rX + dFdy(relief) * rY));
    `);
  };
}

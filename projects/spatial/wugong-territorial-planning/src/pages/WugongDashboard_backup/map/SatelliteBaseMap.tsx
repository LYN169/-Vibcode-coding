import { useEffect, useState } from "react";
import { TextureLoader, type Texture } from "three";
import { projectCoord } from "@/utils/projection";

interface Props {
  projection: ReturnType<typeof import("d3-geo").geoMercator>;
  opacity?: number;
  visible?: boolean;
  z?: number;
}

interface Bounds { minLon: number; minLat: number; maxLon: number; maxLat: number; }

let cachedTexture: Texture | null = null;
let cachedBounds: Bounds | null = null;

const TEXTURE_PATHS = [
  "/sc-datav/textures/satellite_wugong.png",
  "/sc-datav/textures/satellite_wugong.jpg",
  "/sc-datav/textures/satellite_wugong.webp",
];

export default function SatelliteBaseMap({ projection, opacity = 0.85, visible = true, z = 0 }: Props) {
  const [tex, setTex] = useState<Texture | null>(cachedTexture);
  const [bounds, setBounds] = useState<Bounds | null>(cachedBounds);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (cachedBounds && cachedTexture) return;
    import("../../../../public/textures/satellite_bounds.json")
      .then((m) => { const b = (m.default ?? m) as Bounds; cachedBounds = b; setBounds(b); })
      .catch(() => { console.warn("[Satellite] bounds.json not found — disabled"); setMissing(true); });

    // Try loading textures in priority order
    let attemptIdx = 0;
    const tryNext = () => {
      if (attemptIdx >= TEXTURE_PATHS.length) {
        console.warn("[Satellite] all texture paths failed — disabled");
        setMissing(true);
        return;
      }
      const path = TEXTURE_PATHS[attemptIdx++];
      new TextureLoader().load(
        path,
        (t) => { cachedTexture = t; setTex(t); console.log("[Satellite] loaded:", path); },
        undefined,
        () => { console.warn(`[Satellite] ${path} not found`); tryNext(); },
      );
    };
    tryNext();
  }, []);

  if (!visible || missing || !bounds || !tex) return null;

  const bl = projectCoord(projection, [bounds.minLon, bounds.minLat]);
  const tr = projectCoord(projection, [bounds.maxLon, bounds.maxLat]);
  const w = tr.x - bl.x;
  const h = tr.y - bl.y;
  const cx = (bl.x + tr.x) / 2;
  const cy = (bl.y + tr.y) / 2;

  return (
    <mesh position={[cx, cy, z]} renderOrder={-10}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

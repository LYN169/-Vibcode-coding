import { useEffect, useState } from "react";
import { TextureLoader, type Texture } from "three";
import { projectCoord } from "@/utils/projection";

interface Props {
  projection: ReturnType<typeof import("d3-geo").geoMercator>;
  opacity?: number;
  visible?: boolean;
}

interface Bounds { minLon: number; minLat: number; maxLon: number; maxLat: number; }

let cachedTexture: Texture | null = null;
let cachedBounds: Bounds | null = null;

export default function SatelliteBaseMap({ projection, opacity = 0.85, visible = true }: Props) {
  const [tex, setTex] = useState<Texture | null>(cachedTexture);
  const [bounds, setBounds] = useState<Bounds | null>(cachedBounds);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (cachedBounds && cachedTexture) return;
    fetch("/sc-datav/textures/satellite_bounds.json")
      .then((r) => r.json())
      .then((b: Bounds) => { cachedBounds = b; setBounds(b); })
      .catch(() => { console.warn("[Satellite] bounds.json not found — disabled"); setMissing(true); });
    new TextureLoader().load(
      "/sc-datav/textures/satellite_wugong.png",
      (t) => { cachedTexture = t; setTex(t); },
      undefined,
      () => { console.warn("[Satellite] satellite_wugong.png not found — disabled"); setMissing(true); },
    );
  }, []);

  // Never render a fallback plane — only render when texture is loaded
  if (!visible || missing || !bounds || !tex) return null;

  const bl = projectCoord(projection, [bounds.minLon, bounds.minLat]);
  const tr = projectCoord(projection, [bounds.maxLon, bounds.maxLat]);
  const w = tr.x - bl.x;
  const h = tr.y - bl.y;
  const cx = (bl.x + tr.x) / 2;
  const cy = (bl.y + tr.y) / 2;

  return (
    <mesh position={[cx, cy, -10]} renderOrder={-10}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

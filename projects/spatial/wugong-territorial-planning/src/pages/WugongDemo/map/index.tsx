import styled from "styled-components";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import Lights from "./lights";
import Scene, { type WugongData } from "./scene";

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

export default function Index({ onDataLoad }: { onDataLoad?: (d: WugongData) => void }) {
  return (
    <CanvasWrapper>
      <Canvas
        flat
        shadows
        camera={{ position: [-50, 125, 250], fov: 50, far: 10000, near: 1 }}
        dpr={[1, 2]}>
        <color attach="background" args={["#fff5e8"]} />
        <Lights />

        <Scene onDataLoad={onDataLoad} />

        <ContactShadows opacity={0.5} scale={300} blur={0.5} resolution={256} color="#000000" />
        <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.3} minDistance={10} maxDistance={3000} maxPolarAngle={1.5} />
      </Canvas>
    </CanvasWrapper>
  );
}

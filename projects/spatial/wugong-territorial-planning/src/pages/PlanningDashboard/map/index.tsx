import styled from "styled-components";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import Lights from "@/pages/Demo1/map/lights";
import PlanningLayers from "./layers";

const CanvasWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

export default function Map() {
  return (
    <CanvasWrapper>
      <Canvas
        flat
        shadows
        camera={{ position: [-50, 125, 250], fov: 50, far: 2000, near: 1 }}
        dpr={[1, 2]}>
        <color attach="background" args={["#fff5e8"]} />
        <Lights />
        <PlanningLayers />
        <ContactShadows opacity={0.5} scale={300} blur={0.5} resolution={256} color="#000000" />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          zoomSpeed={0.3}
          minDistance={100}
          maxDistance={300}
          maxPolarAngle={1.5}
        />
      </Canvas>
    </CanvasWrapper>
  );
}

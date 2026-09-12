import { useEffect } from "react";
import styled from "styled-components";
import { usePlanningStore } from "./stores";
import Panel from "./panel";
import Map from "./map";

const Wrapper = styled.div` position: relative; width: 100vw; height: 100vh; `;

export default function PlanningDashboard() {
  useEffect(() => { return usePlanningStore.getState().reset(); }, []);
  return (
    <Wrapper>
      <Map />
      <Panel />
    </Wrapper>
  );
}

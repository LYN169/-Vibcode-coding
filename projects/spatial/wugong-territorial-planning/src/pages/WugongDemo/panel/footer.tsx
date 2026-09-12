import type { ComponentProps } from "react";
import styled from "styled-components";
import { useConfigStore } from "../stores";

const Wrapper = styled.div`
  position: absolute; bottom: 0; height: 100px; width: 100%;
`;
const Buttons = styled.div`
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 320px; height: 80px; display: flex; justify-content: center;
  align-items: flex-end; gap: 30px; z-index: 10; padding-bottom: 20px;
`;
const Button = styled.button<{ $active?: boolean }>`
  pointer-events: auto; position: relative;
  background: rgba(255,255,255,0.9); border: 1px solid rgba(234,88,12,0.2);
  color: #d35400; width: 50px; height: 50px; border-radius: 12px;
  display: flex; justify-content: center; align-items: center; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1); overflow: hidden;
  &::before { content:""; position:absolute; top:0; left:0; width:100%; height:100%;
    background: linear-gradient(135deg, rgba(234,88,12,0.1) 0%, transparent 100%);
    opacity:0; transition: opacity 0.3s; }
  &:hover { transform: translateY(-5px) scale(1.1); border-color: #ff6715;
    box-shadow: 0 0 15px rgba(255,103,21,0.4); color: #ff6715; }
  &:hover::before { opacity:1; }
  ${(p) => p.$active && `
    width:60px; height:60px; background: linear-gradient(135deg, #ff6715 0%, #ff8c00 100%);
    color: white !important; border: none; box-shadow: 0 4px 15px rgba(255,103,21,0.5);
    margin-bottom: 5px;`}
`;

const Bg = () => (
  <svg viewBox="0 0 1920 100" preserveAspectRatio="none" width="100%" height="100%">
    <defs>
      <linearGradient id="grad-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fff5e8" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#fff5e8" stopOpacity="1" />
      </linearGradient>
    </defs>
    <path d="M0,100 H1920 V100 Q1720,100 1580,100 Q1370,72 1210,46 Q960,6 710,46 Q550,72 340,100 Q200,100 0,100 Z" fill="url(#grad-bottom)" />
    <path d="M0,100 Q200,100 340,100 Q550,72 710,46 Q960,6 1210,46 Q1370,72 1580,100 Q1720,100 1920,100" fill="none" stroke="#ff6715" strokeWidth="1" strokeOpacity="0.4" />
    <path d="M710,46 Q960,6 1210,46" fill="none" stroke="#ff6715" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Footer({ sidePanelsCollapsed }: ComponentProps<typeof Wrapper> & { sidePanelsCollapsed?: boolean }) {
  const handleTogglePanels = () => (window as any).__toggleSidePanels?.();
  const { cloud, rotation, toggle } = useConfigStore();

  return (
    <Wrapper>
      <Bg />
      <Buttons>
        {/* Icon 1: cloud / visual effects */}
        <Button $active={cloud} onClick={() => toggle("cloud")}>
          <svg fill="currentColor" viewBox="0 0 1024 1024" width="24" height="24">
            <path d="M746.667 725.333c59.733-12.8 106.667-64 106.667-128 0-72.533-55.467-128-128-128-17.067 0-29.867 4.267-42.667 8.533V469.333c0-93.867-76.8-170.667-170.667-170.667s-170.667 76.8-170.667 170.667c0 17.067 4.267 29.867 4.267 46.933-8.533-4.267-17.067-4.267-25.6-4.267C260.267 512 213.333 558.933 213.333 618.667S260.267 725.333 320 725.333h426.667zm0 85.334h-426.667C213.333 810.667 128 725.333 128 618.667c0-85.333 55.467-157.867 128-183.467C273.067 311.467 379.733 213.333 512 213.333c110.933 0 209.067 72.533 243.2 170.667 102.4 12.8 183.467 102.4 183.467 213.333s-85.333 200.533-192 213.334z"/>
          </svg>
        </Button>

        {/* Icon 2: map reset / rotation */}
        <Button $active={rotation} onClick={() => { toggle("rotation"); (window as any).__wugongResetView?.(); }}>
          <svg fill="currentColor" viewBox="0 0 1024 1024" width="24" height="24">
            <path d="M492.416 658.176L230.827 504.32V196.565L492.373 42.667l261.589 153.899v307.754l-261.589 153.856zm200.064-184.661V276.565l-169.301 103.296v197.888l169.301-104.235zm-400.128 0l169.301 104.192V370.816L292.352 269.355v204.16zm200.064-369.28L316.672 212.352l179.2 107.307h6.912l170.624-104.149-180.992-111.275zM569.344 858.24L430.848 981.333v-96.213C194.901 864.299 0 750.208 0 612.053c0-62.251 36.949-119.467 98.389-165.632l40.533 42.667c-48.64 34.859-77.355 77.184-77.355 122.923 0 105.813 167.424 193.365 369.28 211.541V735.147l138.496 123.093zM646.315 813.056c161.835-30.976 276.949-109.227 276.949-201.045 0-51.2-35.883-98.219-95.616-135.168l42.453-42.453c71.552 48.128 114.731 110.037 114.731 177.621 0 122.709-142.037 226.645-338.517 262.997v-61.952z"/>
          </svg>
        </Button>

        {/* Icon 3: map focus / hide panels */}
        <Button $active={!!sidePanelsCollapsed} onClick={handleTogglePanels}>
          <svg fill="currentColor" viewBox="0 0 1024 1024" width="24" height="24">
            <path d="M874.667 21.333l47.509 101.824L1024 170.667l-101.824 47.509L874.667 320l-47.509-101.824L725.333 170.667l101.824-47.509zM512 21.333l156.139 334.528L1002.667 512l-334.528 156.139L512 1002.667l-156.139-334.528L21.333 512l334.528-156.139L512 21.333zm107.968 382.699L512 172.651l-107.968 231.381L172.651 512l231.381 107.968 107.946 231.36 107.989-231.36L851.328 512l-231.36-107.946z"/>
          </svg>
        </Button>
      </Buttons>
    </Wrapper>
  );
}

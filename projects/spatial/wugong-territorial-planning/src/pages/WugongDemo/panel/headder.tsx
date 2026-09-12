import type { ComponentProps } from "react";
import styled from "styled-components";

const TitleWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
`;

const Title = styled.div`
  font-size: 36px;
  letter-spacing: 8px;
  color: #fff;
  text-shadow: 0 8px 10px rgba(255, 145, 0, 0.8);
  font-weight: 700;
  background: linear-gradient(to bottom, #ea580c, #ff9100);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;

  &::after {
    content: "SICHUAN SMART BRAIN";
    display: block;
    font-size: 12px;
    letter-spacing: 12px;
    text-align: center;
    color: rgba(255, 145, 0, 0.6);
    margin-top: -5px;
    -webkit-text-fill-color: rgba(255, 145, 0, 0.6);
  }
`;

const Bg = styled.svg.attrs({
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 1920 82",
  width: "100%",
  height: "100%",
  preserveAspectRatio: "none",
  children: (
    <>
      <defs>
        <radialGradient
          id="radialGradient"
          cx="50%"
          cy="50%"
          fx="100%"
          fy="50%"
          r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1"></stop>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"></stop>
        </radialGradient>
        <mask id="svgline-1">
          <circle r="100" cx="0" cy="0" fill="url(#radialGradient)">
            <animateMotion
              begin="0s"
              dur="3s"
              path="M0,60 L620,60 L670,80 L960,80"
              rotate="auto"
              keyPoints="0;1"
              keyTimes="0;1"
              repeatCount="indefinite"></animateMotion>
          </circle>
        </mask>
        <mask id="svgline-2">
          <circle r="100" cx="0" cy="0" fill="url(#radialGradient)">
            <animateMotion
              begin="0s"
              dur="3s"
              path="M1920,60 L1300,60 L1250,80 L960,80"
              rotate="auto"
              keyPoints="0;1"
              keyTimes="0;1"
              repeatCount="indefinite"></animateMotion>
          </circle>
        </mask>
      </defs>

      <path
        d="M0,0 L1920,0 L1920,60 L1300,60 L1250,80 L670,80 L620,60 L0,60 Z"
        fill="rgb(255, 245, 232)"
      />

      <path
        d="M0,60 L620,60 L670,80 L1250,80 L1300,60 L1920,60"
        fill="none"
        stroke="rgb(234, 88, 12)"
        strokeWidth="1"
      />

      <path
        d="M0,60 L620,60 L670,80 L960,80"
        fill="none"
        stroke="#ff6715"
        strokeWidth="4"
        mask="url(#svgline-1)"
      />

      <path
        d="M1920,60 L1300,60 L1250,80 L960,80"
        fill="none"
        stroke="#ff6715"
        strokeWidth="4"
        mask="url(#svgline-2)"
      />
    </>
  ),
})`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
`;

export default function Headder({ title, sub, ...props }: ComponentProps<typeof TitleWrapper> & { title?: string; sub?: string }) {
  return (
    <TitleWrapper {...props as any}>
      <Bg />
      <div style={{ textAlign: "center" }}>
        <Title>{title ?? "武功镇国土空间规划（2026—2040）"}</Title>
        {sub && <div style={{ fontSize: 12, letterSpacing: 8, color: "rgba(255,145,0,0.5)", marginTop: -2 }}>{sub}</div>}
      </div>
    </TitleWrapper>
  );
}

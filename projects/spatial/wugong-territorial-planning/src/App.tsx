import { lazy, useLayoutEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router";
import { gsap } from "gsap";
import Demo0 from "./pages/Demo0";
import Demo1 from "./pages/Demo1";
import Demo2 from "./pages/Demo2";
import Demo3 from "./pages/Demo3";
import PlanningDashboardPage from "./pages/PlanningDashboard";
import TourismDashboardPage from "./pages/TourismDashboard";
import WugongDashboardPage from "./pages/WugongDemo";

const Index = lazy(() => import("./pages/Index/index"));

function App() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.6, ease: "power3.out" }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [location.key]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", willChange: "transform, opacity" }}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/demo0" element={<Demo0 />} />
        <Route path="/demo1" element={<Demo1 />} />
        <Route path="/demo2" element={<Demo2 />} />
        <Route path="/demo3" element={<Demo3 />} />
        <Route path="/wugong" element={<WugongDashboardPage />} />
        <Route path="/planning" element={<PlanningDashboardPage />} />
        <Route path="/tourism" element={<TourismDashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;

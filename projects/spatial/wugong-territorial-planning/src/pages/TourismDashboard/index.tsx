import { lazy, Suspense } from "react";
const Demo = lazy(() => import("./demo"));
export default function Index() {
  return (
    <Suspense fallback={<div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: 18 }}>加载农文旅展示页...</div>}>
      <Demo />
    </Suspense>
  );
}

"use client";

import dynamic from "next/dynamic";

const ChessApp = dynamic(() => import("@/components/ChessApp"), {
  ssr: false,
  loading: () => (
    <div className="app-loading">
      <div className="spinner" />
      <span>Preparing the 3D board…</span>
    </div>
  ),
});

export default function Page() {
  return <ChessApp />;
}

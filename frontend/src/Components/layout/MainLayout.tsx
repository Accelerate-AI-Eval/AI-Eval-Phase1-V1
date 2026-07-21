// import React from "react";
import { useEffect } from "react";
import TopNavBar from "./TopNavBar";
import SideNavBar from "./SideNavBar";
import { Outlet } from "react-router-dom";
import "../../styles/layout/layout.css";
import "../../styles/card.css";
import { fetchLlmModelConfig } from "../../utils/llmModelApi";

function isSystemAdminRole(): boolean {
  const systemRole = (sessionStorage.getItem("systemRole") ?? "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ");
  return systemRole === "system admin";
}

const MainLayout = () => {
  // Prime active LLM store so Controls → Apply updates are visible app-wide without refresh.
  useEffect(() => {
    if (!isSystemAdminRole()) return;
    if (!sessionStorage.getItem("bearerToken")) return;
    void fetchLlmModelConfig();
  }, []);

  return (
    <div className="container">
      <div className="top_nav">
        <TopNavBar />
      </div>

      <div className="wrapper">
        <div className="side_nav">
          <SideNavBar />
        </div>

        <main className="main_container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

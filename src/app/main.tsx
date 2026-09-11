import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SidePanel } from "./SidePanel";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("MISSING_APP_ROOT");

createRoot(root).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);

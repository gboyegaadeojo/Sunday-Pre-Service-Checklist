import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startInputModality } from "./lib/inputModality";
import { startInstallWatch } from "./lib/install";
import { startThemeSync } from "./lib/theme";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

// Dark, Light or System (US-08a): index.html already applied it; this keeps System in step with the device.
startThemeSync();
// The focus ring shows only after keyboard use (design.md §8).
startInputModality();
// The browser's offer to install the app (Stage 13), kept for the "Install app" item in the name menu.
startInstallWatch();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

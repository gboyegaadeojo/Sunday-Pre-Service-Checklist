import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startInputModality } from "./lib/inputModality";
import { startThemeSync } from "./lib/theme";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

// Dark, Light or System (US-08a): index.html already applied it; this keeps System in step with the device.
startThemeSync();
// The focus ring shows only after keyboard use (design.md §8).
startInputModality();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

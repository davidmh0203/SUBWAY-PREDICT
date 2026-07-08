import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { OdsayApiTest } from "@/dev/OdsayApiTest.jsx";

const isOdsayTest =
  new URLSearchParams(window.location.search).has("odsay-test") ||
  window.location.hash === "#odsay-test";

createRoot(document.getElementById("root")).render(
  <StrictMode>{isOdsayTest ? <OdsayApiTest /> : <App />}</StrictMode>,
);

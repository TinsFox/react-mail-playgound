import "./style.css";
import { WebContainerService } from "./services/WebContainerService";

// Check if we are in an iframe
const isIframe = window !== window.top;

let webcontainerService: WebContainerService;
let isInitialized = false;

async function initializeWebContainer() {
  if (isInitialized || isIframe) return;
  isInitialized = true;

  try {
    webcontainerService = WebContainerService.getInstance();
    await webcontainerService.initialize();

    const exitCode = await webcontainerService.installDependencies();
    if (exitCode !== 0) {
      throw new Error("Installation failed");
    }

    await webcontainerService.startDevServer((url) => {
      if (iframeEl) {
        iframeEl.src = url;
      }
    });
  } catch (error) {
    console.error("Failed to initialize WebContainer:", error);
  }
}

// Only set up the main UI if we're not in an iframe
if (!isIframe) {
  window.addEventListener("load", initializeWebContainer);
  const root = document.getElementById('root')!
  if (!root) {
    throw new Error('root not found')
  }
  root.innerHTML = `
    <div class="container">
      <div class="editor">
        <textarea>I am a textarea</textarea>
      </div>
      <div class="preview">
        <iframe src="loading.html"></iframe>
      </div>
    </div>
  `;
}

/** @type {HTMLIFrameElement | null} */
const iframeEl = document.querySelector("iframe");

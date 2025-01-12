import "./style.css";
import { WebContainer } from "@webcontainer/api";
import { files } from "./files";

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance: WebContainer;

window.addEventListener("load", async () => {
  // textareaEl.value = files["index.js"].file.contents;
  // textareaEl.addEventListener("input", (e) => {
  //   writeIndexJS(e.currentTarget.value);
  // });

  // Call only once
  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);

  const exitCode = await installDependencies();
  console.log("exitCode: ", exitCode);
  if (exitCode !== 0) {
    throw new Error("Installation failed");
  }

  startDevServer();
});

async function installDependencies() {
  // Install dependencies
  const installProcess = await webcontainerInstance.spawn("npm", [
    "install",
    "--registry=https://registry.npmmirror.com",
  ]);
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log(data);
      },
    })
  );
  // Wait for install command to exit
  return installProcess.exit;
}

async function startDevServer() {
  // Run `npm run start` to start the Express app
  await webcontainerInstance.spawn("npm", ["run", "dev"]);

  // Wait for `server-ready` event
  webcontainerInstance.on("server-ready", (port, url) => {
    if (iframeEl) {
      iframeEl.src = url;
    }
  });
}

document.querySelector("#root").innerHTML = `
  <div class="container">
    <div class="editor">
      <textarea>I am a textarea</textarea>
    </div>
    <div class="preview">
      <iframe src="loading.html"></iframe>
    </div>
  </div>
`;

/** @type {HTMLIFrameElement | null} */
const iframeEl = document.querySelector("iframe");

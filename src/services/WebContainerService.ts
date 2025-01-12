import { WebContainer } from "@webcontainer/api";
import { files } from "../files";

interface ServerProcess {
  kill: () => void;
  output: {
    pipeTo: (stream: WritableStream) => Promise<void>;
  };
}

export class WebContainerService {
  private static instance: WebContainerService;
  private webcontainer: WebContainer | null = null;
  private serverProcess: ServerProcess | null = null;
  private isDisposing = false;
  private static isBooted = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    if (import.meta.hot) {
      import.meta.hot.dispose(async () => {
        await this.dispose();
      });
    }

    window.addEventListener('beforeunload', async () => {
      await this.dispose();
    });
  }

  public static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService();
    }
    return WebContainerService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    if (this.isDisposing) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (this.webcontainer) {
      return;
    }

    if (WebContainerService.isBooted) {
      throw new Error("WebContainer can only be booted once per page load");
    }

    try {
      this.webcontainer = await WebContainer.boot();
      WebContainerService.isBooted = true;
      await this.webcontainer.mount(files);
    } catch (error) {
      this.initializationPromise = null;
      console.error("Failed to boot WebContainer:", error);
      await this.dispose();
      throw error;
    }
  }

  public async installDependencies(): Promise<number> {
    if (!this.webcontainer) {
      throw new Error("WebContainer not initialized");
    }

    const installProcess = await this.webcontainer.spawn("npm", [
      "install",
      "--registry=https://registry.npmmirror.com",
    ]);

    const outputStream = new WritableStream({
      write(data) {
        console.log("[WebContainer Install]:", data);
      },
      close() {
        console.log("[WebContainer Install]: Complete");
      },
      abort(reason) {
        console.error("[WebContainer Install]: Failed", reason);
      }
    });

    await installProcess.output.pipeTo(outputStream);
    return installProcess.exit;
  }

  public async startDevServer(onServerReady: (url: string) => void): Promise<void> {
    if (!this.webcontainer) {
      throw new Error("WebContainer not initialized");
    }

    try {
      if (this.serverProcess) {
        console.log("[WebContainer Server]: Stopping existing server");
        await this.stopDevServer();
      }

      console.log("[WebContainer Server]: Starting server...");
      this.serverProcess = await this.webcontainer.spawn("npm", ["run", "dev"]);

      const outputStream = new WritableStream({
        write(data) {
          console.log("[WebContainer Server]:", data);
        }
      });

      this.serverProcess.output.pipeTo(outputStream).catch(error => {
        console.error("[WebContainer Server]: Output stream error", error);
      });

      console.log("[WebContainer Server]: Waiting for server to be ready...");
      this.webcontainer.on("server-ready", (port, url) => {
        console.log("[WebContainer Server]: Ready at", url);
        onServerReady(url);
      });
    } catch (error) {
      console.error("[WebContainer Server]: Failed to start", error);
      throw error;
    }
  }

  private async stopDevServer(): Promise<void> {
    if (this.serverProcess) {
      try {
        this.serverProcess.kill();
        this.serverProcess = null;
      } catch (error) {
        console.warn("[WebContainer Server]: Failed to stop server", error);
      }
    }
  }

  public async dispose(): Promise<void> {
    this.isDisposing = true;
    try {
      if (this.webcontainer) {
        await this.stopDevServer();
        this.webcontainer = null;
        WebContainerService.isBooted = false;
        WebContainerService.instance = undefined as unknown as WebContainerService;
      }
    } catch (error) {
      console.error('[WebContainer]: Disposal error', error);
    } finally {
      this.isDisposing = false;
    }
  }
}
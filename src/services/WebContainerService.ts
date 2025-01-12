import { WebContainer } from "@webcontainer/api";
import { files } from "../files";

export class WebContainerService {
  private static instance: WebContainerService;
  private webcontainer: WebContainer | null = null;
  private serverProcess: any = null; // 存储服务器进程
  private isDisposing = false;

  private constructor() {
    // 添加热更新支持
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        this.dispose();
      });
    }
  }

  public static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService();
    }
    return WebContainerService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isDisposing) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 等待之前的实例清理完成
    }

    if (!this.webcontainer) {
      this.webcontainer = await WebContainer.boot();
      await this.webcontainer.mount(files);
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

    // 改进输出处理
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

    installProcess.output.pipeTo(outputStream);
    return installProcess.exit;
  }

  public async startDevServer(onServerReady: (url: string) => void): Promise<void> {
    if (!this.webcontainer) {
      throw new Error("WebContainer not initialized");
    }

    try {
      // 如果存在旧的服务器进程，先关闭它
      if (this.serverProcess) {
        await this.stopDevServer();
      }

      this.serverProcess = await this.webcontainer.spawn("npm", ["run", "dev"]);

      // 改进服务器输出处理
      const outputStream = new WritableStream({
        write(data) {
          console.log("[WebContainer Server]:", data);
        }
      });
      this.serverProcess.output.pipeTo(outputStream);

      // 监听服务器就绪事件
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
        await this.serverProcess.kill();
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
        // 停止开发服务器
        await this.stopDevServer();

        // 清理所有运行的进程
        const processes = await this.webcontainer.ps();
        await Promise.all(
          processes.map(async (process) => {
            try {
              await process.kill();
            } catch (error) {
              console.warn('[WebContainer]: Failed to kill process', error);
            }
          })
        );

        // 重置实例
        this.webcontainer = null;
        WebContainerService.instance = null;
      }
    } catch (error) {
      console.error('[WebContainer]: Disposal error', error);
    } finally {
      this.isDisposing = false;
    }
  }
}
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { WebContainerService } from './services/WebContainerService'

function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isServerReady, setIsServerReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if current window is inside an iframe
    const isIframe = window !== window.parent
    if (isIframe) {
      console.log('Running in iframe, skipping initialization')
      return
    }

    let mounted = true;

    async function initializeWebContainer() {
      try {
        const webcontainerService = WebContainerService.getInstance()
        await webcontainerService.initialize()

        if (!mounted) return;

        const exitCode = await webcontainerService.installDependencies()
        if (exitCode !== 0) {
          throw new Error("Installation failed")
        }

        if (!mounted) return;

        // Set initialized before starting server
        setIsInitialized(true)

        await webcontainerService.startDevServer((url) => {
          if (!mounted) return;
          if (iframeRef.current) {
            iframeRef.current.src = url
            setIsServerReady(true)
          }
        })
      } catch (error) {
        console.error("Failed to initialize WebContainer:", error)
        setError(error instanceof Error ? error.message : 'Failed to initialize')
      }
    }

    if (!isInitialized) {
      initializeWebContainer()
    }

    return () => {
      mounted = false;
    }
  }, [isInitialized])

  return (
    <div className="container">
      <div className="editor">
        <textarea defaultValue="I am a textarea" />
      </div>
      <div className="preview">
        {error ? (
          <div className="error">{error}</div>
        ) : !isServerReady ? (
          <div className="loading">Loading server...</div>
        ) : (
          <iframe ref={iframeRef} />
        )}
      </div>
    </div>
  )
}

export default App

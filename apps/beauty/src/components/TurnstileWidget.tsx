import { useCallback, useEffect, useRef, useState } from 'react'

type TurnstileHandle = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileHandle
  }
}

type Props = {
  siteKey: string
  onToken: (token: string) => void
}

function getErrorMessage(code: string) {
  if (code === 'TIMEOUT') return 'A verificação demorou demais. Tente novamente.'
  if (code === 'EXPIRED') return 'A verificação expirou. Faça uma nova verificação antes de reservar.'
  if (code === 'SCRIPT_LOAD_FAILED' || code === '200500') return 'Não foi possível carregar a verificação de segurança. Confira sua conexão e se o navegador está bloqueando challenges.cloudflare.com.'
  if (code.startsWith('1101') || code.startsWith('40002')) return 'A chave pública do Turnstile parece inválida. Confira as chaves configuradas na Hostinger.'
  if (code.startsWith('1102') || code.startsWith('400021')) return 'Este domínio não está autorizado no Turnstile. Confira o hostname configurado no Cloudflare.'
  if (code.startsWith('300') || code.startsWith('600')) return `O Turnstile recusou esta tentativa (código ${code}). No computador, teste em uma janela anônima sem extensões de bloqueio e sem VPN; se persistir, envie este código para diagnóstico.`
  if (code === 'RETRY_FAILED') return 'Não foi possível reiniciar a verificação. Atualize a página e tente novamente.'
  return `Não foi possível concluir a verificação de segurança${code ? ` (código ${code})` : ''}. Tente novamente.`
}

export function TurnstileWidget({ siteKey, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const callbackRef = useRef(onToken)
  const [errorCode, setErrorCode] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  callbackRef.current = onToken

  const retry = useCallback(() => {
    setErrorCode('')
    callbackRef.current('')
    const widgetId = widgetIdRef.current
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.reset(widgetId)
      } catch {
        setErrorCode('RETRY_FAILED')
      }
    } else {
      setRetryCount((count) => count + 1)
    }
  }, [])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let active = true
    let widgetId: string | null = null
    let script: HTMLScriptElement | null = null
    let renderOnLoad: (() => void) | null = null
    let loadFailed: (() => void) | null = null

    const renderWidget = () => {
      if (!active || !containerRef.current || !window.turnstile || widgetId) return
      setErrorCode('')
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        language: 'pt-BR',
        callback: (token: string) => {
          setErrorCode('')
          callbackRef.current(token)
        },
        'expired-callback': () => {
          callbackRef.current('')
          setErrorCode('EXPIRED')
        },
        'timeout-callback': () => {
          callbackRef.current('')
          setErrorCode('TIMEOUT')
        },
        'error-callback': (code: string | number) => {
          callbackRef.current('')
          setErrorCode(String(code ?? ''))
          // The visitor sees a recovery action below the widget.
          return true
        },
      })
      widgetIdRef.current = widgetId
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]')
    if (window.turnstile) {
      renderWidget()
    } else if (existing) {
      script = existing
      renderOnLoad = renderWidget
      loadFailed = () => setErrorCode('SCRIPT_LOAD_FAILED')
      existing.addEventListener('load', renderOnLoad)
      existing.addEventListener('error', loadFailed)
    } else {
      script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.turnstileScript = 'true'
      renderOnLoad = renderWidget
      loadFailed = () => setErrorCode('SCRIPT_LOAD_FAILED')
      script.addEventListener('load', renderOnLoad)
      script.addEventListener('error', loadFailed)
      document.head.appendChild(script)
    }

    return () => {
      active = false
      if (script && renderOnLoad) script.removeEventListener('load', renderOnLoad)
      if (script && loadFailed) script.removeEventListener('error', loadFailed)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      widgetIdRef.current = null
    }
  }, [siteKey, retryCount])

  if (!siteKey) return <div className="captcha-placeholder">A verificação de segurança será ativada na configuração final.</div>
  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      {errorCode && (
        <div className="turnstile-error" role="alert" aria-live="polite">
          <p>{getErrorMessage(errorCode)}</p>
          <button type="button" className="turnstile-retry" onClick={retry}>Tentar novamente</button>
        </div>
      )}
    </div>
  )
}

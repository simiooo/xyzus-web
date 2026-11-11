import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Select } from 'antd'
import QRCode from 'qrcode'
import useAuthStore from '@/stores/authStore'
import BrandLogo from '@/components/ui/BrandLogo'
import {
  createQrLoginSession,
  pollQrLoginSession,
} from '@/api/qrLogin'

const AREA_CODES = [
  { value: '+86', label: '+86' },
  { value: '+852', label: '+852' },
  { value: '+853', label: '+853' },
  { value: '+886', label: '+886' },
  { value: '+1', label: '+1' },
]

const COUNTDOWN_SECONDS = 60
const POLL_INTERVAL_MS = 1000

type Mode = 'qr' | 'phone'
type QrPhase = 'loading' | 'ready' | 'scanned' | 'expired' | 'consumed' | 'error' | 'confirmed'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 登录：默认扫码登录（官方网页同一套接口，不经过短信风控），保留手机号 + 验证码，
 * 以及「粘贴 Token」兜底。表单块在页面上居中、块内严格左对齐。
 */
export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const sendCode = useAuthStore((s) => s.sendCode)
  const loginWithTokens = useAuthStore((s) => s.loginWithTokens)

  const [mode, setMode] = useState<Mode>('qr')

  // ---- 扫码登录 ----
  const [qrPhase, setQrPhase] = useState<QrPhase>('loading')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const qrGenerationRef = useRef(0)

  // ---- 手机号登录 ----
  const [areaCode, setAreaCode] = useState('+86')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---- Token 兜底 ----
  const [showTokenLogin, setShowTokenLogin] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const finishLoginWithTokens = useCallback(
    async (access: string, refresh: string) => {
      await loginWithTokens(access, refresh)
      navigate('/', { replace: true })
    },
    [loginWithTokens, navigate],
  )

  const runQrPolling = useCallback(
    async (id: string, generation: number) => {
      while (qrGenerationRef.current === generation) {
        await sleep(POLL_INTERVAL_MS)
        if (qrGenerationRef.current !== generation) return
        try {
          const result = await pollQrLoginSession(id)
          if (qrGenerationRef.current !== generation) return
          if (result.status === 'confirmed' && result.accessToken && result.refreshToken) {
            setQrPhase('confirmed')
            await finishLoginWithTokens(result.accessToken, result.refreshToken)
            return
          }
          if (result.status === 'expired') {
            setQrPhase('expired')
            return
          }
          if (result.status === 'consumed') {
            setQrPhase('consumed')
            return
          }
          if (result.status === 'scanned') {
            setQrPhase('scanned')
          }
        } catch (err) {
          if (qrGenerationRef.current !== generation) return
          setQrPhase('error')
          setQrError(err instanceof Error ? err.message : '扫码登录失败，请重试。')
          return
        }
      }
    },
    [finishLoginWithTokens],
  )

  const startQrLogin = useCallback(async () => {
    const generation = qrGenerationRef.current + 1
    qrGenerationRef.current = generation
    // 先让出一个微任务再改状态：effect 里同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）
    await Promise.resolve()
    if (qrGenerationRef.current !== generation) return
    setQrPhase('loading')
    setQrImage(null)
    setQrError(null)

    try {
      const session = await createQrLoginSession()
      const dataUrl = await QRCode.toDataURL(session.url, {
        margin: 1,
        width: 480,
        color: { dark: '#141414ff', light: '#ffffffff' },
        errorCorrectionLevel: 'M',
      })
      if (qrGenerationRef.current !== generation) return
      setQrImage(dataUrl)
      setQrPhase('ready')
      void runQrPolling(session.id, generation)
    } catch (err) {
      if (qrGenerationRef.current !== generation) return
      setQrPhase('error')
      setQrError(err instanceof Error ? err.message : '二维码加载失败，请重试。')
    }
  }, [runQrPolling])

  // 进入扫码模式（或手动刷新）时创建二维码；离开时作废轮询
  useEffect(() => {
    if (mode !== 'qr') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 扫码会话是外部系统：进入页面/切换模式时必须发起一次异步创建，真正的 setState 在 await 之后
    void startQrLogin()
    return () => {
      qrGenerationRef.current += 1
    }
  }, [mode, startQrLogin])

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return value - 1
      })
    }, 1000)
  }

  const phoneValid = /^\d{6,15}$/.test(phone.trim())

  const handleSendCode = async () => {
    if (!phoneValid || sending || countdown > 0) return
    setError(null)
    setNotice(null)
    setSending(true)
    try {
      await sendCode(phone.trim(), areaCode)
      startCountdown()
      setNotice('验证码已发送。没收到的话，可以直接用扫码登录。')
    } catch (e) {
      setError(readableError(e, '验证码发送失败，请稍后重试。'))
    } finally {
      setSending(false)
    }
  }

  const handleLogin = async () => {
    if (!phoneValid || code.trim().length < 4 || busy) return
    setError(null)
    setBusy(true)
    try {
      await login(phone.trim(), code.trim(), areaCode)
      navigate('/', { replace: true })
    } catch (e) {
      setError(readableError(e, '登录失败，请检查手机号与验证码。'))
    } finally {
      setBusy(false)
    }
  }

  const handleTokenLogin = async () => {
    if (!accessToken.trim() || !refreshToken.trim() || busy) return
    setError(null)
    setBusy(true)
    try {
      await finishLoginWithTokens(accessToken.trim(), refreshToken.trim())
    } catch (e) {
      setError(readableError(e, 'Token 校验失败，请确认复制完整且未过期。'))
    } finally {
      setBusy(false)
    }
  }

  const qrStatusText =
    qrPhase === 'scanned'
      ? '已扫码，请在手机上确认登录'
      : qrPhase === 'expired'
        ? '二维码已过期，点下面刷新'
        : qrPhase === 'consumed'
          ? '已在手机上确认，但这次没拿到登录凭证，刷新二维码再扫一次'
          : qrPhase === 'confirmed'
            ? '登录成功，正在进入…'
            : qrPhase === 'error'
              ? qrError ?? '二维码加载失败'
              : '打开手机上的小宇宙 App，扫描二维码登录'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2.5">
          <BrandLogo size={40} />
          <span className="type-headline text-[var(--ink)]" style={{ fontSize: 18 }}>
            宇宙电台
          </span>
        </div>

        <h1 className="m-0 type-headline text-[var(--ink)]">登录</h1>
        <p className="m-0 mt-2 type-sub">用小宇宙账号登录：扫码最快，也可以贴 Token。</p>

        <div className="mt-6 flex gap-1.5" role="tablist" aria-label="登录方式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'qr'}
            className="pill"
            data-selected={mode === 'qr'}
            onClick={() => setMode('qr')}
          >
            扫码登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'phone'}
            className="pill"
            data-selected={mode === 'phone'}
            onClick={() => setMode('phone')}
          >
            手机号登录
          </button>
        </div>

        {mode === 'qr' ? (
          <div className="mt-6">
            <div className="flex flex-col items-center">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-3">
                {qrPhase === 'loading' && <div className="skeleton h-[168px] w-[168px]" />}
                {qrImage && qrPhase !== 'loading' && (
                  <img
                    src={qrImage}
                    alt="登录二维码"
                    width={168}
                    height={168}
                    style={{
                      display: 'block',
                      opacity: qrPhase === 'expired' || qrPhase === 'error' ? 0.2 : 1,
                    }}
                  />
                )}
                {!qrImage && qrPhase !== 'loading' && (
                  <div className="flex h-[168px] w-[168px] items-center justify-center">
                    <span className="type-sub text-center">二维码不可用</span>
                  </div>
                )}
              </div>

              <p className="m-0 mt-4 type-manage text-[var(--ink)]">
                {qrPhase === 'scanned' ? '已扫码' : qrPhase === 'confirmed' ? '登录成功' : '扫码登录'}
              </p>
              <p className="m-0 mt-1.5 max-w-[300px] text-center type-sub">{qrStatusText}</p>

              {(qrPhase === 'expired' || qrPhase === 'consumed' || qrPhase === 'error') && (
                <button type="button" onClick={() => void startQrLogin()} className="pill pill-ink mt-3">
                  刷新二维码
                </button>
              )}

              {qrPhase === 'scanned' && (
                <p className="m-0 mt-3 type-meta">在手机上点「确认登录」后这里会自动进入。</p>
              )}

              {qrPhase === 'ready' && (
                <button
                  type="button"
                  onClick={() => void startQrLogin()}
                  className="mt-3 border-0 bg-transparent p-0 type-meta underline decoration-[var(--hairline)] underline-offset-4 hover:decoration-[var(--ink)] cursor-pointer"
                >
                  换一张二维码
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-2">
              <Select
                value={areaCode}
                onChange={setAreaCode}
                options={AREA_CODES}
                style={{ width: 88, flex: '0 0 auto' }}
                popupMatchSelectWidth={92}
              />
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                placeholder="手机号"
                aria-label="手机号"
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendCode()
                }}
                className="h-10 min-w-0 flex-1 rounded-[18px] border-0 bg-[var(--muted)] px-4 text-[13px] text-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--faint)] focus:shadow-[inset_0_0_0_1px_var(--accent)]"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                placeholder="验证码"
                aria-label="验证码"
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLogin()
                }}
                className="h-10 min-w-0 flex-1 rounded-[18px] border-0 bg-[var(--muted)] px-4 text-[13px] text-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--faint)] focus:shadow-[inset_0_0_0_1px_var(--accent)]"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!phoneValid || sending || countdown > 0}
                className="pill flex-shrink-0 px-4 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ height: 40 }}
              >
                {countdown > 0 ? `${countdown} 秒后重发` : sending ? '发送中…' : '获取验证码'}
              </button>
            </div>

            <p className="m-0 type-meta">
              小宇宙对短信验证码有风控，收不到是上游限制；建议直接用「扫码登录」。
            </p>

            <button
              type="button"
              onClick={handleLogin}
              disabled={!phoneValid || code.trim().length < 4 || busy}
              className="pill pill-ink mt-1 w-full justify-center disabled:cursor-not-allowed disabled:!bg-[var(--muted)] disabled:!text-[var(--faint)]"
              style={{ height: 44 }}
            >
              {busy ? '登录中…' : '登录'}
            </button>
          </div>
        )}

        {error && (
          <p
            className="m-0 mt-3 rounded-[var(--radius-md)] bg-[var(--destructive-container)] px-3 py-2 type-sub"
            style={{ color: 'var(--destructive)' }}
          >
            {error}
          </p>
        )}
        {notice && !error && <p className="m-0 mt-3 type-sub">{notice}</p>}

        <button
          type="button"
          onClick={() => setShowTokenLogin((value) => !value)}
          className="mt-5 border-0 bg-transparent p-0 type-sub text-[var(--ink)] underline decoration-[var(--hairline)] underline-offset-4 hover:decoration-[var(--ink)] cursor-pointer"
        >
          {showTokenLogin ? '收起' : '扫码/短信都不行？用 Token 登录'}
        </button>

        {showTokenLogin && (
          <div className="mt-3 flex flex-col gap-2.5">
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="x-jike-access-token"
              rows={2}
              className="w-full resize-none rounded-[var(--radius-md)] border-0 bg-[var(--muted)] p-3 font-mono text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:shadow-[inset_0_0_0_1px_var(--accent)]"
            />
            <textarea
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="x-jike-refresh-token"
              rows={2}
              className="w-full resize-none rounded-[var(--radius-md)] border-0 bg-[var(--muted)] p-3 font-mono text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:shadow-[inset_0_0_0_1px_var(--accent)]"
            />
            <button
              type="button"
              onClick={handleTokenLogin}
              disabled={!accessToken.trim() || !refreshToken.trim() || busy}
              className="pill pill-ink justify-center disabled:cursor-not-allowed disabled:opacity-40"
              style={{ height: 40 }}
            >
              用 Token 登录
            </button>
            <p className="m-0 type-meta">
              Token 可以在已登录的小宇宙网页版浏览器里取到；它等同于账号凭证，请只在受信任的部署里使用。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** 把接口错误翻译成一句能读的中文 */
function readableError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : ''
  if (!raw) return fallback
  // authStore / 后端已经给了可直接展示的中文，原样透出
  if (/[\u4e00-\u9fff]/.test(raw)) return raw
  if (/network|fetch|Failed to fetch/i.test(raw)) return '网络不可用，请检查后重试。'
  if (/token|401|unauthor/i.test(raw)) return '登录状态已失效，请重新登录。'
  return fallback
}

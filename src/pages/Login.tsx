import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Form, Input, Button, Typography, message, Select } from 'antd'
import { PhoneOutlined, LockOutlined } from '@ant-design/icons'
import useAuthStore from '@/stores/authStore'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const { login, sendCode, isAuthenticated } = useAuthStore()
  const [form] = Form.useForm()
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [])

  const handleSendCode = async () => {
    try {
      const phone = form.getFieldValue('phone')
      const areaCode = form.getFieldValue('areaCode') || '+86'
      if (!phone || !/^\d{7,15}$/.test(phone)) {
        message.warning('Please enter a valid phone number')
        return
      }
      setSending(true)
      await sendCode(phone, areaCode)
      message.success('Verification code sent')
      setCountdown(60)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current !== null) clearInterval(timerRef.current)
            timerRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (e: unknown) {
      message.error((e as Error)?.message || 'Failed to send code')
    } finally {
      setSending(false)
    }
  }

  const handleLogin = async (values: { phone: string; code: string; areaCode: string }) => {
    setSubmitting(true)
    try {
      await login(values.phone, values.code, values.areaCode || '+86')
      message.success('Login successful')
      navigate('/', { replace: true })
    } catch (e: unknown) {
      message.error((e as Error)?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (isAuthenticated) return null

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-subtle p-8 w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-lg font-extrabold">P</span>
          </div>
          <Title level={3} className="!text-primary !m-0">Podcast</Title>
          <Text className="!text-secondary block mt-1">Sign in with your phone number</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          initialValues={{ areaCode: '+86' }}
          requiredMark={false}
        >
          <Form.Item label={<span className="text-primary">Phone Number</span>} required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="areaCode" noStyle>
                <Select style={{ width: 100 }} className="!bg-surface">
                  <Select.Option value="+86">+86</Select.Option>
                  <Select.Option value="+852">+852</Select.Option>
                  <Select.Option value="+1">+1</Select.Option>
                  <Select.Option value="+81">+81</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="phone"
                noStyle
                rules={[
                  { required: true, message: 'Enter phone number' },
                  { pattern: /^\d{7,15}$/, message: 'Invalid phone number' },
                ]}
              >
                <Input prefix={<PhoneOutlined />} placeholder="Phone number" className="flex-1" />
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item label={<span className="text-primary">Verification Code</span>} required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item
                name="code"
                noStyle
                rules={[
                  { required: true, message: 'Enter verification code' },
                  { pattern: /^\d{4,10}$/, message: 'Invalid code' },
                ]}
              >
                <Input prefix={<LockOutlined />} placeholder="Enter code" className="flex-1" />
              </Form.Item>
              <Button
                type="default"
                onClick={handleSendCode}
                disabled={countdown > 0 || sending}
                className="whitespace-nowrap min-w-[120px]"
              >
                {countdown > 0 ? `${countdown}s` : sending ? 'Sending...' : 'Send Code'}
              </Button>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

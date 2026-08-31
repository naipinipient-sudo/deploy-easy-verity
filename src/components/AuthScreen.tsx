import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function AuthScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return <p>Magic link sent to {email}. Check your inbox.</p>
  }

  return (
    <form onSubmit={sendLink} className="auth-form">
      <h1>Verity</h1>
      <p>Sign in with your email — no password, we send a magic link.</p>
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Send magic link</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

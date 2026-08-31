import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { AuthScreen } from './components/AuthScreen'
import { WorkspaceScreen } from './components/WorkspaceScreen'
import { DatasetsScreen } from './components/DatasetsScreen'
import './App.css'

interface Workspace {
  id: string
  name: string
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <p>Loading…</p>
  if (!session) return <AuthScreen />

  return (
    <main className="container">
      <header>
        <span>{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      {!workspace ? (
        <WorkspaceScreen onSelect={setWorkspace} />
      ) : (
        <DatasetsScreen
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          userId={session.user.id}
          onBack={() => setWorkspace(null)}
        />
      )}
    </main>
  )
}

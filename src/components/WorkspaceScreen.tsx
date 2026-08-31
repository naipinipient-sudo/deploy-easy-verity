import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Workspace {
  id: string
  name: string
}

export function WorkspaceScreen({ onSelect }: { onSelect: (ws: Workspace) => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('workspaces').select('id, name').order('created_at')
    if (error) setError(error.message)
    else setWorkspaces(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error } = await supabase.rpc('create_workspace', { ws_name: name })
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    await load()
    if (data) onSelect(data as Workspace)
  }

  if (loading) return <p>Loading workspaces…</p>

  return (
    <div>
      <h2>Your workspaces</h2>
      <ul className="list">
        {workspaces.map((ws) => (
          <li key={ws.id}>
            <button onClick={() => onSelect(ws)}>{ws.name}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={createWorkspace} className="inline-form">
        <input
          required
          placeholder="New workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit">Create workspace</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

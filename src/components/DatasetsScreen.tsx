import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UploadFlow } from './UploadFlow'

interface DatasetRow {
  id: string
  name: string
  current_version_id: string | null
  dataset_versions: { row_count: number; mapping_confirmed: boolean; created_at: string }[]
}

export function DatasetsScreen({
  workspaceId,
  workspaceName,
  userId,
  onBack,
}: {
  workspaceId: string
  workspaceName: string
  userId: string
  onBack: () => void
}) {
  const [datasets, setDatasets] = useState<DatasetRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('datasets')
      .select('id, name, current_version_id, dataset_versions(row_count, mapping_confirmed, created_at)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setDatasets((data as DatasetRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [workspaceId])

  return (
    <div>
      <button onClick={onBack}>← Workspaces</button>
      <h2>{workspaceName}</h2>

      <h3>Datasets</h3>
      {loading ? (
        <p>Loading…</p>
      ) : datasets.length === 0 ? (
        <p>No datasets yet — import a file below.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Latest rows</th><th>Versions</th></tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.dataset_versions.at(-1)?.row_count ?? '—'}</td>
                <td>{d.dataset_versions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <UploadFlow
        workspaceId={workspaceId}
        userId={userId}
        datasets={datasets.map((d) => ({ id: d.id, name: d.name }))}
        onImported={load}
      />
    </div>
  )
}

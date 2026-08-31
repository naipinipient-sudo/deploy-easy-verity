import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CANONICAL_FIELDS } from '../lib/canonical'
import {
  MAX_FILE_BYTES,
  MAX_ROWS,
  parseFile,
  profileColumns,
  sha256Hex,
  type ParsedFile,
  type FileProfile,
} from '../lib/profile'

interface Dataset {
  id: string
  name: string
}

export function UploadFlow({
  workspaceId,
  userId,
  datasets,
  onImported,
}: {
  workspaceId: string
  userId: string
  datasets: Dataset[]
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [profile, setProfile] = useState<FileProfile | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [targetDatasetId, setTargetDatasetId] = useState<string>('__new__')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(f: File) {
    setError(null)
    if (f.size > MAX_FILE_BYTES) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)}MB — MVP limit is ${MAX_FILE_BYTES / 1024 / 1024}MB.`)
      return
    }
    setFile(f)
    const p = await parseFile(f)
    if (p.rowCount > MAX_ROWS) {
      setError(`File has ${p.rowCount} rows — MVP limit is ${MAX_ROWS}.`)
      return
    }
    setParsed(p)
    setProfile(profileColumns(p.headers, p.rows))
    setNewName(f.name.replace(/\.(csv|xlsx?)$/i, ''))
  }

  async function pickSheet(sheetName: string) {
    if (!file) return
    const p = await parseFile(file, sheetName)
    setParsed(p)
    setProfile(profileColumns(p.headers, p.rows))
  }

  async function confirmImport() {
    if (!file || !parsed || !profile) return
    setBusy(true)
    setError(null)
    try {
      const checksum = await sha256Hex(file)

      let datasetId = targetDatasetId
      if (targetDatasetId === '__new__') {
        const { data, error } = await supabase
          .from('datasets')
          .insert({ workspace_id: workspaceId, name: newName, created_by: userId })
          .select('id')
          .single()
        if (error) throw error
        datasetId = data.id
      }

      const { count } = await supabase
        .from('dataset_versions')
        .select('id', { count: 'exact', head: true })
        .eq('dataset_id', datasetId)
      const versionNumber = (count ?? 0) + 1

      const path = `${workspaceId}/${datasetId}/${versionNumber}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('dataset-uploads').upload(path, file)
      if (uploadError) throw uploadError

      const { data: version, error: versionError } = await supabase
        .from('dataset_versions')
        .insert({
          dataset_id: datasetId,
          workspace_id: workspaceId,
          version_number: versionNumber,
          file_path: path,
          file_name: file.name,
          checksum,
          sheet_name: parsed.activeSheet,
          row_count: parsed.rowCount,
          schema_profile: { columns: profile.columns },
          mapping,
          mapping_confirmed: true,
          created_by: userId,
        })
        .select('id')
        .single()
      if (versionError) throw versionError

      await supabase.from('datasets').update({ current_version_id: version.id }).eq('id', datasetId)

      await supabase.from('audit_events').insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'import_dataset',
        object_type: 'dataset_version',
        object_id: version.id,
        meta: { datasetId, versionNumber, rowCount: parsed.rowCount },
      })

      setFile(null)
      setParsed(null)
      setProfile(null)
      setMapping({})
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="upload-flow">
      <h3>Import a file</h3>

      {!parsed && (
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
      )}

      {parsed && parsed.sheetNames.length > 1 && (
        <div>
          <label>Sheet: </label>
          <select value={parsed.activeSheet} onChange={(e) => pickSheet(e.target.value)}>
            {parsed.sheetNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {profile && parsed && (
        <>
          <p>{parsed.rowCount} rows detected. Map source columns to canonical fields:</p>
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Source column</th>
                <th>Type</th>
                <th>Null %</th>
                <th>Sample</th>
                <th>Maps to</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.map((col) => (
                <tr key={col.name}>
                  <td>{col.name}</td>
                  <td>{col.type}</td>
                  <td>{Math.round(col.nullRate * 100)}%</td>
                  <td>{col.sampleValues.join(', ')}</td>
                  <td>
                    <select
                      value={mapping[col.name] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [col.name]: e.target.value })}
                    >
                      <option value="">— ignore —</option>
                      {CANONICAL_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <label>Dataset: </label>
            <select value={targetDatasetId} onChange={(e) => setTargetDatasetId(e.target.value)}>
              <option value="__new__">New dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name} (new version)</option>
              ))}
            </select>
            {targetDatasetId === '__new__' && (
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Dataset name" />
            )}
          </div>

          <button onClick={confirmImport} disabled={busy}>
            {busy ? 'Importing…' : 'Confirm mapping & import'}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}

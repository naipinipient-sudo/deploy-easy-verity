import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ponytail: fixed ceiling for browser-side parsing (PRD 9.1/14 risk).
// Bigger files need the Phase 3 Cloud Run path, not a bigger constant here.
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_ROWS = 200_000

export type ColumnType =
  | 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'identifier' | 'category'

export interface ColumnProfile {
  name: string
  type: ColumnType
  nullRate: number
  distinctCount: number
  sampleValues: string[]
}

export interface ParsedFile {
  sheetNames: string[]
  activeSheet: string
  headers: string[]
  rows: string[][] // excludes header row
  rowCount: number
}

export interface FileProfile {
  columns: ColumnProfile[]
  previewRows: string[][]
}

function sheetsFromWorkbook(buf: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: 'array' })
}

export async function parseFile(file: File, sheetName?: string): Promise<ParsedFile> {
  const isXlsx = /\.xlsx?$/i.test(file.name)
  let headers: string[]
  let rows: string[][]
  let sheetNames: string[]
  let activeSheet: string

  if (isXlsx) {
    const buf = await file.arrayBuffer()
    const wb = sheetsFromWorkbook(buf)
    sheetNames = wb.SheetNames
    activeSheet = sheetName ?? sheetNames[0] ?? file.name
    const sheet = wb.Sheets[activeSheet]
    if (!sheet) throw new Error(`Sheet "${activeSheet}" not found in workbook`)
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
    // ponytail: assumes header is the first non-empty row, no smarter detection.
    const firstNonEmpty = aoa.findIndex((r) => r.some((c) => String(c).trim() !== ''))
    headers = (aoa[firstNonEmpty] ?? []).map((h: string) => String(h).trim())
    rows = aoa.slice(firstNonEmpty + 1).filter((r) => r.some((c) => String(c).trim() !== ''))
  } else {
    const text = await file.text()
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
    const aoa = result.data
    headers = (aoa[0] ?? []).map((h: string) => String(h).trim())
    rows = aoa.slice(1)
    sheetNames = [file.name]
    activeSheet = file.name
  }

  return { sheetNames, activeSheet, headers, rows, rowCount: rows.length }
}

function inferType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v.trim() !== '')
  if (nonEmpty.length === 0) return 'text'

  const isNumber = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim())
  const isCurrency = (v: string) => /^[$€£¥]\s?-?\d[\d,]*(\.\d+)?$/.test(v.trim())
  const isBoolean = (v: string) => ['true', 'false', 'yes', 'no', '0', '1'].includes(v.trim().toLowerCase())
  const isDate = (v: string) => !isNumber(v) && !isNaN(Date.parse(v.trim())) && v.trim() !== ''

  if (nonEmpty.every(isCurrency)) return 'currency'
  if (nonEmpty.every(isNumber)) return 'number'
  if (nonEmpty.every(isBoolean)) return 'boolean'
  if (nonEmpty.every(isDate)) return 'date'

  const distinct = new Set(nonEmpty.map((v) => v.trim()))
  const distinctRatio = distinct.size / nonEmpty.length
  if (distinctRatio > 0.9 && nonEmpty.every((v) => /^[A-Za-z0-9_-]+$/.test(v.trim()))) return 'identifier'
  if (distinctRatio < 0.5 && distinct.size > 1) return 'category'
  return 'text'
}

export function profileColumns(headers: string[], rows: string[][]): FileProfile {
  const columns: ColumnProfile[] = headers.map((name, i) => {
    const values = rows.map((r) => r[i] ?? '')
    const nulls = values.filter((v) => v.trim() === '').length
    const distinct = new Set(values.filter((v) => v.trim() !== '').map((v) => v.trim()))
    return {
      name,
      type: inferType(values),
      nullRate: rows.length ? nulls / rows.length : 0,
      distinctCount: distinct.size,
      sampleValues: [...distinct].slice(0, 5),
    }
  })
  return { columns, previewRows: rows.slice(0, 20) }
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  createProfileImportPreview,
  ProfileImportError,
  readHousingProfileFile,
} from './importProfile'
import type { HousingProfileDraft } from './types'

export function ProfileImport({
  onReplace,
  onCancel,
}: {
  onReplace: (draft: HousingProfileDraft) => boolean
  onCancel?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<HousingProfileDraft | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function choose(file: File | undefined) {
    setError('')
    setPending(null)
    if (!file) return
    try {
      setPending(await readHousingProfileFile(file))
    } catch (reason) {
      setError(reason instanceof ProfileImportError ? reason.message : 'This file could not be imported.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  function cancel() {
    setPending(null)
    setError('')
    onCancel?.()
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length !== 1) {
      setPending(null)
      setError('Drop one JSON profile backup at a time.')
      return
    }
    void choose(event.dataTransfer.files[0])
  }

  const preview = pending ? createProfileImportPreview(pending) : null
  return <section className="hp-import" aria-label="Import housing profile">
    <div className={`hp-import-drop${dragging ? ' is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <input ref={input} className="hp-sr" type="file" accept="application/json,.json" onChange={event => void choose(event.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()}>Import Profile</button>
      <span>or drop one JSON file here</span>
      <small>Your file is processed only in this browser.</small>
    </div>
    {error && <p className="hp-import-error" role="alert">{error}</p>}
    {preview && pending && <div className="hp-import-preview" role="dialog" aria-labelledby="hp-import-title" aria-describedby="hp-import-warning">
      <h2 id="hp-import-title">Preview imported profile</h2>
      <dl>
        <div><dt>Version</dt><dd>{preview.version}</dd></div>
        <div><dt>Last updated</dt><dd>{new Date(preview.updatedAt).toLocaleString()}</dd></div>
        <div><dt>Completion</dt><dd>{preview.completionPercentage}%</dd></div>
        <div><dt>Completed sections</dt><dd>{preview.completedSections.join(', ') || 'None yet'}</dd></div>
        <div><dt>Location</dt><dd>{preview.location}</dd></div>
        <div><dt>Monthly budget</dt><dd>{preview.budget}</dd></div>
      </dl>
      <p id="hp-import-warning" className="hp-import-warning">Replacing changes the housing profile stored in this browser. You can undo this import during this browser session.</p>
      <div className="hp-import-actions">
        <button type="button" className="hp-primary" onClick={() => { if (onReplace(pending)) setPending(null) }}>Replace current profile</button>
        <button type="button" onClick={cancel}>Cancel</button>
      </div>
    </div>}
  </section>
}

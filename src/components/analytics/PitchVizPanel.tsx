import * as React from 'react'
import { useMutation } from '#/lib/query'
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
} from '#/components/ui'
import { runPenaltyblogOperation } from '#/lib/client-actions/penaltyblog'

// ─── Types ────────────────────────────────────────────────────────────────────

type BridgeResult = { result: unknown; operation: string }

type LayerDef = {
  type: string
  x: string
  y: string
  endX: string
  endY: string
  color: string
  size: string
  label: string
}

const LAYER_TYPES = [
  { label: 'Scatter', value: 'scatter' },
  { label: 'Heatmap', value: 'heatmap' },
  { label: 'Arrows', value: 'arrows' },
  { label: 'Comets', value: 'comets' },
  { label: 'KDE (density)', value: 'kde' },
]

const PROVIDERS = [
  { label: 'StatsBomb', value: 'statsbomb' },
  { label: 'Opta', value: 'opta' },
  { label: 'Wyscout', value: 'wyscout' },
  { label: 'Custom', value: 'custom' },
]

const THEMES = [
  { label: 'Default', value: 'default' },
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'Grass', value: 'grass' },
]

const ORIENTATIONS = [
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
]

const VIEWS = [
  { label: 'Full Pitch', value: 'full' },
  { label: 'Half Pitch', value: 'half' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function PitchVizPanel() {
  // Pitch config
  const [provider, setProvider] = React.useState('statsbomb')
  const [pitchWidth, setPitchWidth] = React.useState('800')
  const [pitchHeight, setPitchHeight] = React.useState('500')
  const [theme, setTheme] = React.useState('default')
  const [orientation, setOrientation] = React.useState('horizontal')
  const [view, setView] = React.useState('full')
  const [title, setTitle] = React.useState('')

  // Layers
  const [layers, setLayers] = React.useState<LayerDef[]>([])

  // Data
  const [dataJson, setDataJson] = React.useState('')

  // Results
  const [html, setHtml] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const renderMut = useMutation({
    mutationFn: async () => {
      setError(null)

      let data: Record<string, unknown>[] = []
      if (dataJson.trim()) {
        try {
          data = JSON.parse(dataJson)
        } catch {
          throw new Error('Invalid JSON data. Provide an array of objects with x/y coordinates.')
        }
      }

      const layerPayloads = layers.map((layer) => {
        const l: Record<string, unknown> = { type: layer.type }
        if (layer.x) l.x_field = layer.x
        if (layer.y) l.y_field = layer.y
        if (layer.endX) l.end_x_field = layer.endX
        if (layer.endY) l.end_y_field = layer.endY
        if (layer.color) l.color = layer.color
        if (layer.size) l.size = parseFloat(layer.size) || undefined
        if (layer.label) l.label_field = layer.label
        return l
      })

      const res = await runPenaltyblogOperation({
        data: {
          operation: 'pitch_render',
          payload: {
            config: {
              provider,
              width: parseInt(pitchWidth, 10),
              height: parseInt(pitchHeight, 10),
              theme,
              orientation,
              view,
              title: title || undefined,
            },
            layers: layerPayloads,
            data,
          },
        },
      })
      return (res as BridgeResult).result
    },
    onSuccess: (data) => {
      const d = data as { html?: string }
      setHtml(d.html ?? null)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Render failed'),
  })

  const addLayer = () =>
    setLayers([...layers, { type: 'scatter', x: 'x', y: 'y', endX: '', endY: '', color: '#e74c3c', size: '8', label: '' }])

  const removeLayer = (idx: number) => setLayers(layers.filter((_, i) => i !== idx))
  const updateLayer = (idx: number, patch: Partial<LayerDef>) => {
    setLayers(layers.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-bold text-[var(--sea-ink)]">⚽ Pitch Visualization</h2>
      <p className="text-xs text-[var(--sea-ink-soft)]">
        Render interactive football pitch visualizations with scatter, heatmap, arrows, comets, and KDE layers.
      </p>

      {/* Pitch Config */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Pitch Configuration</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider} placeholder="Provider" options={PROVIDERS} />
          </div>
          <div className="space-y-1">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={setTheme} placeholder="Theme" options={THEMES} />
          </div>
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shot Map — Arsenal vs Chelsea" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Width</Label>
            <Input type="number" value={pitchWidth} onChange={(e) => setPitchWidth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Height</Label>
            <Input type="number" value={pitchHeight} onChange={(e) => setPitchHeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Orientation</Label>
            <Select value={orientation} onValueChange={setOrientation} placeholder="Orientation" options={ORIENTATIONS} />
          </div>
          <div className="space-y-1">
            <Label>View</Label>
            <Select value={view} onValueChange={setView} placeholder="View" options={VIEWS} />
          </div>
        </div>
      </div>

      {/* Data Input */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Data (JSON array of objects)</h3>
        <textarea
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon)] focus:outline-none focus:ring-1 focus:ring-[var(--lagoon)]"
          rows={5}
          value={dataJson}
          onChange={(e) => setDataJson(e.target.value)}
          placeholder={'[\n  {"x": 80, "y": 30, "player": "Saka", "xG": 0.25},\n  {"x": 92, "y": 45, "player": "Havertz", "xG": 0.72}\n]'}
        />
      </div>

      {/* Layers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--sea-ink)]">
            Layers ({layers.length})
          </h3>
          <Button variant="secondary" onClick={addLayer}>
            + Add Layer
          </Button>
        </div>

        {layers.map((layer, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--line)] bg-[var(--sand)]/50 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[var(--lagoon-deep)] w-6">#{idx + 1}</span>
              <div className="flex-1">
                <Select
                  value={layer.type}
                  onValueChange={(v) => updateLayer(idx, { type: v })}
                  placeholder="Layer type"
                  options={LAYER_TYPES}
                />
              </div>
              <Button variant="ghost" onClick={() => removeLayer(idx)}>
                ✕
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-[10px]">X Field</Label>
                <Input
                  value={layer.x}
                  onChange={(e) => updateLayer(idx, { x: e.target.value })}
                  placeholder="x"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Y Field</Label>
                <Input
                  value={layer.y}
                  onChange={(e) => updateLayer(idx, { y: e.target.value })}
                  placeholder="y"
                />
              </div>
              {(layer.type === 'arrows' || layer.type === 'comets') && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px]">End X</Label>
                    <Input
                      value={layer.endX}
                      onChange={(e) => updateLayer(idx, { endX: e.target.value })}
                      placeholder="end_x"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">End Y</Label>
                    <Input
                      value={layer.endY}
                      onChange={(e) => updateLayer(idx, { endY: e.target.value })}
                      placeholder="end_y"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label className="text-[10px]">Color</Label>
                <Input
                  value={layer.color}
                  onChange={(e) => updateLayer(idx, { color: e.target.value })}
                  placeholder="#e74c3c"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Size</Label>
                <Input
                  type="number"
                  value={layer.size}
                  onChange={(e) => updateLayer(idx, { size: e.target.value })}
                  placeholder="8"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Render Button */}
      <Button onClick={() => renderMut.mutate()} disabled={renderMut.isPending}>
        {renderMut.isPending ? <><Spinner className="h-4 w-4" /> Rendering…</> : '🎨 Render Pitch'}
      </Button>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Rendered Pitch */}
      {html && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--sea-ink)]">Rendered Pitch</h3>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const blob = new Blob([html], { type: 'text/html' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `pitch-${Date.now()}.html`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                ⬇ Download HTML
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const container = document.getElementById('pitch-render-area')
                  if (!container) return
                  const svg = container.querySelector('svg')
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg)
                    const blob = new Blob([svgData], { type: 'image/svg+xml' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `pitch-${Date.now()}.svg`
                    a.click()
                    URL.revokeObjectURL(url)
                  }
                }}
              >
                ⬇ Download SVG
              </Button>
            </div>
          </div>
          <div
            id="pitch-render-area"
            className="overflow-auto rounded-lg border border-[var(--line)] bg-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </Card>
  )
}

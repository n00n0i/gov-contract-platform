import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Move, RefreshCw, X, Info, Maximize2, Minimize2 } from 'lucide-react'
import { getGraphVisualization, getKBGraphVisualization, type GraphNode, type GraphEdge } from '../services/graphService'

interface GraphVisualizationProps {
  centerEntity?: string
  depth?: number
  height?: number
  mode?: 'contracts' | 'kb'
  kbId?: string
}

export default function GraphVisualization({
  centerEntity,
  depth = 2,
  height = 500,
  mode = 'contracts',
  kbId,
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Color scheme for entity types (Thai labels)
  const typeColors: Record<string, string> = {
    person: '#3b82f6',           // Blue - บุคคล
    party: '#3b82f6',            // Blue - คู่สัญญา (same as person)
    counterparty: '#3b82f6',     // Blue - คู่สัญญา (same as person)
    org: '#10b981',              // Green - องค์กร
    contract: '#f59e0b',         // Amber - สัญญา
    contract_number: '#f59e0b',  // Amber - เลขที่สัญญา
    project: '#8b5cf6',          // Purple - โครงการ
    money: '#ef4444',            // Red - มูลค่า/เงิน
    date: '#6b7280',             // Gray - วันที่
    start_date: '#6b7280',       // Gray - วันที่เริ่ม
    end_date: '#6b7280',         // Gray - วันที่สิ้นสุด
    term: '#14b8a6',             // Teal - เงื่อนไข
    clause: '#f97316',           // Orange - มาตรา
    service: '#84cc16',          // Lime - งาน/บริการ
    asset: '#06b6d4',            // Cyan - ทรัพย์สิน
    location: '#a855f7',         // Violet - สถานที่
    document: '#6366f1',         // Indigo - เอกสาร
    unknown: '#9ca3af',          // Light gray - ไม่ระบุ
  }

  const typeLabels: Record<string, string> = {
    person: 'บุคคล',
    party: 'คู่สัญญา',
    counterparty: 'คู่สัญญา',
    org: 'องค์กร',
    contract: 'สัญญา',
    contract_number: 'เลขที่สัญญา',
    project: 'โครงการ',
    money: 'มูลค่า/เงิน',
    date: 'วันที่',
    start_date: 'วันที่เริ่ม',
    end_date: 'วันที่สิ้นสุด',
    term: 'เงื่อนไข',
    clause: 'มาตรา',
    service: 'งาน/บริการ',
    asset: 'ทรัพย์สิน',
    location: 'สถานที่',
    document: 'เอกสาร',
    unknown: 'ไม่ระบุ',
  }

  // Deduplicated legend: one entry per unique color
  const legendEntries = Object.entries(typeColors).filter(
    ([type, color], idx, arr) => arr.findIndex(([, c]) => c === color) === idx
  ).map(([type, color]) => ({ color, label: typeLabels[type] || type }))

  const fetchGraphData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = mode === 'kb'
        ? await getKBGraphVisualization(kbId, centerEntity, depth, 100)
        : await getGraphVisualization(centerEntity, depth, 100)
      
      // Assign positions if not present (simple force-like layout)
      const positionedNodes = data.nodes.map((node, i) => {
        if (node.x === undefined || node.y === undefined) {
          const angle = (i / data.nodes.length) * 2 * Math.PI
          const radius = 150 + Math.random() * 100
          return {
            ...node,
            x: 400 + radius * Math.cos(angle),
            y: height / 2 + radius * Math.sin(angle)
          }
        }
        return node
      })
      
      setNodes(positionedNodes)
      setEdges(data.edges)
    } catch (err: any) {
      // Check if it's a 404 (no data) or other error
      if (err.response?.status === 404) {
        // No graph data yet - this is OK, just empty graph
        setNodes([])
        setEdges([])
      } else {
        setError(err.response?.data?.detail || 'Failed to load graph data')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraphData()
  }, [centerEntity, depth, mode, kbId])

  // Canvas pan handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDraggingCanvas(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas && !draggedNode) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false)
  }

  // Node drag handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    
    setDraggedNode(nodeId)
    setDragOffset({
      x: e.clientX,
      y: e.clientY
    })
  }

  const handleNodeMouseMove = (e: React.MouseEvent) => {
    if (draggedNode) {
      const deltaX = (e.clientX - dragOffset.x) / zoom
      const deltaY = (e.clientY - dragOffset.y) / zoom
      
      setNodes(prev => prev.map(node => {
        if (node.id === draggedNode) {
          return {
            ...node,
            x: node.x + deltaX,
            y: node.y + deltaY
          }
        }
        return node
      }))
      
      setDragOffset({
        x: e.clientX,
        y: e.clientY
      })
    }
  }

  const handleNodeMouseUp = () => {
    setDraggedNode(null)
  }

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>กำลังโหลดกราฟ...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button 
            onClick={fetchGraphData}
            className="text-sm text-red-600 underline hover:text-red-700"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  // Empty state - no graph data yet
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
            <Info className="w-6 h-6 text-gray-400" />
          </div>
          <p className="font-medium">ยังไม่มีข้อมูลกราฟ</p>
          <p className="text-sm mt-1">กราฟจะถูกสร้างอัตโนมัติเมื่อมีการอัพโหลดเอกสารและสกัด Entity</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`relative bg-gray-50 rounded-lg border overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{ fontFamily: '"Sarabun", "Noto Sans Thai", system-ui, sans-serif' }}
    >
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-gray-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-gray-600" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title="Reset View"
        >
          <Move className="w-5 h-5 text-gray-600" />
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-gray-600" />
          ) : (
            <Maximize2 className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow p-3 max-w-xs">
        <h4 className="text-sm font-medium text-gray-700 mb-2">ประเภท Entity</h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {legendEntries.map(({ color, label }) => (
            <div key={color} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow px-3 py-2">
        <p className="text-xs text-gray-500">
          {nodes.length} entities • {edges.length} ความสัมพันธ์
        </p>
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 rounded-lg shadow px-3 py-1.5">
        <p className="text-xs text-gray-500">
          🖱️ ลาก node เพื่อจัดตำแหน่ง • ลากพื้นหลังเพื่อเลื่อนกราฟ
        </p>
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width="100%"
        height={isFullscreen ? '100vh' : height}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={(e) => {
          handleCanvasMouseMove(e)
          handleNodeMouseMove(e)
        }}
        onMouseUp={() => {
          handleCanvasMouseUp()
          handleNodeMouseUp()
        }}
        onMouseLeave={() => {
          handleCanvasMouseUp()
          handleNodeMouseUp()
        }}
        className={`${isDraggingCanvas || draggedNode ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge) => {
            const source = nodes.find(n => n.id === edge.source)
            const target = nodes.find(n => n.id === edge.target)
            if (!source || !target) return null
            
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#cbd5e1"
                strokeWidth={1}
                opacity={0.6}
              />
            )
          })}
          
          {/* Nodes */}
          {nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => setSelectedNode(node)}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              className={`cursor-pointer hover:opacity-80 transition ${draggedNode === node.id ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ pointerEvents: 'all' }}
            >
              <circle
                r={node.id === centerEntity ? 25 : 18}
                fill={typeColors[node.type] || '#6b7280'}
                stroke="white"
                strokeWidth={2}
                className="drop-shadow-md"
              />
              <text
                textAnchor="middle"
                dy=".3em"
                className="fill-white font-medium pointer-events-none select-none"
                style={{ 
                  fontSize: node.id === centerEntity ? '10px' : '8px',
                  fontFamily: '"Sarabun", "Noto Sans Thai", system-ui, -apple-system, sans-serif',
                  textRendering: 'geometricPrecision'
                }}
              >
                {(() => {
                  // Proper Unicode truncation for Thai text
                  const chars = Array.from(node.name)
                  // Show up to 6 characters for better display in small circles
                  if (chars.length <= 6) return node.name
                  return chars.slice(0, 5).join('') + '...'
                })()}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 w-64" style={{ fontFamily: '"Sarabun", "Noto Sans Thai", system-ui, sans-serif' }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">{selectedNode.name}</h4>
            <button 
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="text-gray-400">ประเภท:</span> {typeLabels[selectedNode.type] || selectedNode.type}</p>
            <p><span className="text-gray-400">รหัส:</span> {selectedNode.id.substring(0, 8)}...</p>
          </div>
          {/* Detail button temporarily disabled - endpoint not ready */}
          {/*
          <button
            onClick={async () => {
              // TODO: Use new endpoint /graph/contracts/entities/{id}
              console.log('View details for:', selectedNode.id)
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
          >
            <Info className="w-4 h-4" />
            ดูรายละเอียด
          </button>
          */}
        </div>
      )}
    </div>
  )
}

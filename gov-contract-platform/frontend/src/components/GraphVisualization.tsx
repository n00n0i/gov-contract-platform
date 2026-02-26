import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Move, RefreshCw, X, Info } from 'lucide-react'
import { getGraphVisualization, getEntityNeighborhood, type GraphNode, type GraphEdge } from '../services/graphService'

interface GraphVisualizationProps {
  centerEntity?: string
  depth?: number
  height?: number
}

export default function GraphVisualization({ 
  centerEntity, 
  depth = 2, 
  height = 500 
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Color scheme for entity types (Thai labels)
  const typeColors: Record<string, string> = {
    person: '#3b82f6',      // Blue - บุคคล
    org: '#10b981',         // Green - องค์กร
    contract: '#f59e0b',    // Amber - สัญญา
    project: '#8b5cf6',     // Purple - โครงการ
    money: '#ef4444',       // Red - มูลค่า/เงิน
    date: '#6b7280',        // Gray - วันที่
    term: '#14b8a6',        // Teal - เงื่อนไข
    clause: '#f97316',      // Orange - มาตรา
    service: '#84cc16',     // Lime - งาน/บริการ
    asset: '#06b6d4',       // Cyan - ทรัพย์สิน
    location: '#a855f7',    // Violet - สถานที่
    document: '#6366f1',    // Indigo - เอกสาร
  }

  const typeLabels: Record<string, string> = {
    person: 'บุคคล',
    org: 'องค์กร',
    contract: 'สัญญา',
    project: 'โครงการ',
    money: 'มูลค่า/เงิน',
    date: 'วันที่',
    term: 'เงื่อนไข',
    clause: 'มาตรา',
    service: 'งาน/บริการ',
    asset: 'ทรัพย์สิน',
    location: 'สถานที่',
    document: 'เอกสาร',
  }

  const fetchGraphData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getGraphVisualization(centerEntity, depth, 100)
      
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
      setError(err.response?.data?.detail || 'Failed to load graph data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGraphData()
  }, [centerEntity, depth])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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

  return (
    <div className="relative bg-gray-50 rounded-lg border overflow-hidden">
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
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow p-3 max-w-xs">
        <h4 className="text-sm font-medium text-gray-700 mb-2">ประเภท Entity</h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-600">{typeLabels[type] || type}</span>
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

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
              className="cursor-pointer hover:opacity-80 transition"
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
                className="text-xs fill-white font-medium pointer-events-none"
                style={{ fontSize: node.id === centerEntity ? '10px' : '8px' }}
              >
                {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 w-64">
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
          <button
            onClick={async () => {
              const data = await getEntityNeighborhood(selectedNode.id, 2)
              console.log('Neighborhood:', data)
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
          >
            <Info className="w-4 h-4" />
            ดูรายละเอียด
          </button>
        </div>
      )}
    </div>
  )
}

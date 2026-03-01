import { useMemo, useState } from 'react'
import { Users, Building2 } from 'lucide-react'
import { type OrgUnit, orgLevelLabels } from '../services/organizationService'

// ──────────────────────────────────────────
// Layout constants
// ──────────────────────────────────────────
const NODE_W = 168
const NODE_H = 76
const H_GAP = 28   // gap between sibling subtrees
const V_GAP = 56   // vertical gap between levels
const PAD  = 32    // canvas padding

// ──────────────────────────────────────────
// Level styling
// ──────────────────────────────────────────
const levelColor: Record<string, { bg: string; ring: string; text: string }> = {
  ministry:   { bg: '#7c3aed', ring: '#6d28d9', text: '#fff' },
  department: { bg: '#2563eb', ring: '#1d4ed8', text: '#fff' },
  bureau:     { bg: '#16a34a', ring: '#15803d', text: '#fff' },
  division:   { bg: '#ca8a04', ring: '#b45309', text: '#fff' },
  section:    { bg: '#ea580c', ring: '#c2410c', text: '#fff' },
  unit:       { bg: '#6b7280', ring: '#4b5563', text: '#fff' },
}

const defaultColor = { bg: '#6b7280', ring: '#4b5563', text: '#fff' }

// ──────────────────────────────────────────
// Tree layout algorithm
// ──────────────────────────────────────────
interface LayoutNode {
  unit: OrgUnit
  x: number    // center-x of this node
  y: number    // top-y of this node
  w: number    // total subtree width
  depth: number
  children: LayoutNode[]
}

function buildLayout(unit: OrgUnit, depth: number): LayoutNode {
  const kids = (unit.children || []).map(c => buildLayout(c, depth + 1))
  const subtreeW =
    kids.length === 0
      ? NODE_W
      : kids.reduce((s, k) => s + k.w, 0) + H_GAP * (kids.length - 1)
  return { unit, x: 0, y: depth * (NODE_H + V_GAP), w: subtreeW, depth, children: kids }
}

function placeLayout(n: LayoutNode, left: number): void {
  n.x = left + n.w / 2
  let cursor = left
  for (const c of n.children) {
    placeLayout(c, cursor)
    cursor += c.w + H_GAP
  }
}

function collectAll(n: LayoutNode, acc: LayoutNode[]): void {
  acc.push(n)
  n.children.forEach(c => collectAll(c, acc))
}

// Cubic-bezier path from parent bottom-center to child top-center
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

// ──────────────────────────────────────────
// Tooltip component
// ──────────────────────────────────────────
function Tooltip({ node, px, py }: { node: OrgUnit; px: number; py: number }) {
  return (
    <div
      className="absolute z-20 pointer-events-none bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-56 text-sm"
      style={{ left: px + NODE_W / 2 + 8, top: py }}
    >
      <p className="font-semibold text-gray-900 leading-snug mb-1">{node.name_th}</p>
      {node.name_en && <p className="text-xs text-gray-500 mb-2">{node.name_en}</p>}
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>ระดับ</span>
          <span className="font-medium">{orgLevelLabels[node.level] || node.level}</span>
        </div>
        {node.director_name && (
          <div className="flex justify-between">
            <span>ผู้บริหาร</span>
            <span className="font-medium text-right max-w-[120px] truncate">{node.director_name}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>บุคลากร</span>
          <span className="font-medium">{node.user_count} คน</span>
        </div>
        {node.full_path && (
          <div className="pt-1 border-t border-gray-100 text-gray-400 leading-tight">{node.full_path}</div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
interface Props {
  roots: OrgUnit[]
}

export default function OrgChart({ roots }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const { allNodes, edges, canvasW, canvasH } = useMemo(() => {
    if (!roots.length) return { allNodes: [], edges: [], canvasW: 0, canvasH: 0 }

    // Build layouts and place side-by-side
    const layouts = roots.map(r => buildLayout(r, 0))
    let cursor = 0
    for (const l of layouts) {
      placeLayout(l, cursor)
      cursor += l.w + H_GAP * 3
    }

    const allNodes: LayoutNode[] = []
    layouts.forEach(l => collectAll(l, allNodes))

    const maxX = Math.max(...allNodes.map(n => n.x + NODE_W / 2))
    const maxY = Math.max(...allNodes.map(n => n.y + NODE_H))

    // Build edges
    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    for (const n of allNodes) {
      for (const c of n.children) {
        edges.push({ x1: n.x + PAD, y1: n.y + NODE_H + PAD, x2: c.x + PAD, y2: c.y + PAD })
      }
    }

    return { allNodes, edges, canvasW: maxX + PAD * 2, canvasH: maxY + PAD * 2 }
  }, [roots])

  const hoveredNode = hoveredId ? allNodes.find(n => n.unit.id === hoveredId) : null

  if (!allNodes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Building2 className="w-12 h-12 mb-3 text-gray-300" />
        <p>ยังไม่มีข้อมูลโครงสร้างองค์กร</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg bg-slate-50 border border-gray-200" style={{ maxHeight: 560 }}>
      <div className="relative" style={{ width: canvasW, height: canvasH }}>

        {/* SVG connector lines */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasW}
          height={canvasH}
        >
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
            </marker>
          </defs>
          {edges.map((e, i) => (
            <path
              key={i}
              d={bezierPath(e.x1, e.y1, e.x2, e.y2)}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
          ))}
        </svg>

        {/* Node cards */}
        {allNodes.map(({ unit, x, y }) => {
          const col = levelColor[unit.level] || defaultColor
          const isHovered = hoveredId === unit.id
          return (
            <div
              key={unit.id}
              className="absolute rounded-xl shadow-md flex flex-col justify-center px-3 py-2 cursor-pointer select-none transition-transform duration-100"
              style={{
                left: x - NODE_W / 2 + PAD,
                top: y + PAD,
                width: NODE_W,
                height: NODE_H,
                backgroundColor: col.bg,
                outline: isHovered ? `3px solid ${col.ring}` : 'none',
                outlineOffset: 2,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                zIndex: isHovered ? 10 : 1,
              }}
              onMouseEnter={() => setHoveredId(unit.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Level badge */}
              <div
                className="text-[9px] font-semibold uppercase tracking-wide mb-0.5 opacity-80"
                style={{ color: col.text }}
              >
                {orgLevelLabels[unit.level] || unit.level}
              </div>

              {/* Name */}
              <div
                className="text-xs font-bold leading-tight line-clamp-2"
                style={{ color: col.text }}
              >
                {unit.name_th}
              </div>

              {/* Footer: user count */}
              <div
                className="flex items-center gap-1 mt-1 text-[10px] opacity-75"
                style={{ color: col.text }}
              >
                <Users className="w-2.5 h-2.5" />
                <span>{unit.user_count} คน</span>
              </div>

              {/* Tooltip (positioned relative to card) */}
              {isHovered && (
                <Tooltip
                  node={unit}
                  px={0}
                  py={0}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="sticky bottom-0 left-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2 flex flex-wrap gap-3">
        {Object.entries(levelColor).map(([level, col]) => (
          <div key={level} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: col.bg }} />
            {orgLevelLabels[level] || level}
          </div>
        ))}
      </div>
    </div>
  )
}

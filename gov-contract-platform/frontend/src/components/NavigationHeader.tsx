import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Home, ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface NavigationHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  showHome?: boolean
  actions?: React.ReactNode
}

export default function NavigationHeader({ 
  title, 
  subtitle, 
  breadcrumbs = [],
  showHome = true,
  actions 
}: NavigationHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Auto-generate breadcrumbs from path if not provided
  const getDefaultBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = location.pathname.split('/').filter(Boolean)
    if (paths.length === 0) return []
    
    const crumbs: BreadcrumbItem[] = [{ label: 'หน้าหลัก', path: '/' }]
    
    paths.forEach((path, idx) => {
      const pathMap: Record<string, string> = {
        'contracts': 'สัญญา',
        'vendors': 'ผู้รับจ้าง',
        'upload': 'อัปโหลด',
        'reports': 'รายงาน',
        'settings': 'ตั้งค่า',
        'profile': 'โปรไฟล์',
        'notifications': 'แจ้งเตือน',
        'new': 'สร้างใหม่',
      }
      
      if (idx < paths.length - 1) {
        crumbs.push({ 
          label: pathMap[path] || path, 
          path: '/' + paths.slice(0, idx + 1).join('/') 
        })
      } else {
        crumbs.push({ label: pathMap[path] || title })
      }
    })
    
    return crumbs
  }

  const activeBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : getDefaultBreadcrumbs()

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          {showHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 hover:text-blue-600 transition"
              title="กลับหน้าหลัก"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">หน้าหลัก</span>
            </button>
          )}
          
          {activeBreadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4" />
              {crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path)}
                  className="hover:text-blue-600 transition"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Main Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button - Only show if not on main pages */}
            {location.pathname !== '/' && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition group"
                title="ย้อนกลับ"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-gray-900" />
              </button>
            )}
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

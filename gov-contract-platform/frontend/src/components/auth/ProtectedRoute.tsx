import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../../pages/Login'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const authenticated = isAuthenticated()

  if (!authenticated) {
    // Redirect to login with return url
    return (
      <Navigate 
        to="/login" 
        state={{ from: location, message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }} 
        replace 
      />
    )
  }

  return <>{children}</>
}

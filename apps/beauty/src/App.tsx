import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BookingPage } from './pages/BookingPage'
import { AdminPage } from './pages/AdminPage'

const PUBLIC_TITLE = '2R Beauty Studio | Agendamento online'
const PUBLIC_DESCRIPTION = 'Conheça os serviços do 2R Beauty Studio e solicite um horário de demonstração.'

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const title = isAdminRoute ? 'Acesso administrativo | 2R Beauty Studio' : PUBLIC_TITLE
    const description = isAdminRoute
      ? 'Área administrativa fictícia do 2R Beauty Studio.'
      : PUBLIC_DESCRIPTION

    document.title = title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.setAttribute('content', isAdminRoute ? 'noindex, nofollow' : 'index, follow')
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description)
    document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute('content', title)
    document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute('content', description)
  }, [pathname])

  return null
}

export default function App() {
  return (
    <>
      <RouteMetadata />
      <Routes>
        <Route path="/agendar" element={<BookingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/agendar" replace />} />
      </Routes>
    </>
  )
}

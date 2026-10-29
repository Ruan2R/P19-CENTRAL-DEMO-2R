import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BookingPage } from './pages/BookingPage'
import { AdminPage } from './pages/AdminPage'

const PUBLIC_TITLE = 'Ana Amaral Lash Designer | Agendamento online'
const PUBLIC_DESCRIPTION = 'Agende seu atendimento com Ana Amaral, Lash Designer em Sidrolândia, MS. Conheça os procedimentos e solicite seu horário.'

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const title = isAdminRoute ? 'Acesso administrativo | Ana Amaral Lash Designer' : PUBLIC_TITLE
    const description = isAdminRoute
      ? 'Área administrativa restrita da agenda de Ana Amaral Lash Designer.'
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

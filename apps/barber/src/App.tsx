import { Navigate, Route, Routes } from 'react-router-dom'
import BookingPage from './pages/BookingPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

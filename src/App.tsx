import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppSettingsModal } from './components/AppSettingsModal'
import { EditProfileModal } from './components/EditProfileModal'
import { TopBar } from './components/TopBar'
import { SettingsProvider } from './context/SettingsContext'
import { HomePage } from './views/HomePage'

function App() {
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  return (
    <SettingsProvider>
      <div className="min-h-screen bg-[#141414]">
        <TopBar
          onOpenAccount={() => setEditProfileOpen(true)}
          onOpenAppSettings={() => setAppSettingsOpen(true)}
        />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/films" element={<FilmsPage />} />
            <Route path="/mylist" element={<MyListPage />} />
          </Routes>
        </main>
      </div>
      {editProfileOpen && (
        <EditProfileModal onClose={() => setEditProfileOpen(false)} />
      )}
      {appSettingsOpen && (
        <AppSettingsModal onClose={() => setAppSettingsOpen(false)} />
      )}
    </SettingsProvider>
  )
}

function SeriesPage() {
  return <div className="px-6 md:px-12 py-12 text-white/60">Series — carousels coming soon.</div>
}

function FilmsPage() {
  return <div className="px-6 md:px-12 py-12 text-white/60">Films — carousels coming soon.</div>
}

function MyListPage() {
  return <div className="px-6 md:px-12 py-12 text-white/60">My List — carousels coming soon.</div>
}

export default App

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import EditorPage from './pages/EditorPage.jsx'
import ExportPage from './pages/ExportPage.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<WorkspacePage />} />
          <Route path="editor/:projectId" element={<EditorPage />} />
          <Route path="export/:projectId" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

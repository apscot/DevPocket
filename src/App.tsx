import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AllToolsPage, CategoryPage, FavoritesPage, HomePage, NotFound, RecentPage, ToolPage } from './pages/Pages'

// HashRouter keeps every route directly reachable on GitHub Pages (no server rewrites needed).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="tools" element={<AllToolsPage />} />
          <Route path="tools/:id" element={<ToolPage />} />
          <Route path="category/:id" element={<CategoryPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="recent" element={<RecentPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

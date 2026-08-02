import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Library from "./pages/Library";
import PaperDetail from "./pages/PaperDetail";

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/paper/:id" element={<PaperDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

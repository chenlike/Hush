import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import TradePage from "@/pages/trade";
import RankPage from "@/pages/rank";

function App() {
  return (
    <Routes>
      <Route element={<IndexPage />} path="/" />
      <Route element={<TradePage />} path="/trade" />
      <Route element={<RankPage />} path="/rank" />
    </Routes>
  );
}

export default App;

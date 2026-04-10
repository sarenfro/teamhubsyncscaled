import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import CreateTeam from "./pages/CreateTeam.tsx";
import Login from "./pages/Login.tsx";
import BookPage from "./pages/BookPage.tsx";
import Admin from "./pages/Admin.tsx";
import AdminMembers from "./pages/AdminMembers.tsx";
import AdminBookings from "./pages/AdminBookings.tsx";
import Embed from "./pages/Embed.tsx";
import CancelBooking from "./pages/CancelBooking.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateTeam />} />
          <Route path="/login/:slug" element={<Login />} />
          <Route path="/book/:slug" element={<BookPage />} />
          <Route path="/admin/:slug" element={<Admin />} />
          <Route path="/admin/:slug/members" element={<AdminMembers />} />
          <Route path="/admin/:slug/bookings" element={<AdminBookings />} />
          <Route path="/embed" element={<Embed />} />
          <Route path="/cancel" element={<CancelBooking />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

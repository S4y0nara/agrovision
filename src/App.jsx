import { Routes, Route } from 'react-router-dom'
import Header from "./components/Header"
import Hero from "./components/Hero"
import Documentation from "./pages/Documentation"
import Contact from "./pages/Contact"
import SignIn from "./pages/SignIn"
import SignUp from "./pages/SignUp"
import Welcome from "./pages/Welcome"
import Footer from "./components/Footer"
import ScrollToTop from "./components/ScrollToTop"

import Testimonials from "./components/Testimonials"
import AboutUs from "./components/AboutUs"
import DownloadApp from "./components/DownloadApp"
import AgroBot from "./pages/AgroBot"
import Weather from "./pages/Weather"
import Marketplace from "./pages/Marketplace"
import AuthGateway from "./pages/AuthGateway"
import AdminDashboard from "./pages/AdminDashboard"
import AdminLogin from "./pages/AdminLogin"
import AuthSuccess from "./pages/AuthSuccess"
import VerifyEmail from "./pages/VerifyEmail"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import PlantScanner from "./pages/PlantScanner"
import Profile from "./pages/Profile"
import { LanguageProvider } from "./context/LanguageContext"
import { CartProvider } from "./context/CartContext"
import { AuthProvider } from "./context/AuthContext"

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <ScrollToTop />

          <Routes>
            {/* Auth pages without Header */}
            <Route path="/auth" element={<AuthGateway />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/auth-success" element={<AuthSuccess />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Main pages with Header and background */}
            <Route path="/*" element={
              <div className="relative overflow-hidden">
                {/* Background Gradient */}
                <img className="absolute top-0 right-0 opacity-60 -z-10"
                  src="/gradient.png" alt="Gradient" />
                <div className="h-0 w-[40rem] absolute top-[20%]
                right-[-5%] shadow-[0_0_900px_40px_#4CAF50]
                -rotate-[30deg] -z-10"></div>

                <Header />

                <Routes>
                  <Route path="/" element={<><Hero /><AboutUs /><DownloadApp /><Testimonials /><Footer /></>} />
                  <Route path="/documentation" element={<Documentation />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/meteo" element={<Weather />} />

                  <Route path="/marketplace" element={<Marketplace />} />
                  {/* Added /:id to AgroBot route to support chat persistence on refresh */}
                  <Route path="/AgroBot" element={<AgroBot />} />
                  <Route path="/AgroBot/:id" element={<AgroBot />} />
                  <Route path="/scanner" element={<PlantScanner />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </div>
            } />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

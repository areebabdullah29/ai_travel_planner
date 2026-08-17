import { Link } from 'react-router-dom'
import { Plane, Github, Twitter, Instagram } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e91e8c] to-[#ffd166] flex items-center justify-center">
              <Plane size={16} className="text-white rotate-45" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              Travel<span className="text-[#e91e8c]">Buddy</span>
            </span>
          </Link>

          <p className="text-white/40 text-sm text-center">
            AI-Powered Travel Planning &copy; {new Date().getFullYear()} — Final Year Project
          </p>

          <div className="flex items-center gap-4">
            <a href="#" className="text-white/40 hover:text-[#4cc9f0] transition-colors">
              <Github size={18} />
            </a>
            <a href="#" className="text-white/40 hover:text-[#4cc9f0] transition-colors">
              <Twitter size={18} />
            </a>
            <a href="#" className="text-white/40 hover:text-[#e91e8c] transition-colors">
              <Instagram size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

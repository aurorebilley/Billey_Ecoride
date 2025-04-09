import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#333333] text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Mail className="w-5 h-5 text-[#A7DE65]" />
            <a href="mailto:contact@ecoride.com" className="hover:text-[#A7DE65]">
              contact@ecoride.com
            </a>
          </div>
          <div className="flex space-x-6">
            <Link to="/mentions-legales" className="hover:text-[#A7DE65]">
              Mentions légales
            </Link>
            <Link to="/politique-confidentialite" className="hover:text-[#A7DE65]">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
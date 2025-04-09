import React, { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, CheckCircle2, Loader2 } from 'lucide-react';

export function Contact() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await emailjs.sendForm(
        'service_n17sbu5',
        'template_rj8w9q8',
        formRef.current!,
        'iSKmEqlZRbXcI12Wk'
      );
      
      setIsSuccess(true);
      formRef.current?.reset();
      
      // Reset success message after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err) {
      setError('Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-[#333333] mb-8">Contactez-nous</h1>
            
            {isSuccess && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-400 mr-3" />
                <p className="text-green-700">Votre message a bien été envoyé, nous vous répondrons rapidement !</p>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom / Pseudo
                </label>
                <input
                  type="text"
                  id="name"
                  name="user_name"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="user_email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Envoi en cours...
                  </>
                ) : (
                  'Envoyer'
                )}
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-semibold text-[#333333] mb-6">Nos coordonnées</h2>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#A7DE65]/20 rounded-lg">
                    <Mail className="h-6 w-6 text-[#3E920B]" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <a href="mailto:contact@ecoride.fr" className="text-[#3E920B] hover:text-[#A7DE65]">
                      contact@ecoride.fr
                    </a>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#A7DE65]/20 rounded-lg">
                    <Phone className="h-6 w-6 text-[#3E920B]" />
                  </div>
                  <div>
                    <p className="font-medium">Téléphone</p>
                    <a href="tel:+33240123456" className="text-[#3E920B] hover:text-[#A7DE65]">
                      +33 2 40 12 34 56
                    </a>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#A7DE65]/20 rounded-lg">
                    <MapPin className="h-6 w-6 text-[#3E920B]" />
                  </div>
                  <div>
                    <p className="font-medium">Adresse</p>
                    <p className="text-gray-600">27 Rue Verte</p>
                    <p className="text-gray-600">44000 Nantes, France</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="font-medium mb-4">Suivez-nous</h3>
                <div className="flex space-x-4">
                  <a href="#" className="p-2 bg-[#A7DE65]/20 rounded-lg text-[#3E920B] hover:bg-[#A7DE65]/40 transition-colors">
                    <Facebook className="h-6 w-6" />
                  </a>
                  <a href="#" className="p-2 bg-[#A7DE65]/20 rounded-lg text-[#3E920B] hover:bg-[#A7DE65]/40 transition-colors">
                    <Twitter className="h-6 w-6" />
                  </a>
                  <a href="#" className="p-2 bg-[#A7DE65]/20 rounded-lg text-[#3E920B] hover:bg-[#A7DE65]/40 transition-colors">
                    <Linkedin className="h-6 w-6" />
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-semibold text-[#333333] mb-6">Notre localisation</h2>
              <div className="aspect-video rounded-lg overflow-hidden">
                <iframe
                  src="https://maps.google.com/maps?q=27+Rue+Verte,+44000+Nantes,+France&t=&z=16&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
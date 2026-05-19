import { useState } from 'react';
import Footer from '../components/Footer';
import { useLanguage } from '../context/LanguageContext';

const Contact = () => {
    const { t, lang } = useLanguage();
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5001/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erreur serveur');
            }
            setSuccess(true);
            setFormData({ name: '', email: '', subject: '', message: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen font-sans bg-white text-gray-800 ${lang === 'AR' ? 'text-right' : 'text-left'}`}>
            <div className="relative h-64 w-full bg-green-900 overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-green-800 to-green-600 opacity-90"></div>
                <img src="https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
                    alt="Leaves"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
                <h1 className="relative z-10 text-5xl font-bold text-white tracking-wide drop-shadow-lg">{t('contact_title')}</h1>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-normal text-center mb-12 text-gray-800">{t('contact_questions')}</h2>

                <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
                    <div className={`space-y-8 flex flex-col justify-center ${lang === 'AR' ? 'md:order-2' : ''}`}>
                        <div className="flex items-center gap-4 text-green-700">
                            <i className='bx bx-phone text-3xl'></i>
                            <span className="text-xl font-medium">51-231-141</span>
                        </div>
                        <div className="flex items-center gap-4 text-green-700">
                            <i className='bx bx-phone-call text-3xl'></i>
                            <span className="text-xl font-medium">51-231-141</span>
                        </div>
                        <div className="flex items-center gap-4 text-green-700">
                            <i className='bx bx-envelope text-3xl'></i>
                            <a href="mailto:info@agrovision.net" className="text-xl font-medium hover:underline">info@agrovision.net</a>
                        </div>
                        <div className="flex items-start gap-4 text-gray-700 mt-4">
                            <i className='bx bx-map text-3xl text-gray-500'></i>
                            <div className="text-lg">
                                <p className="font-semibold">{t('contact_mailing')}</p>
                                <p>route de la zone touristique</p>
                                <p>Mahdia, Tunisia</p>
                            </div>
                        </div>
                    </div>

                    <div className={`bg-white ${lang === 'AR' ? 'md:order-1' : ''}`}>
                        {success ? (
                            <div className="flex flex-col items-center justify-center h-full gap-6 py-16 text-center">
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                                    <i className="bx bx-check text-5xl text-green-600"></i>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800">{t('contact_alert')}</h3>
                                <p className="text-gray-500">Nous vous répondrons dans les plus brefs délais.</p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="mt-2 px-8 py-3 rounded-full border border-green-600 text-green-700 font-medium hover:bg-green-600 hover:text-white transition-all duration-300"
                                >
                                    Envoyer un autre message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}
                                <input type="text" name="name" placeholder={t('contact_name_placeholder')} value={formData.name} onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors" required />
                                <input type="email" name="email" placeholder={t('contact_email_placeholder')} value={formData.email} onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors" required />
                                <input type="text" name="subject" placeholder={t('contact_subject_placeholder')} value={formData.subject} onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors" />
                                <textarea name="message" placeholder={t('contact_message_placeholder')} rows="5" value={formData.message} onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors resize-none" required></textarea>
                                <div className="flex justify-center md:justify-start">
                                    <button type="submit" disabled={submitting}
                                        className="px-8 py-3 rounded-full border border-green-600 text-green-700 font-medium hover:bg-green-600 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                        {submitting && <i className="bx bx-loader-alt animate-spin"></i>}
                                        {submitting ? 'Envoi...' : t('contact_send')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Contact;

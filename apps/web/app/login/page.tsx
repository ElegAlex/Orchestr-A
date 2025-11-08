'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authService.login(formData);
      setUser(response.user);
      toast.success('Connexion réussie !');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la connexion'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ORCHESTR'A V2
          </h1>
          <p className="text-gray-600">Gestion de projets et RH</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="login"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Identifiant
            </label>
            <input
              id="login"
              type="text"
              required
              value={formData.login}
              onChange={(e) =>
                setFormData({ ...formData, login: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              S'inscrire
            </Link>
          </p>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-xs font-semibold text-yellow-900 mb-1">
            Compte de test
          </p>
          <p className="text-xs text-gray-600">Login: admin</p>
          <p className="text-xs text-gray-600">Password: Admin123!</p>
        </div>
      </div>
    </div>
  );
}

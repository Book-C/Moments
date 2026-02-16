'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EventDetails {
  id: string;
  title: string;
  datetime: string;
  location?: string;
  description?: string;
  hostEmail: string;
}

type RsvpStatus = 'ACCEPTED' | 'DECLINED' | 'MAYBE';

export default function RsvpPage() {
  const params = useParams();
  const token = params.token as string;

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<RsvpStatus | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`${API_URL}/api/rsvp/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Evenement laden mislukt');
          return;
        }

        setEvent(data);
      } catch (err) {
        setError('Verbinding met server mislukt');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchEvent();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!status) {
      alert('Selecteer een antwoord');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/rsvp/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          name: name || undefined,
          email: email || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'RSVP versturen mislukt');
        return;
      }

      setSubmitted(true);
    } catch (err) {
      alert('RSVP versturen mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Evenement laden...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Evenement niet gevonden</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">RSVP verstuurd!</h1>
          <p className="text-gray-600">
            Bedankt voor je reactie. De organisator is op de hoogte gebracht.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        {/* Event Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6">
          <p className="text-sm opacity-80 mb-1">Je bent uitgenodigd voor</p>
          <h1 className="text-2xl font-bold">{event?.title}</h1>
        </div>

        {/* Event Details */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Wanneer</p>
              <p className="font-medium text-gray-800">{event && formatDate(event.datetime)}</p>
            </div>
          </div>

          {event?.location && (
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Waar</p>
                <p className="font-medium text-gray-800">{event.location}</p>
              </div>
            </div>
          )}

          {event?.description && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-600 text-sm">{event.description}</p>
            </div>
          )}
        </div>

        {/* RSVP Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <p className="font-medium text-gray-800 mb-4">Kom je?</p>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { value: 'ACCEPTED', label: 'Ja', emoji: '🎉' },
              { value: 'MAYBE', label: 'Misschien', emoji: '🤔' },
              { value: 'DECLINED', label: 'Nee', emoji: '😔' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value as RsvpStatus)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === option.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">{option.emoji}</span>
                <span className={`text-sm font-medium ${
                  status === option.value ? 'text-primary-600' : 'text-gray-600'
                }`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3 mb-6">
            <input
              type="text"
              placeholder="Je naam (optioneel)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Je e-mail (optioneel)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={!status || submitting}
            className="w-full py-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Versturen...' : 'Verstuur RSVP'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-medium text-primary-500">Moments</span>
          </p>
        </div>
      </div>
    </main>
  );
}

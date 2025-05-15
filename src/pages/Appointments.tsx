import React, { useState, useEffect } from 'react';
import AppointmentManager from '../components/AppointmentManager';
import { useAuth } from '../contexts/AuthContext';
import type { Appointment, AppointmentMessage } from '../types/index';

const Appointments: React.FC = () => {
  const { user } = useAuth();
  const [lawyerEmail, setLawyerEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [messagesByAppointment, setMessagesByAppointment] = useState<Record<string, AppointmentMessage[]>>({});

  useEffect(() => {
    if (user?.role === 'client') {
      const allAppointments: Appointment[] = JSON.parse(localStorage.getItem('appointments') || '[]');
      const mine = allAppointments.filter(a => a.clientId === user.id);
      setMyAppointments(mine);
      // Fetch messages for each appointment
      const allMessages: AppointmentMessage[] = JSON.parse(localStorage.getItem('appointmentMessages') || '[]');
      const grouped: Record<string, AppointmentMessage[]> = {};
      mine.forEach(app => {
        grouped[app.id] = allMessages.filter(m => m.appointmentId === app.id);
      });
      setMessagesByAppointment(grouped);
    }
  }, [user, success]);

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      // Find lawyer by email
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const lawyer = users.find((u: any) => u.email === lawyerEmail && u.role === 'lawyer');
      if (!lawyer) {
        setError('No lawyer found with this email.');
        setIsSubmitting(false);
        return;
      }
      const appointment: Appointment = {
        id: Date.now().toString(),
        clientId: user!.id,
        lawyerId: lawyer.id,
        date,
        time,
        duration,
        status: 'pending',
        purpose,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Save to localStorage
      const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
      appointments.push(appointment);
      localStorage.setItem('appointments', JSON.stringify(appointments));
      setSuccess('Appointment request sent!');
      setLawyerEmail(''); setDate(''); setTime(''); setDuration(30); setPurpose(''); setNotes('');
    } catch (err) {
      setError('Failed to book appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role === 'lawyer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
        <div className="w-full max-w-2xl">
          <AppointmentManager />
        </div>
      </div>
    );
  }

  // Client view: booking form and appointments list side by side on desktop
  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 py-10 px-2 md:px-0">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Booking Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-blue-700 mb-6">Book an Appointment</h2>
          <form onSubmit={handleBookAppointment} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lawyer Email</label>
                <input
                  type="email"
                  value={lawyerEmail}
                  onChange={e => setLawyerEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                required
                placeholder="Brief description of the meeting purpose"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Additional Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional information you'd like to share"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">{success}</div>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold text-lg"
            >
              {isSubmitting ? 'Booking...' : 'Book Appointment'}
            </button>
          </form>
        </div>
        {/* Appointments List Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-blue-700 mb-6">Your Appointments</h2>
          {myAppointments.length === 0 ? (
            <div className="text-gray-500">No appointments booked yet.</div>
          ) : (
            <div className="space-y-6">
              {myAppointments.map(app => (
                <div key={app.id} className="border-b last:border-0 pb-6 mb-2 last:mb-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-lg text-gray-800">{app.date} at {app.time}</div>
                      <div className="text-sm text-gray-600">Purpose: {app.purpose}</div>
                      <div className="text-sm text-gray-600">Duration: {app.duration} min</div>
                      <div className="text-sm text-gray-600">Status: <span className={`font-semibold ${app.status === 'approved' ? 'text-green-600' : app.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span></div>
                    </div>
                    <div className="text-xs text-gray-400 md:text-right">Requested: {new Date(app.createdAt).toLocaleString()}</div>
                  </div>
                  {app.notes && <div className="text-sm text-gray-500 mt-1">Notes: {app.notes}</div>}
                  {/* Lawyer comments/messages */}
                  {messagesByAppointment[app.id] && messagesByAppointment[app.id].length > 0 && (
                    <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 rounded p-4">
                      <div className="font-semibold text-blue-700 mb-2">Lawyer Comments</div>
                      <div className="space-y-2">
                        {messagesByAppointment[app.id].map(msg => (
                          <div key={msg.id} className="">
                            <div className="text-sm text-gray-800"><span className="font-medium">{msg.senderName}:</span> {msg.content}</div>
                            <div className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Appointments; 
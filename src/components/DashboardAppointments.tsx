import React from 'react';
import { Appointment, User } from '../types';

interface DashboardAppointmentsProps {
  user: User;
}

const DashboardAppointments: React.FC<DashboardAppointmentsProps> = ({ user }) => {
  const appointments: Appointment[] = JSON.parse(localStorage.getItem('appointments') || '[]');
  const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');

  // Filter appointments for this user
  const myAppointments = user.role === 'client'
    ? appointments.filter(a => a.clientId === user.id)
    : appointments.filter(a => a.lawyerId === user.id);

  // Helper to get counterpart name
  const getCounterpartName = (appointment: Appointment) => {
    if (user.role === 'client') {
      const lawyer = users.find(u => u.id === appointment.lawyerId);
      return lawyer ? lawyer.name : 'Lawyer';
    } else {
      const client = users.find(u => u.id === appointment.clientId);
      return client ? client.name : 'Client';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-blue-700 mb-4">
        {user.role === 'client' ? 'Your Appointments' : 'Client Appointments'}
      </h3>
      {myAppointments.length === 0 ? (
        <div className="text-gray-500 text-sm">No appointments yet.</div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {myAppointments.map(app => (
            <div key={app.id} className="border-b last:border-0 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{getCounterpartName(app)}</div>
                  <div className="text-xs text-gray-500">{app.date} at {app.time}</div>
                  <div className="text-xs text-gray-500">Purpose: {app.purpose}</div>
                </div>
                <div className={`text-xs font-semibold ${app.status === 'approved' ? 'text-green-600' : app.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardAppointments; 
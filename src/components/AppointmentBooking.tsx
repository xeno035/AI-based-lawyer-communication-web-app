import React, { useState } from 'react';
import { Appointment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Calendar, Clock, MessageSquare, X } from 'lucide-react';

interface AppointmentBookingProps {
  lawyerId: string;
  lawyerName: string;
  onClose: () => void;
}

const AppointmentBooking: React.FC<AppointmentBookingProps> = ({
  lawyerId,
  lawyerName,
  onClose,
}) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const appointment: Appointment = {
        id: Date.now().toString(),
        clientId: user.id,
        lawyerId,
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

      // Send via socket
      if (socket) {
        socket.emit('new-appointment', appointment);
      }

      // Add a system message to the conversation
      const message = {
        id: Date.now().toString(),
        conversationId: `${user.id}-${lawyerId}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'system',
        content: `Appointment requested for ${date} at ${time} with ${lawyerName}`,
        timestamp: new Date().toISOString(),
        isAI: true,
      };

      const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
      const updatedConversations = conversations.map((conv: any) => {
        if (conv.id === `${user.id}-${lawyerId}`) {
          return {
            ...conv,
            messages: [...(conv.messages || []), message],
            lastMessage: message,
            updatedAt: message.timestamp,
          };
        }
        return conv;
      });
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));

      onClose();
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert('Failed to book appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium">Book Appointment with {lawyerName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              placeholder="Brief description of the meeting purpose"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information you'd like to share"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Booking...' : 'Book Appointment'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AppointmentBooking; 
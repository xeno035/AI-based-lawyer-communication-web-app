import React, { useState, useEffect } from 'react';
import { Appointment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Calendar, Clock, Check, X, MessageSquare } from 'lucide-react';

const AppointmentManager: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load appointments from localStorage
    const savedAppointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    setAppointments(savedAppointments.filter((apt: Appointment) => apt.lawyerId === user?.id));

    // Listen for new appointments
    if (socket) {
      socket.on('new-appointment', (appointment: Appointment) => {
        if (appointment.lawyerId === user?.id) {
          setAppointments(prev => [...prev, appointment]);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('new-appointment');
      }
    };
  }, [socket, user]);

  const addLegalAlert = (clientId: string, alert: any) => {
    const allAlerts = JSON.parse(localStorage.getItem('legalAlerts') || '{}');
    if (!allAlerts[clientId]) allAlerts[clientId] = [];
    allAlerts[clientId].unshift(alert); // newest first
    localStorage.setItem('legalAlerts', JSON.stringify(allAlerts));
  };

  const handleAppointmentAction = async (appointmentId: string, action: 'approve' | 'reject') => {
    try {
      const updatedAppointments = appointments.map(apt => {
        if (apt.id === appointmentId) {
          return {
            ...apt,
            status: action === 'approve' ? 'approved' : 'rejected',
            updatedAt: new Date().toISOString(),
          };
        }
        return apt;
      });

      // Update localStorage
      const allAppointments = JSON.parse(localStorage.getItem('appointments') || '[]');
      const updatedAllAppointments = allAppointments.map((apt: Appointment) => {
        if (apt.id === appointmentId) {
          return {
            ...apt,
            status: action === 'approve' ? 'approved' : 'rejected',
            updatedAt: new Date().toISOString(),
          };
        }
        return apt;
      });
      localStorage.setItem('appointments', JSON.stringify(updatedAllAppointments));

      // Update state
      setAppointments(updatedAppointments);

      // Send via socket
      if (socket) {
        socket.emit('appointment-update', {
          appointmentId,
          status: action === 'approve' ? 'approved' : 'rejected',
        });
      }

      // Add a system message to the conversation
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (appointment) {
        const message = {
          id: Date.now().toString(),
          conversationId: `${appointment.clientId}-${appointment.lawyerId}`,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'system',
          content: `Appointment for ${appointment.date} at ${appointment.time} has been ${action === 'approve' ? 'approved' : 'rejected'}`,
          timestamp: new Date().toISOString(),
          isAI: true,
        };

        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        const updatedConversations = conversations.map((conv: any) => {
          if (conv.id === `${appointment.clientId}-${appointment.lawyerId}`) {
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

        // Add legal alert for client
        addLegalAlert(appointment.clientId, {
          type: 'appointment-status',
          status: action === 'approve' ? 'approved' : 'rejected',
          message: `Your appointment on ${appointment.date} at ${appointment.time} was ${action === 'approve' ? 'approved' : 'rejected'} by the lawyer.`,
          lawyerId: appointment.lawyerId,
          appointmentId: appointment.id,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment. Please try again.');
    }
  };

  const handleSendMessage = () => {
    if (!selectedAppointment || !message.trim()) return;

    const appointmentMessage = {
      id: Date.now().toString(),
      appointmentId: selectedAppointment.id,
      senderId: user?.id || '',
      senderName: user?.name || '',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Add message to conversation
    const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
    const updatedConversations = conversations.map((conv: any) => {
      if (conv.id === `${selectedAppointment.clientId}-${selectedAppointment.lawyerId}`) {
        const newMessage = {
          id: Date.now().toString(),
          conversationId: conv.id,
          senderId: user?.id,
          senderName: user?.name,
          senderRole: user?.role,
          content: `Appointment Message: ${message}`,
          timestamp: new Date().toISOString(),
        };
        return {
          ...conv,
          messages: [...(conv.messages || []), newMessage],
          lastMessage: newMessage,
          updatedAt: newMessage.timestamp,
        };
      }
      return conv;
    });
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));

    // Send via socket
    if (socket) {
      socket.emit('appointment-message', appointmentMessage);
    }

    // Add legal alert for client
    addLegalAlert(selectedAppointment.clientId, {
      type: 'appointment-comment',
      message: `Your lawyer commented on your appointment: "${message}"`,
      lawyerId: selectedAppointment.lawyerId,
      appointmentId: selectedAppointment.id,
      timestamp: new Date().toISOString(),
    });

    setMessage('');
    setShowMessageModal(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Appointments</h2>
      
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <p className="text-gray-500">No appointments scheduled</p>
        ) : (
          appointments.map(appointment => (
            <div
              key={appointment.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="text-blue-600" size={20} />
                  <span className="font-medium">{appointment.date}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="text-blue-600" size={20} />
                  <span>{appointment.time}</span>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p><span className="font-medium">Purpose:</span> {appointment.purpose}</p>
                <p><span className="font-medium">Duration:</span> {appointment.duration} minutes</p>
                {appointment.notes && (
                  <p><span className="font-medium">Notes:</span> {appointment.notes}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-sm ${
                  appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  appointment.status === 'approved' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>

                {appointment.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAppointmentAction(appointment.id, 'approve')}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                    >
                      <Check size={20} />
                    </button>
                    <button
                      onClick={() => handleAppointmentAction(appointment.id, 'reject')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}

                {appointment.status === 'approved' && (
                  <button
                    onClick={() => {
                      setSelectedAppointment(appointment);
                      setShowMessageModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  >
                    <MessageSquare size={20} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Modal */}
      {showMessageModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium">Send Message</h3>
            </div>

            <div className="p-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManager; 
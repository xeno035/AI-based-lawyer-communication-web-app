import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { User, UserCircle, Users, X, Calendar } from 'lucide-react';
import { Message, Conversation, User as UserType, DocumentAnalysis } from '../types/index';
import { FiPaperclip, FiSend, FiFile } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import AppointmentBooking from '../components/AppointmentBooking';
import InviteModal from '../components/InviteModal';
import { generateIPCAnalysis } from '../data/ipcData';

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

// Add this helper function at the top-level of the file (outside the component)
async function getHuggingFaceKeywords(text: string): Promise<string[]> {
  try {
    const res = await fetch('http://localhost:5001/api/hf-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('Hugging Face API error:', errorData);
      throw new Error(errorData.error || 'Failed to extract keywords');
    }
    
    const data = await res.json();
    
    // data[0] is an array of extracted keywords
    if (!data || !data[0] || !Array.isArray(data[0])) {
      console.warn('Unexpected response format from keyword extraction API:', data);
      return [];
    }
    
    return data[0]?.map((k: any) => k.word) || [];
  } catch (error) {
    console.error('Error in keyword extraction:', error);
    // Re-throw to let the caller handle the error
    throw error;
  }
}

const Chat: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationId || null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [onlineLawyers, setOnlineLawyers] = useState<string[]>([]);

  useEffect(() => {
    // Load conversations from localStorage
    const savedConversations = JSON.parse(localStorage.getItem('conversations') || '[]');
    setConversations(savedConversations);

    // Load messages for the current conversation
    if (selectedConversation) {
      const conversation = savedConversations.find((conv: Conversation) => conv.id === selectedConversation);
      if (conversation) {
        setMessages(conversation.messages || []);
        // Reset unreadCount for this conversation
        const updatedConversations = savedConversations.map((conv: Conversation) =>
          conv.id === selectedConversation ? { ...conv, unreadCount: 0 } : conv
        );
        localStorage.setItem('conversations', JSON.stringify(updatedConversations));
        setConversations(updatedConversations);
      }
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (conversationId) {
      setSelectedConversation(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket.IO event handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      console.log('Received new message:', newMessage);
      if (newMessage.conversationId === selectedConversation) {
        setMessages(prev => {
          // Check if message already exists
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
        
        // Update conversation in localStorage
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        const updatedConversations = conversations.map((conv: Conversation) => {
          if (conv.id === newMessage.conversationId) {
            const messages = conv.messages || [];
            // Check if message already exists
            const exists = messages.some(msg => msg.id === newMessage.id);
            if (exists) return conv;
            return {
              ...conv,
              messages: [...messages, newMessage],
              lastMessage: newMessage,
              updatedAt: newMessage.timestamp
            };
          }
          return conv;
        });
        localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      }
    };

    socket.on('new-message', handleNewMessage);

    // Add conversation deletion handler
    socket.on('conversation-deleted', (conversationId: string) => {
      if (conversationId === selectedConversation) {
        // Remove conversation from localStorage
        const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
        const updatedConversations = conversations.filter((conv: Conversation) => conv.id !== conversationId);
        localStorage.setItem('conversations', JSON.stringify(updatedConversations));
        
        // Update state
        setConversations(updatedConversations);
        setMessages([]);
        
        // Navigate back to chat main page
        navigate('/chat');

        // Show notification
        alert('This conversation has been deleted by the other participant.');
      }
    });

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('conversation-deleted');
    };
  }, [socket, selectedConversation, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation || !user) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      conversationId: selectedConversation,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: message,
      timestamp: new Date().toISOString(),
    };
    
    // Add message locally
    setMessages(prev => [...prev, newMessage]);
    
    // Update conversation in localStorage
    const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
    const updatedConversations = conversations.map((conv: Conversation) => {
      if (conv.id === selectedConversation) {
        return {
          ...conv,
          messages: [...(conv.messages || []), newMessage],
          lastMessage: newMessage,
          updatedAt: newMessage.timestamp
        };
      }
      return conv;
    });
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));
    
    // Send via Socket.IO if connected
    if (socket && isConnected) {
      socket.emit('send-message', newMessage);
    }
    
    setMessage('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !selectedConversation) return;
    
    try {
      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        alert('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.');
        return;
      }

      // Create a blob URL for the file
      const fileUrl = URL.createObjectURL(file);

      // Create a new message with the file attachment
      const newMessage: Message = {
        id: uuidv4(),
        conversationId: selectedConversation,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        content: `Shared document: ${file.name}`,
        timestamp: new Date().toISOString(),
        attachments: [{
          id: uuidv4(),
          name: file.name,
          url: fileUrl,
          type: file.type,
          size: file.size
        }]
      };
      
      // Add message to local state
      setMessages(prev => [...prev, newMessage]);
      
      // Update conversation in localStorage
      const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
      const updatedConversations = conversations.map((conv: Conversation) => {
        if (conv.id === selectedConversation) {
          return {
            ...conv,
            messages: [...(conv.messages || []), newMessage],
            lastMessage: newMessage,
            updatedAt: newMessage.timestamp
          };
        }
        return conv;
      });
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      
      // Emit the message via socket
      if (socket && isConnected) {
        socket.emit('send-message', newMessage);
      }
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    }
  };

  const handleInviteLawyer = () => {
    setShowInviteModal(true);
  };

  const handleSendInvite = (email: string, message: string) => {
    if (!user) return;
    
    // 1. Check if lawyer exists, if not, add to users
    let users: UserType[] = JSON.parse(localStorage.getItem('users') || '[]');
    let lawyer = users.find(u => u.email === email && u.role === 'lawyer');
    if (!lawyer) {
      lawyer = {
        id: Date.now().toString(),
        name: email.split('@')[0],
        email,
        role: 'lawyer'
      };
      users.push(lawyer);
      localStorage.setItem('users', JSON.stringify(users));
    }

    // 2. Check if conversation exists, if not, create it
    let conversations: Conversation[] = JSON.parse(localStorage.getItem('conversations') || '[]');
    let conversation = conversations.find(conv =>
      conv.participants.some(p => p.id === user.id) &&
      conv.participants.some(p => p.id === lawyer!.id)
    );
    if (!conversation) {
      conversation = {
        id: Date.now().toString(),
        participants: [
          { id: user.id, name: user.name, role: user.role },
          { id: lawyer.id, name: lawyer.name, role: lawyer.role }
        ],
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      conversations.push(conversation);
      localStorage.setItem('conversations', JSON.stringify(conversations));
    }

    // 3. Add invite to lawyer's invites
    let invites = JSON.parse(localStorage.getItem('invites') || '[]');
    invites.push({
      id: Date.now().toString(),
      to: lawyer,
      from: user,
      message,
      conversationId: conversation.id,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('invites', JSON.stringify(invites));

    // 4. Add a system message to the conversation
    const newMessage: Message = {
      id: Date.now().toString(),
      conversationId: conversation.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: `You invited ${lawyer.name} (${lawyer.email}) to join this conversation.`,
      timestamp: new Date().toISOString(),
    };
    conversation.messages = [...(conversation.messages || []), newMessage];
    conversation.lastMessage = newMessage;
    conversation.updatedAt = new Date().toISOString();
    localStorage.setItem('conversations', JSON.stringify(conversations));

    // Add notification for the lawyer
    let notifications = JSON.parse(localStorage.getItem('notifications') || '{}');
    if (!notifications[lawyer.email]) notifications[lawyer.email] = [];
    notifications[lawyer.email].push({
      id: Date.now().toString(),
      type: 'invite',
      message: `You have been invited to a conversation by ${user.name}.`,
      conversationId: conversation.id,
      timestamp: new Date().toISOString(),
      read: false
    });
    localStorage.setItem('notifications', JSON.stringify(notifications));

    // Emit real-time invite notification via socket
    if (socket && isConnected) {
      socket.emit('new-invite', {
        to: lawyer.email,
        invite: {
          id: Date.now().toString(),
          from: user,
          message,
          conversationId: conversation.id,
          timestamp: new Date().toISOString(),
        }
      });
    }

    // 5. Update UI
    setConversations(conversations);
    setSelectedConversation(conversation.id);
    setMessages(conversation.messages);
  };

  const handleAnalyzeMessage = async (messageContent: string) => {
    try {
      const trimmed = messageContent.trim();
      if (!trimmed || trimmed.length < 10) {
        alert('Please enter a detailed legal query (at least 10 characters).');
        return;
      }

      setIsAnalyzing(true);

      // 1. Get keywords from Hugging Face
      try {
        const keywords = await getHuggingFaceKeywords(trimmed.toLowerCase());
        
        if (!keywords || !keywords.length) {
          console.warn('No keywords found, using message text directly');
          // Continue analysis with the original text if no keywords found
          performAnalysis(trimmed);
          return;
        }
        
        // 2. Use keywords to match IPC section
        performAnalysis(keywords.join(' '));
      } catch (error) {
        console.error('Error extracting keywords:', error);
        // Fallback to using the original message text
        performAnalysis(trimmed);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('An error occurred during analysis. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to perform the actual analysis and update the UI
  const performAnalysis = (queryText: string) => {
    const analysisResult = generateIPCAnalysis(queryText);

    if (!analysisResult || typeof analysisResult === 'string') {
      alert(analysisResult || 'No relevant IPC section found for this query.');
      return;
    }

    const aiMessage: Message = {
      id: Date.now().toString(),
      conversationId: selectedConversation || '',
      senderId: 'ai',
      senderName: 'AI Assistant',
      senderRole: 'lawyer',
      content: `Legal Analysis:\n\nIPC Section ${analysisResult.section} - ${analysisResult.title}\n\n${analysisResult.description}\n\nRelated Case: ${analysisResult.relatedCase || 'N/A'}`,
      timestamp: new Date().toISOString(),
      isAI: true
    };
    
    setMessages(prev => [...prev, aiMessage]);
    
    // Update conversation in localStorage
    const conversations: Conversation[] = JSON.parse(localStorage.getItem('conversations') || '[]');
    const updatedConversations = conversations.map((conv: Conversation) => {
      if (conv.id === selectedConversation) {
        return {
          ...conv,
          messages: [...(conv.messages || []), aiMessage],
          lastMessage: aiMessage,
          updatedAt: aiMessage.timestamp
        };
      }
      return conv;
    });
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));

    // Send via Socket.IO if connected
    if (socket && isConnected) {
      socket.emit('send-message', aiMessage);
    }
  };

  // Add this function near the other handler functions
  const handleDeleteChat = () => {
    if (!selectedConversation) return;

    // Show confirmation dialog
    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      // Remove conversation from localStorage
      const conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
      const updatedConversations = conversations.filter((conv: Conversation) => conv.id !== selectedConversation);
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      
      // Update state
      setConversations(updatedConversations);
      setMessages([]);
      
      // Notify other participants via socket
      if (socket && isConnected) {
        socket.emit('conversation-deleted', selectedConversation);
      }
      
      // Navigate back to chat main page
      navigate('/chat');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Conversations List */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-blue-700 text-white">
          <h2 className="text-xl font-semibold">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-4 border-b hover:bg-blue-50 cursor-pointer transition-colors ${
                selectedConversation === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
              onClick={() => navigate(`/chat/${conversation.id}`)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserCircle className="text-blue-600 w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {conversation.participants.find(p => p.id !== user?.id)?.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {conversation.lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
                {(conversation.unreadCount || 0) > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {user?.role === 'client' && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleInviteLawyer}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Users className="w-5 h-5" />
              <span>Invite Lawyer</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
          {/* Chat Header */}
          <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="text-blue-600 w-7 h-7" />
                </div>
                {onlineLawyers.includes('1') && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {conversations.find(c => c.id === selectedConversation)?.participants.find(p => p.id !== user?.id)?.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {onlineLawyers.includes('1') ? (
                    <span className="text-green-600">Online</span>
                  ) : (
                    'Offline'
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {user?.role === 'lawyer' && messages.length > 0 && (
                <button
                  onClick={() => handleAnalyzeMessage(messages[messages.length - 1].content)}
                  className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg hover:bg-yellow-200 transition-colors flex items-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Analyze Message</span>
                </button>
              )}
              
              {user?.role === 'client' && (
                <button
                  onClick={handleInviteLawyer}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Invite Lawyer</span>
                </button>
              )}

              {/* Delete Chat Button */}
              <button
                onClick={handleDeleteChat}
                className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors flex items-center space-x-2"
                title="Delete Conversation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Delete Chat</span>
              </button>

              {user?.role === 'client' && (
                <>
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>Book Appointment</span>
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id} 
                className={`flex ${
                  msg.senderId === user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl p-4 ${
                    msg.senderId === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white shadow-md'
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-3 p-3 bg-opacity-10 bg-gray-100 rounded-lg">
                        <FiFile className={`w-8 h-8 ${msg.senderId === user?.id ? 'text-white' : 'text-blue-600'}`} />
                        <div className="flex-1">
                          <p className="font-medium truncate">{msg.attachments[0].name}</p>
                          <p className="text-sm opacity-75">
                            {(msg.attachments[0].size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <a
                          href={msg.attachments[0].url}
                          download={msg.attachments[0].name}
                          className={`p-2 rounded-full hover:bg-opacity-10 hover:bg-gray-100 transition-colors ${
                            msg.senderId === user?.id ? 'text-white' : 'text-blue-600'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[15px] leading-relaxed">{msg.content}</p>
                  )}

                  <div className={`text-xs mt-2 ${
                    msg.senderId === user?.id ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="bg-white border-t p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end space-x-3">
                <div className="flex-1 bg-gray-50 rounded-2xl p-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      disabled={isAnalyzing}
                    >
                      <FiPaperclip className={`w-5 h-5 ${isAnalyzing ? 'opacity-50' : ''}`} />
                    </button>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 py-2"
                      disabled={isAnalyzing}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isAnalyzing}
                  className={`p-3 rounded-full ${
                    message.trim() 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-400'
                  } transition-colors disabled:opacity-50`}
                >
                  <FiSend className="w-5 h-5" />
                </button>
              </div>
              {isAnalyzing && (
                <div className="text-sm text-blue-600 mt-2 flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Analyzing message... Please wait.</span>
                </div>
              )}
            </div>
          </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="text-blue-600 w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">No conversation selected</h2>
              <p className="text-gray-500 mb-8">
                {user?.role === 'client'
                  ? 'Start by inviting a lawyer to discuss your case'
                  : 'Select a conversation from the list to start chatting'}
              </p>
              
              {user?.role === 'client' && (
                <button
                  onClick={handleInviteLawyer}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 mx-auto"
                >
                  <Users className="w-5 h-5" />
                  <span>Invite a Lawyer</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal 
          onClose={() => setShowInviteModal(false)}
          onSendInvite={handleSendInvite}
          currentUser={user}
        />
      )}

      {/* Appointment Booking Modal */}
      {showAppointmentModal && (
        <AppointmentBooking
          lawyerId={conversations.find(c => c.id === selectedConversation)?.participants.find(p => p.role === 'lawyer')?.id || ''}
          lawyerName={conversations.find(c => c.id === selectedConversation)?.participants.find(p => p.role === 'lawyer')?.name || ''}
          onClose={() => setShowAppointmentModal(false)}
        />
      )}
    </div>
  );
};

export default Chat;
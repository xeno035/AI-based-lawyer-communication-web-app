export interface User {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'lawyer';
  verified?: boolean;
  barCouncilId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'lawyer';
  content: string;
  timestamp: string;
  isAI?: boolean;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  documentAnalysis?: DocumentAnalysis;
}

export interface AIAnalysis {
  ipcSections: string[];
  explanation: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
    role: 'client' | 'lawyer';
  }[];
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface IPCSection {
  id: string;
  number: string;
  title: string;
  description: string;
  chapter: string;
}

export interface LegalReference {
  section: string;
  description: string;
  relevance: string;
}

export interface CaseLawReference {
  caseName: string;
  citation: string;
  relevance: string;
  summary: string;
  year: string;
}

export interface DocumentAnalysis {
  fileName: string;
  timestamp: string;
  isLegalDocument: boolean;
  analysis: string;
  keyPoints: string[];
  legalClassification?: string;
  statuteReferences?: {
    section: string;
    description: string;
    relevance: string;
  }[];
  caseReferences?: {
    caseName: string;
    citation: string;
    year: string;
    relevance: string;
    summary: string;
    successRate?: string;
  }[];
  riskAnalysis?: string;
  recommendations?: string[];
  reason?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  lawyerId: string;
  date: string;
  time: string;
  duration: number; // in minutes
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  purpose: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentMessage {
  id: string;
  appointmentId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface Document {
  id: string;
  // ...other properties
}
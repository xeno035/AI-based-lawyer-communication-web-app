export interface User {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'lawyer';
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'lawyer';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  isAI?: boolean;
  documentAnalysis?: DocumentAnalysis;
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
}

export interface SocketUser {
  userId: string;
  socketId: string;
  userRole: 'client' | 'lawyer';
}

export interface LegalReference {
  section: string;
  description: string;
  relevance: string;
}

export interface CaseLawReference {
  caseName: string;
  citation: string;
  year: string;
  relevance: string;
  summary: string;
  successRate?: string;
}

export interface DocumentAnalysis {
  fileName: string;
  timestamp: string;
  isLegalDocument: boolean;
  analysis: string;
  keyPoints: string[];
  legalClassification?: string;
  statuteReferences?: LegalReference[];
  caseReferences?: CaseLawReference[];
  riskAnalysis?: string;
  recommendations?: string[];
  reason?: string;
  matchedKeywords?: string[];
}

export interface HuggingFaceResponse {
  generated_text: string;
}

export interface HuggingFaceError {
  error: string;
  details?: string;
} 
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Message, SocketUser, DocumentAnalysis, LegalReference, CaseLawReference, HuggingFaceResponse, HuggingFaceError } from './types';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { analyzeDocument } from './utils/documentAnalysis';
import { Request, Response } from 'express';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});

// Update CORS configuration
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads';
    // Create uploads directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Store connected users
const connectedUsers: SocketUser[] = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle user authentication
  socket.on('authenticate', (userData: { userId: string; userRole: 'client' | 'lawyer' }) => {
    const { userId, userRole } = userData;
    
    // Add user to connected users
    connectedUsers.push({
      userId,
      socketId: socket.id,
      userRole
    });

    // Join user to their personal room
    socket.join(userId);

    // Notify others about new user
    socket.broadcast.emit('user-connected', { userId, userRole });
  });

  // Handle joining a conversation
  socket.on('join-conversation', (conversationId: string) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  // Handle leaving a conversation
  socket.on('leave-conversation', (conversationId: string) => {
    socket.leave(conversationId);
    console.log(`User ${socket.id} left conversation ${conversationId}`);
  });

  // Handle sending messages
  socket.on('send-message', (message: Message) => {
    // Broadcast the message to all users in the conversation
    io.to(message.conversationId).emit('new-message', message);
  });

  // Handle typing indicators
  socket.on('typing', ({ conversationId, isTyping, userId }) => {
    socket.to(conversationId).emit('typing', { conversationId, isTyping, userId });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove user from connected users
    const userIndex = connectedUsers.findIndex(user => user.socketId === socket.id);
    if (userIndex !== -1) {
      const user = connectedUsers[userIndex];
      connectedUsers.splice(userIndex, 1);
      
      // Notify others about user disconnection
      socket.broadcast.emit('user-disconnected', { userId: user.userId, userRole: user.userRole });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connectedUsers: connectedUsers.length });
});

// Hugging Face IPC search proxy endpoint
app.post('/api/ipc-search', async (req, res) => {
  const { query } = req.body;
  try {
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/google/flan-t5-large',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `Give me details and related cases for IPC section or topic: ${query}`
        })
      }
    );
    if (!hfRes.ok) {
      return res.status(500).json({ error: 'Hugging Face API error' });
    }
    const data = await hfRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Document analysis endpoint
app.post('/api/analyze-document', upload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    try {
      const analysis = await analyzeDocument(filePath);
      
      // Clean up the uploaded file
      await fs.unlink(filePath).catch(console.error);
      
      res.json(analysis);
    } catch (analysisError) {
      // Clean up the uploaded file even if analysis fails
      await fs.unlink(filePath).catch(console.error);
      
      // Return a more user-friendly error response
      res.status(500).json({
        error: 'Document analysis failed',
        details: analysisError instanceof Error ? analysisError.message : 'Unknown error',
        recommendations: [
          'Please ensure the document is in a supported format (PDF, DOC, DOCX, TXT)',
          'Check if the document contains readable text',
          'Try uploading a different document'
        ]
      });
    }
  } catch (error) {
    console.error('Error in document analysis endpoint:', error);
    res.status(500).json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      recommendations: [
        'Please try again later',
        'Contact support if the problem persists',
        'Ensure your document meets the requirements'
      ]
    });
  }
});

// Add these helper functions at the top of the file
async function analyzeLegalDocument(text: string) {
  // Legal document classification
  const classificationRes = await fetch(
    'https://api-inference.huggingface.co/models/google/flan-t5-large',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: `Analyze this legal document and provide a concise 3-point summary of the key legal aspects, important points, and potential implications: ${text}`
      })
    }
  );

  const classification = await classificationRes.json() as HuggingFaceResponse[];
  
  // Extract key points from the analysis
  const keyPoints = extractKeyPoints(classification[0].generated_text).slice(0, 3);

  // Return the analysis with the specific format requested
  return {
    legalClassification: classification[0].generated_text,
    keyPoints,
    statuteReferences: [
      {
        section: '420',
        description: 'Cheating and dishonestly inducing delivery of property',
        relevance: 'Highly relevant to the case'
      },
      {
        section: '415',
        description: 'Cheating',
        relevance: 'Directly applicable'
      },
      {
        section: '425',
        description: 'Mischief',
        relevance: 'Potentially relevant'
      }
    ],
    caseReferences: [
      {
        caseName: 'Similar Case 1',
        citation: '2023 SC 123',
        year: '2023',
        relevance: '85%',
        summary: 'Similar facts and circumstances',
        successRate: '85%'
      },
      {
        caseName: 'Similar Case 2',
        citation: '2023 SC 124',
        year: '2023',
        relevance: '78%',
        summary: 'Related legal principles',
        successRate: '78%'
      }
    ],
    riskAnalysis: 'Based on the document analysis, there is a moderate risk level. The case has strong precedents but some evidentiary challenges.',
    recommendations: [
      'Gather additional documentary evidence',
      'Consider expert witness testimony',
      'Review similar case precedents',
      'Prepare for potential counter-arguments'
    ]
  };
}

function parseStatuteReferences(text: string): LegalReference[] {
  // Split the text into sections and parse each reference
  const sections = text.split(/(?=Section|§)/i).filter(Boolean);
  return sections.map(section => {
    const matches = section.match(/(?:Section|§)\s*([^\n:]+)[:\n]+(.*?)(?=(?:Section|§|$))/is);
    if (!matches) return null;
    
    const [, sectionNum, content] = matches;
    const parts = content.split('\nRelevance:').map(s => s.trim());
    
    return {
      section: sectionNum.trim(),
      description: parts[0],
      relevance: parts[1] || 'Not specified'
    };
  }).filter(Boolean) as LegalReference[];
}

function parseCaseReferences(text: string): CaseLawReference[] {
  // Split the text into cases and parse each reference
  const cases = text.split(/(?=Case:|vs\.|v\.)/i).filter(Boolean);
  return cases.map(caseText => {
    const lines = caseText.split('\n').map(line => line.trim());
    const nameMatch = lines[0].match(/Case:\s*(.+?)(?:\(\d{4}\)|$)/i);
    const yearMatch = lines[0].match(/\((\d{4})\)/);
    const citationMatch = lines.find(l => l.match(/citation:/i))?.split(':')[1];
    const relevanceMatch = lines.find(l => l.match(/relevance:/i))?.split(':')[1];
    const summaryMatch = lines.find(l => l.match(/summary:/i))?.split(':')[1];

    if (!nameMatch) return null;

    return {
      caseName: nameMatch[1].trim(),
      citation: citationMatch?.trim() || 'Not provided',
      year: yearMatch ? yearMatch[1] : 'Unknown',
      relevance: relevanceMatch?.trim() || 'Not specified',
      summary: summaryMatch?.trim() || 'No summary available'
    };
  }).filter(Boolean) as CaseLawReference[];
}

function extractRecommendations(text: string): string[] {
  // Extract recommendations from the risk analysis
  const recommendations = text
    .split(/\d+\.|•|-/)
    .map(r => r.trim())
    .filter(r => r.length > 0 && r.match(/[A-Za-z]/));
  return recommendations.slice(0, 5); // Return top 5 recommendations
}

// Add this function to check legal relevance
async function checkLegalRelevance(text: string): Promise<{ isLegal: boolean; reason: string }> {
  const relevanceRes = await fetch(
    'https://api-inference.huggingface.co/models/google/flan-t5-large',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: `Analyze if this document is related to a legal case or legal matter. Respond with Yes or No and explain why: ${text.substring(0, 1000)}`
      })
    }
  );

  const relevanceData = await relevanceRes.json() as HuggingFaceResponse[];
  const response = relevanceData[0].generated_text.toLowerCase();
  
  return {
    isLegal: response.startsWith('yes'),
    reason: relevanceData[0].generated_text
  };
}

// Helper function to calculate success rate based on relevance
function calculateSuccessRate(relevance: string): string {
  // Convert relevance text to a numerical score
  const relevanceScore = parseFloat(relevance) || 0;
  
  // Calculate success rate based on relevance score
  const successRate = Math.min(Math.max(relevanceScore * 100, 0), 100);
  
  return `${successRate.toFixed(1)}%`;
}

function extractKeyPoints(analysis: string): string[] {
  // Split analysis into sentences and filter for key points
  return analysis
    .split('.')
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
    .slice(0, 5); // Return top 5 key points
}

// Add error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    details: err.message || 'An unexpected error occurred'
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
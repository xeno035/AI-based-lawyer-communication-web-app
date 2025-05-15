import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { DocumentAnalysis, LegalReference, CaseLawReference, HuggingFaceResponse } from '../types';

// Define types for our constants
interface IPCSection {
  title: string;
  description: string;
  relevance: string;
  successRate: string;
  riskFactor: string;
}

interface IPCKeywordMap {
  [key: string]: string[];
}

type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

interface RiskFactors {
  Critical: string[];
  High: string[];
  Medium: string[];
  Low: string[];
}

// Define risk factors at the top level
const riskFactors: RiskFactors = {
  Critical: [
    'Immediate legal intervention required',
    'High probability of severe penalties',
    'Complex evidence requirements',
    'Need for expert witnesses',
    'Consider plea bargaining options'
  ],
  High: [
    'Significant legal implications',
    'Strong evidence collection needed',
    'Consider settlement options',
    'Prepare for lengthy proceedings',
    'Document all communications'
  ],
  Medium: [
    'Standard legal procedures apply',
    'Moderate evidence requirements',
    'Consider mediation',
    'Document key events',
    'Regular case review needed'
  ],
  Low: [
    'Basic legal procedures',
    'Minimal evidence requirements',
    'Consider out-of-court settlement',
    'Maintain basic documentation',
    'Regular status updates'
  ]
};

// Constants for IPC sections
const IPC_SECTIONS: { [key: string]: IPCSection } = {
  '120': {
    title: 'Concealing design to commit offence punishable with imprisonment',
    description: 'Whoever, intending to facilitate or knowing it to be likely that he will thereby facilitate the commission of an offence punishable with imprisonment...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '121': {
    title: 'Waging or attempting to wage war against the Government of India',
    description: 'Whoever wages war against the Government of India, or attempts to wage such war...',
    relevance: 'High',
    successRate: '92%',
    riskFactor: 'Critical'
  },
  '124': {
    title: 'Assaulting President, Governor, etc., with intent to compel or restrain the exercise of any lawful power',
    description: 'Whoever, with the intention of inducing or compelling the President of India, or Governor of any State...',
    relevance: 'High',
    successRate: '88%',
    riskFactor: 'High'
  },
  '141': {
    title: 'Unlawful assembly',
    description: 'An assembly of five or more persons is designated an "unlawful assembly"...',
    relevance: 'Medium',
    successRate: '72%',
    riskFactor: 'Medium'
  },
  '302': {
    title: 'Murder',
    description: 'Whoever commits murder shall be punished with death, or imprisonment for life...',
    relevance: 'High',
    successRate: '85%',
    riskFactor: 'Critical'
  },
  '304': {
    title: 'Culpable homicide not amounting to murder',
    description: 'Whoever commits culpable homicide not amounting to murder shall be punished...',
    relevance: 'High',
    successRate: '78%',
    riskFactor: 'High'
  },
  '307': {
    title: 'Attempt to murder',
    description: 'Whoever does any act with such intention or knowledge, and under such circumstances...',
    relevance: 'High',
    successRate: '82%',
    riskFactor: 'High'
  },
  '323': {
    title: 'Voluntarily causing hurt',
    description: 'Whoever, except in the case provided for by section 334, voluntarily causes hurt...',
    relevance: 'Medium',
    successRate: '68%',
    riskFactor: 'Medium'
  },
  '354': {
    title: 'Assault or criminal force to woman with intent to outrage her modesty',
    description: 'Whoever assaults or uses criminal force to any woman, intending to outrage or knowing it to be likely...',
    relevance: 'High',
    successRate: '75%',
    riskFactor: 'High'
  },
  '376': {
    title: 'Rape',
    description: 'A man is said to commit "rape" who, except in the case hereinafter excepted...',
    relevance: 'High',
    successRate: '88%',
    riskFactor: 'Critical'
  },
  '379': {
    title: 'Theft',
    description: 'Whoever, intending to take dishonestly any moveable property out of the possession of any person...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '380': {
    title: 'Theft in dwelling house, etc.',
    description: 'Whoever commits theft in any building, tent or vessel, which building, tent or vessel is used...',
    relevance: 'Medium',
    successRate: '70%',
    riskFactor: 'Medium'
  },
  '406': {
    title: 'Criminal breach of trust',
    description: 'Whoever commits criminal breach of trust shall be punished with imprisonment...',
    relevance: 'Medium',
    successRate: '68%',
    riskFactor: 'Medium'
  },
  '409': {
    title: 'Criminal breach of trust by public servant, or by banker, merchant or agent',
    description: 'Whoever, being in any manner entrusted with property, or with any dominion over property...',
    relevance: 'High',
    successRate: '82%',
    riskFactor: 'High'
  },
  '415': {
    title: 'Cheating',
    description: 'Whoever, by deceiving any person, fraudulently or dishonestly induces the person so deceived...',
    relevance: 'High',
    successRate: '78%',
    riskFactor: 'High'
  },
  '420': {
    title: 'Cheating and dishonestly inducing delivery of property',
    description: 'Whoever cheats and thereby dishonestly induces the person deceived to deliver any property...',
    relevance: 'High',
    successRate: '75%',
    riskFactor: 'High'
  },
  '425': {
    title: 'Mischief',
    description: 'Whoever, with intent to cause, or knowing that he is likely to cause, wrongful loss or damage...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '426': {
    title: 'Punishment for mischief',
    description: 'Whoever commits mischief shall be punished with imprisonment of either description...',
    relevance: 'Medium',
    successRate: '62%',
    riskFactor: 'Medium'
  },
  '427': {
    title: 'Mischief causing damage to the amount of fifty rupees',
    description: 'Whoever commits mischief and thereby causes loss or damage to the amount of fifty rupees...',
    relevance: 'Low',
    successRate: '58%',
    riskFactor: 'Low'
  },
  '435': {
    title: 'Mischief by fire or explosive substance with intent to cause damage',
    description: 'Whoever commits mischief by fire or any explosive substance, intending to cause...',
    relevance: 'High',
    successRate: '85%',
    riskFactor: 'High'
  },
  '436': {
    title: 'Mischief by fire or explosive substance with intent to destroy house, etc.',
    description: 'Whoever commits mischief by fire or any explosive substance, intending to cause...',
    relevance: 'High',
    successRate: '88%',
    riskFactor: 'Critical'
  },
  '447': {
    title: 'Criminal trespass',
    description: 'Whoever enters into or upon property in the possession of another with intent to commit an offence...',
    relevance: 'Medium',
    successRate: '60%',
    riskFactor: 'Medium'
  },
  '448': {
    title: 'House-trespass',
    description: 'Whoever commits criminal trespass by entering into or remaining in any building, tent or vessel...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '465': {
    title: 'Forgery',
    description: 'Whoever makes any false document or false electronic record or part of a document or electronic record...',
    relevance: 'High',
    successRate: '80%',
    riskFactor: 'High'
  },
  '467': {
    title: 'Forgery of valuable security, will, etc.',
    description: 'Whoever forges a document which purports to be a valuable security or a will...',
    relevance: 'High',
    successRate: '85%',
    riskFactor: 'High'
  },
  '468': {
    title: 'Forgery for purpose of cheating',
    description: 'Whoever commits forgery, intending that the document or electronic record forged shall be used...',
    relevance: 'High',
    successRate: '82%',
    riskFactor: 'High'
  },
  '471': {
    title: 'Using as genuine a forged document or electronic record',
    description: 'Whoever fraudulently or dishonestly uses as genuine any document or electronic record...',
    relevance: 'High',
    successRate: '78%',
    riskFactor: 'High'
  },
  '474': {
    title: 'Having possession of document described in section 466 or 467, knowing it to be forged and intending to use it as genuine',
    description: 'Whoever has in his possession any document or electronic record, knowing the same to be forged...',
    relevance: 'High',
    successRate: '75%',
    riskFactor: 'High'
  },
  '498': {
    title: 'Enticing or taking away or detaining with criminal intent a married woman',
    description: 'Whoever takes or entices away any woman who is and whom he knows or has reason to believe to be the wife...',
    relevance: 'Medium',
    successRate: '70%',
    riskFactor: 'Medium'
  },
  '499': {
    title: 'Defamation',
    description: 'Whoever, by words either spoken or intended to be read, or by signs or by visible representations...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '500': {
    title: 'Punishment for defamation',
    description: 'Whoever defames another shall be punished with simple imprisonment for a term which may extend to two years...',
    relevance: 'Medium',
    successRate: '62%',
    riskFactor: 'Medium'
  },
  '503': {
    title: 'Criminal intimidation',
    description: 'Whoever threatens another with any injury to his person, reputation or property...',
    relevance: 'Medium',
    successRate: '68%',
    riskFactor: 'Medium'
  },
  '504': {
    title: 'Intentional insult with intent to provoke breach of the peace',
    description: 'Whoever intentionally insults, and thereby gives provocation to any person...',
    relevance: 'Low',
    successRate: '55%',
    riskFactor: 'Low'
  },
  '506': {
    title: 'Punishment for criminal intimidation',
    description: 'Whoever commits the offence of criminal intimidation shall be punished with imprisonment...',
    relevance: 'Medium',
    successRate: '65%',
    riskFactor: 'Medium'
  },
  '509': {
    title: 'Word, gesture or act intended to insult the modesty of a woman',
    description: 'Whoever, intending to insult the modesty of any woman, utters any word, makes any sound or gesture...',
    relevance: 'Medium',
    successRate: '70%',
    riskFactor: 'Medium'
  },
  '511': {
    title: 'Punishment for attempting to commit offences punishable with imprisonment for life or other imprisonment',
    description: 'Whoever attempts to commit an offence punishable by this Code with imprisonment for life or imprisonment...',
    relevance: 'High',
    successRate: '75%',
    riskFactor: 'High'
  }
};

// Add keyword mapping for IPC sections
const IPC_KEYWORDS: IPCKeywordMap = {
  'murder': ['302', '304', '307'],
  'kill': ['302', '304', '307'],
  'homicide': ['302', '304'],
  'theft': ['379', '380'],
  'steal': ['379', '380'],
  'robbery': ['379', '380'],
  'cheating': ['415', '420'],
  'fraud': ['415', '420'],
  'forgery': ['465', '467', '468', '471', '474'],
  'fake': ['465', '467', '468'],
  'assault': ['323', '354'],
  'attack': ['323', '354'],
  'trespass': ['447', '448'],
  'mischief': ['425', '426', '427', '435', '436'],
  'damage': ['425', '426', '427'],
  'defamation': ['499', '500'],
  'slander': ['499', '500'],
  'intimidation': ['503', '506'],
  'threat': ['503', '506'],
  'trust': ['406', '409'],
  'rape': ['376'],
  'war': ['121'],
  'assembly': ['141'],
  'insult': ['504', '509']
};

// Replace the Hugging Face API key with the new one
const HF_API_KEY = 'REMOVED';

// Text extraction using Python script
async function extractText(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'extract_text.py');
    const process = spawn('python', [pythonScript, filePath]);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Text extraction failed: ${error}`));
      } else {
        resolve(output.trim());
      }
    });
  });
}

// Legal document classification using Hugging Face API
async function classifyLegalDocument(text: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/nlpaueb/legal-bert-base-uncased',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `Classify if this is a legal document: ${text.substring(0, 500)}`
        })
      }
    );

    const data = await response.json() as HuggingFaceResponse[];
    return data[0].generated_text.toLowerCase().includes('legal');
  } catch (error) {
    console.error('Error in legal classification:', error);
    return false;
  }
}

// Generate 3-point summary using T5
async function generateSummary(text: string): Promise<string[]> {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/google/flan-t5-large',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `Summarize this legal document in 3 key points: ${text}`
        })
      }
    );

    const data = await response.json() as HuggingFaceResponse[];
    return data[0].generated_text.split('\n').slice(0, 3);
  } catch (error) {
    console.error('Error in summary generation:', error);
    return ['Summary generation failed'];
  }
}

// Extract IPC sections using regex
function extractIPCSections(text: string) {
  const sections = [];
  const ipcRegex = /section\s+(\d+)/gi;
  let match;

  while ((match = ipcRegex.exec(text)) !== null) {
    const sectionNumber = match[1];
    if (IPC_SECTIONS[sectionNumber]) {
      sections.push({
        section: sectionNumber,
        description: IPC_SECTIONS[sectionNumber].description,
        relevance: IPC_SECTIONS[sectionNumber].relevance
      });
    }
  }

  return sections;
}

// Calculate case success rate based on IPC sections
function calculateCaseSuccessRate(ipcSections: string[]): { name: string; rate: string }[] {
  return ipcSections.map(section => ({
    name: `Case under Section ${section}`,
    rate: IPC_SECTIONS[section]?.successRate || '50%'
  }));
}

// Generate risk analysis and recommendations
function generateRiskAnalysis(text: string, ipcSections: string[]) {
  const highestRiskSection = ipcSections[0] || '425';
  const riskLevel = (IPC_SECTIONS[highestRiskSection]?.riskFactor || 'Medium') as RiskLevel;
  
  return {
    riskAnalysis: `Based on the document analysis, this case presents a ${riskLevel.toLowerCase()} risk level. ${IPC_SECTIONS[highestRiskSection]?.description || ''}`,
    recommendations: riskFactors[riskLevel]
  };
}

// Function to extract keywords from text
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const keywords = new Set<string>();
  
  // Check each word against our keyword mapping
  words.forEach(word => {
    Object.keys(IPC_KEYWORDS).forEach(keyword => {
      if (word.includes(keyword)) {
        keywords.add(keyword);
      }
    });
  });
  
  return Array.from(keywords);
}

// Function to get relevant IPC sections based on keywords
function getRelevantIPCSections(keywords: string[]): string[] {
  const relevantSections = new Set<string>();
  
  keywords.forEach(keyword => {
    const sections = IPC_KEYWORDS[keyword] || [];
    sections.forEach(section => relevantSections.add(section));
  });
  
  return Array.from(relevantSections);
}

// Main document analysis function
export async function analyzeDocument(filePath: string): Promise<DocumentAnalysis> {
  try {
    // Extract text from document
    const text = await extractText(filePath);
    
    // Extract keywords from the text
    const keywords = extractKeywords(text);
    
    // Get relevant IPC sections based on keywords
    const relevantSections = getRelevantIPCSections(keywords);
    
    // If no relevant sections found, return non-legal document response
    if (relevantSections.length === 0) {
      return {
        fileName: path.basename(filePath),
        timestamp: new Date().toISOString(),
        isLegalDocument: false,
        analysis: 'This document does not appear to be related to legal matters.',
        keyPoints: ['Document is not related to legal matters'],
        recommendations: [
          'Please provide documents related to legal cases or matters',
          'Consider consulting with the lawyer about what documents are needed',
          'Submit relevant legal documentation for proper analysis'
        ]
      };
    }

    // Generate summary based on keywords
    const keyPoints = await generateSummary(text);

    // Get IPC sections details
    const ipcSections = relevantSections.map(section => ({
      section,
      description: IPC_SECTIONS[section]?.description || '',
      relevance: IPC_SECTIONS[section]?.relevance || 'Medium'
    }));

    // Calculate case success rates
    const caseSuccessRates = calculateCaseSuccessRate(relevantSections);

    // Generate risk analysis and recommendations
    const { riskAnalysis, recommendations } = generateRiskAnalysis(text, relevantSections);

    // Create demo case references based on relevant sections
    const caseReferences = relevantSections.map((section, index) => ({
      caseName: `Case ${index + 1} under Section ${section}`,
      citation: `2023 SC ${1000 + index}`,
      year: '2023',
      relevance: IPC_SECTIONS[section]?.successRate || '50%',
      summary: `Similar case involving ${IPC_SECTIONS[section]?.title || 'the offense'}`,
      successRate: IPC_SECTIONS[section]?.successRate || '50%'
    }));

    return {
      fileName: path.basename(filePath),
      timestamp: new Date().toISOString(),
      isLegalDocument: true,
      analysis: `Document analysis completed. Found ${relevantSections.length} relevant IPC sections based on keywords: ${keywords.join(', ')}`,
      keyPoints,
      statuteReferences: ipcSections,
      caseReferences,
      riskAnalysis,
      recommendations,
      matchedKeywords: keywords
    };
  } catch (error) {
    console.error('Error in document analysis:', error);
    throw new Error('Failed to analyze document: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Function to analyze a message
export async function analyzeMessage(message: string): Promise<DocumentAnalysis> {
  try {
    // Extract keywords from the message
    const keywords = extractKeywords(message);
    
    // Get relevant IPC sections based on keywords
    const relevantSections = getRelevantIPCSections(keywords);
    
    // If no relevant sections found, return non-legal message response
    if (relevantSections.length === 0) {
      return {
        fileName: 'message.txt',
        timestamp: new Date().toISOString(),
        isLegalDocument: false,
        analysis: 'This message does not appear to be related to legal matters.',
        keyPoints: ['Message is not related to legal matters'],
        recommendations: [
          'Please provide messages related to legal cases or matters',
          'Consider consulting with the lawyer about what information is needed',
          'Submit relevant legal information for proper analysis'
        ]
      };
    }

    // Get IPC sections details
    const ipcSections = relevantSections.map(section => ({
      section,
      description: IPC_SECTIONS[section]?.description || '',
      relevance: IPC_SECTIONS[section]?.relevance || 'Medium'
    }));

    // Create demo case references based on relevant sections
    const caseReferences = relevantSections.map((section, index) => ({
      caseName: `Case ${index + 1} under Section ${section}`,
      citation: `2023 SC ${1000 + index}`,
      year: '2023',
      relevance: IPC_SECTIONS[section]?.successRate || '50%',
      summary: `Similar case involving ${IPC_SECTIONS[section]?.title || 'the offense'}`,
      successRate: IPC_SECTIONS[section]?.successRate || '50%'
    }));

    // Generate risk analysis
    const highestRiskSection = relevantSections[0] || '425';
    const riskLevel = (IPC_SECTIONS[highestRiskSection]?.riskFactor || 'Medium') as RiskLevel;

    return {
      fileName: 'message.txt',
      timestamp: new Date().toISOString(),
      isLegalDocument: true,
      analysis: `Message analysis completed. Found ${relevantSections.length} relevant IPC sections based on keywords: ${keywords.join(', ')}`,
      keyPoints: [
        `Identified ${keywords.length} legal keywords in the message`,
        `Found ${relevantSections.length} relevant IPC sections`,
        `Primary offense appears to be under Section ${highestRiskSection}`
      ],
      statuteReferences: ipcSections,
      caseReferences,
      riskAnalysis: `Based on the message analysis, this case presents a ${riskLevel.toLowerCase()} risk level. ${IPC_SECTIONS[highestRiskSection]?.description || ''}`,
      recommendations: riskFactors[riskLevel],
      matchedKeywords: keywords
    };
  } catch (error) {
    console.error('Error in message analysis:', error);
    throw new Error('Failed to analyze message: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
} 
⚖️ AI-based Lawyer Communication Web App
A modern full-stack web application enabling secure, real-time communication and document sharing between clients and lawyers, featuring AI-powered legal document analysis using Hugging Face Transformers.

✨ Features
💬 Real-time Chat: Secure messaging between clients and lawyers using Socket.IO.

📁 Document Management: Upload, share, preview, and comment on legal documents (PDF, DOCX, TXT, Images).

🤖 AI Legal Analysis: Uses Hugging Face models for keyword extraction and IPC (Indian Penal Code) section matching.

📅 Appointment Booking: Schedule and manage appointments with legal professionals.

👥 Role-based Access: Separate workflows and dashboards for clients and lawyers.

🎨 Modern UI: Built with React, Tailwind CSS, and Lucide React Icons.

🔐 Push Protection: Environment variables used to manage secrets securely.

🧰 Tech Stack
Layer	Technologies
Frontend	React, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Icons
Backend	Node.js, Express, Socket.IO, Python (for AI document analysis)
AI/ML	Hugging Face Transformers (accessed via backend proxy)
State	React Context API, localStorage

🚀 Getting Started
1. Clone the Repository
bash
Copy
Edit
git clone https://github.com/your-username/lawyer-ai-communication-app.git
cd lawyer-ai-communication-app
2. Install Dependencies
Frontend
bash
Copy
Edit
cd client
npm install
Backend
bash
Copy
Edit
cd ../server
npm install
3. Environment Variables
Create a .env file in the server/ directory.

ini
Copy
Edit
PORT=5000
MONGO_URI=your_mongodb_connection_string
HF_API_KEY=your_huggingface_api_key
JWT_SECRET=your_jwt_secret
⚠️ Do NOT commit .env files to the repository.
Make sure .env is listed in .gitignore.

4. Start the Application
Start the Hugging Face Proxy (if separate)
bash
Copy
Edit
cd server/proxy
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
python app.py
Start Backend Server
bash
Copy
Edit
cd ../
npm run dev
Start Frontend
bash
Copy
Edit
cd ../client
npm run dev
Or, use concurrently to start both frontend and backend together (optional setup required).

🌐 Access the App
Open your browser and go to:

arduino
Copy
Edit
http://localhost:5173

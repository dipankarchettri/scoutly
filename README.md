# Scoutly - AI-Powered Startup Discovery Platform
<img width="1333" height="625" alt="image" src="https://github.com/user-attachments/assets/01078fbf-bb25-45a4-beb8-e3e8888498cc" />
<img width="1325" height="623" alt="image" src="https://github.com/user-attachments/assets/4d4e76b0-e579-4b92-9bdb-20a35f0acb5e" />

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-blue?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## Overview

Scoutly is an AI-powered startup discovery platform that helps job seekers and researchers find recently funded startups in real-time. Using Google's Gemini AI, Scoutly searches for and extracts information about newly funded startups across various domains, providing detailed insights into funding rounds, founders, investors, and contact information.

> **🚀 Quick Setup:** New to Scoutly? Check out the [Quick Start Guide](./docs/QUICK_START.md) for a streamlined setup process.

## Features

- 🔍 **AI-Powered Search**: Advanced Google Dork techniques combined with Gemini AI for deep web startup discovery
- 📊 **Real-time Data**: Focus on recently announced funding rounds (today, yesterday, week, month, quarter)
- 🎯 **Smart Filtering**: Filter startups by domain, funding stage, and date range
- ✉️ **Outreach Tools**: Generate personalized email templates for founder outreach
- 🎨 **Interactive UI**: Beautiful animated interface with GSAP-powered effects
- 📱 **Responsive Design**: Mobile-friendly layout for any device

## Prerequisites

Before setting up Scoutly, ensure you have the following installed on your local machine:

- **Node.js** (version 18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager (comes with Node.js)
- **MongoDB** - either:
  - MongoDB Atlas account (cloud) - [Sign up](https://www.mongodb.com/cloud/atlas/register)
  - OR MongoDB installed locally - [Download](https://www.mongodb.com/try/download/community)
- **Redis** - [Download](https://redis.io/download/)
  - Windows users: Use [Redis for Windows](https://github.com/microsoftarchive/redis/releases) or WSL
  - Mac users: `brew install redis`
  - Linux users: `sudo apt-get install redis-server`

### Required API Keys

You'll need to obtain the following API keys:

- **Google Gemini API Key** - [Get it here](https://ai.google.dev/)
- **OpenRouter API Key** - [Get it here](https://openrouter.ai/)
- **Firecrawl API Key** (optional, for web scraping) - [Get it here](https://www.firecrawl.dev/)

## Installation

Follow these steps to set up Scoutly on your local machine:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd scoutly
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory with the following configuration:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/scoutly
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# AI API Keys
GEMINI_API_KEYS="your_gemini_api_key_1,your_gemini_api_key_2"
OPENROUTER_API_KEY=your_openrouter_api_key

# Web Scraping (Optional)
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Environment
NODE_ENV=development
```

> [!IMPORTANT]
> - For `GEMINI_API_KEYS`, you can provide multiple API keys separated by commas for better rate limiting
> - If you're using MongoDB Atlas, replace the `MONGODB_URI` with your connection string
> - Make sure Redis is running on your machine before starting the application

### 4. Start Required Services

#### Start Redis (if not running as a service)

**Windows:**
```bash
# Navigate to Redis installation directory and run:
redis-server
```

**Mac/Linux:**
```bash
redis-server
```

#### Start MongoDB (if running locally)

**Windows:**
```bash
# MongoDB usually runs as a service, but if not:
"C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe" --dbpath="C:\data\db"
```

**Mac/Linux:**
```bash
mongod --dbpath /path/to/your/data/directory
```

### 5. Initialize the Database (Optional)

To populate the database with sample data:

```bash
npm run db:seed
```

To clean up old data:

```bash
npm run db:cleanup
```

To completely wipe the database:

```bash
npm run db:wipe
```

### 6. Run the Development Server

Start both the backend server and frontend development server:

```bash
npm run dev
```

This command will:
- Start the Express backend server on port 3000
- Start the Vite frontend development server on port 5173
- Automatically open your default browser

### 7. Access the Application

Open your browser and navigate to:

**Frontend:** [http://localhost:5173](http://localhost:5173)
**Backend API:** [http://localhost:3000](http://localhost:3000)

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB connection string (local or Atlas) |
| `GEMINI_API_KEYS` | ✅ Yes | Comma-separated list of Google Gemini API keys |
| `OPENROUTER_API_KEY` | ✅ Yes | OpenRouter API key for AI model access |
| `FIRECRAWL_API_KEY` | ⚠️ Optional | Firecrawl API key for enhanced web scraping |
| `REDIS_HOST` | ✅ Yes | Redis server host (default: 127.0.0.1) |
| `REDIS_PORT` | ⚠️ Optional | Redis server port (default: 6379) |
| `NODE_ENV` | ⚠️ Optional | Environment mode (development/production) |

### API Integration

The application uses Google's Gemini API with the following configuration:
- Model: `gemini-3-pro-preview`
- Tools: Google Search integration
- System instructions for OSINT (Open Source Intelligence) data extraction

## Usage

1. **Search for Startups**:
   - Enter a domain or technology area in the search field (e.g., "AI Agents", "Crypto", "SaaS")
   - Or click on one of the suggested tags

2. **Browse Results**:
   - View startup cards with funding details, descriptions, and investor information
   - Filter results by date range and funding stage

3. **Outreach**:
   - Click on any startup card to view detailed information
   - Use the "Draft Outreach" button to generate a personalized email template
   - Connect with founders directly through provided contact information

## Project Structure

```
scoutly/
├── src/                      # Backend source code
│   ├── server.ts             # Express server entry point
│   ├── services/             # Business logic services
│   │   ├── aiService.ts      # AI/Gemini integration
│   │   ├── founderDiscoveryService.ts  # Founder data scraping
│   │   └── scraperService.ts # Startup discovery scraping
│   ├── models/               # MongoDB models
│   ├── routes/               # API route handlers
│   ├── config/               # Configuration files
│   │   ├── database.ts       # MongoDB configuration
│   │   └── queue.ts          # BullMQ/Redis configuration
│   └── workers/              # Background job workers
├── components/               # React UI components
│   ├── Dashboard.tsx         # Main dashboard with startup listings
│   ├── LandingPage.tsx       # Entry point with animated background
│   ├── StartupCard.tsx       # Individual startup display component
│   └── StartupModal.tsx      # Detailed startup information modal
├── scripts/                  # Database management scripts
│   ├── seed_database.ts      # Populate with sample data
│   ├── cleanup_database.ts   # Clean old entries
│   ├── wipe_database.ts      # Complete database reset
│   └── view_database.ts      # View database contents
├── docs/                     # Additional documentation
│   ├── ARCHITECTURE.md       # System architecture details
│   ├── DATABASE_MANAGEMENT.md # Database operations guide
│   ├── SCRAPING_METHODS.md   # Scraping strategy details
│   └── TESTING_GUIDE.md      # Testing procedures
├── types.ts                  # TypeScript type definitions
├── App.tsx                   # Main application router
├── index.html                # HTML template
├── index.tsx                 # React root entry point
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Technologies Used

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **GSAP** - Smooth animations
- **Lucide React** - Icon library
- **Recharts** - Data visualization

### Backend
- **Express** - Web server framework
- **MongoDB + Mongoose** - Database and ODM
- **Redis + BullMQ** - Job queue and caching
- **Puppeteer** - Web scraping
- **Winston** - Logging

### AI & APIs
- **Google Gemini** - AI-powered analysis
- **OpenRouter** - Multi-model AI access
- **Firecrawl** - Advanced web scraping

## Troubleshooting

### Common Issues

#### 1. Redis Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
- Ensure Redis is running: `redis-cli ping` (should return "PONG")
- Start Redis: `redis-server`
- Check Redis is listening on correct port: `redis-cli -p 6379`

#### 2. MongoDB Connection Error

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solution:**
- Verify MongoDB is running: `mongosh` or check MongoDB Compass
- Check your `MONGODB_URI` in `.env` file
- For local MongoDB: Start the service or run `mongod`
- For Atlas: Verify your connection string and network access settings

#### 3. Missing API Keys

**Error:** `API key not found` or similar authentication errors

**Solution:**
- Verify all required API keys are in your `.env` file
- Check that `.env` file is in the project root directory
- Ensure there are no extra spaces in your `.env` file
- Restart the development server after adding keys

#### 4. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

#### 5. Database Not Seeding

**Solution:**
- Ensure MongoDB is connected first
- Check MongoDB URI in `.env`
- Run cleanup before seeding: `npm run db:cleanup && npm run db:seed`

#### 6. Frontend Can't Connect to Backend

**Solution:**
- Verify backend is running on port 3000
- Check CORS configuration in `src/server.ts`
- Ensure both services started via `npm run dev`

### Getting Help

If you encounter issues not covered here:
1. Check the logs in the console for detailed error messages
2. Review the [docs](./docs) folder for additional documentation
3. Ensure all prerequisites are properly installed
4. Verify all environment variables are correctly set

## API and Data Flow

1. User enters search query on the landing page
2. Dashboard component calls `fetchFundedStartups` function
3. Gemini service constructs Google Dork queries based on filters
4. AI processes search results and extracts structured data
5. Data is formatted according to the `Startup` interface
6. Results are displayed as interactive startup cards

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions about Scoutly, please open an issue in the repository.

## Acknowledgments

- Google Gemini API for AI-powered search capabilities
- React and Vite for the modern development experience
- GSAP for the beautiful animations
- Lucide React for the clean icon set

---

Made with ❤️ by Dan

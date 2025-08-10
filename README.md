# CreatorsMantra Backend API

## 🚀 Overview
CreatorsMantra is a comprehensive creator economy management platform that helps creators and agencies manage their brand collaborations, contracts, payments, and performance analytics.

## 🎯 Target Market
- Creators with 10K-500K followers
- Creator managers and assistants
- Small to medium creator agencies

## 📦 Features
- Deal CRM Pipeline Management
- AI-Powered Pricing Suggestions
- Invoice Generation & Payment Tracking
- Brief Analysis & Contract Review
- Performance Analytics & Reporting
- Multi-user Agency Management

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **File Storage**: AWS S3
- **AI Integration**: OpenAI API
- **Payments**: Razorpay
- **Email**: Nodemailer

## 📁 Project Structure
```
src/
├── modules/              # Feature modules
│   ├── auth/            # Authentication & user management
│   ├── deals/           # Deal CRM pipeline
│   ├── invoices/        # Invoice generation & tracking
│   ├── ratecards/       # Rate card builder
│   ├── briefs/          # Brief analyzer
│   ├── performance/     # Performance analytics
│   ├── contracts/       # Contract management
│   ├── subscriptions/   # Subscription management
│   └── agency/          # Agency features
└── shared/              # Shared utilities & services
    ├── middleware.js    # Express middleware
    ├── utils.js         # Utility functions
    ├── config/          # Configuration files
    └── services/        # External service integrations
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB
- npm or yarn

### Installation
1. Clone the repository
```bash
git clone https://github.com/Scaleupapp-nirpeksh/creatorsmantra-api.git
cd creatorsmantra-api
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server
```bash
npm run dev
```

## 📚 API Documentation
API documentation will be available at `/api/docs` when the server is running.

## 🔒 Security Features
- JWT-based authentication
- Input validation and sanitization
- Rate limiting
- CORS protection
- Secure file upload
- Data encryption for sensitive fields

## 🧪 Testing
```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
```

## 📈 Subscription Tiers
- **Creator Starter**: ₹299/month
- **Creator Pro**: ₹699/month
- **Creator Elite**: ₹1,299/month
- **Agency Starter**: ₹2,999/month
- **Agency Pro**: ₹6,999/month

## 🤝 Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support
For support, email support@creatorsmantra.com or join our Discord community.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

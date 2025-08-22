# CreatorsMantra API - Project Overview

## 🏗️ Project Structure

### Root Directory
- **server.js** - Main entry point for the application
- **package.json** - Project dependencies and scripts
- **nodemon.json** - Development server configuration
- **LICENSE** - MIT License
- **README.md** - Project documentation

### Core Modules (`src/modules/`)

#### Authentication (`auth/`)
- User management and JWT-based authentication
- Model: User schema
- Routes: Login, register, profile management
- Service: Authentication business logic

#### Deals Management (`deals/`)
- CRM pipeline for brand collaborations
- Model: Deal schema with status tracking
- Controller: Deal CRUD operations
- Service: Deal management logic
- Validation: Input validation rules

#### Invoice System (`invoices/`)
- Invoice generation and payment tracking
- Model: Invoice schema
- Controller: Invoice operations
- Service: Invoice business logic
- Special: `payment-pdf-service.js` for PDF generation

#### Rate Cards (`ratecards/`)
- Pricing structure management
- Model: Rate card schema
- Controller: Rate card operations
- Service: Pricing calculations
- Validation: Rate validation rules

#### Brief Analysis (`briefs/`)
- AI-powered brief analysis and recommendations
- Model: Brief schema
- Controller: Brief operations
- Service: Brief processing logic
- Validation: Brief validation rules

#### Performance Analytics (`performance/`)
- Creator performance tracking and reporting
- Model: Performance metrics schema
- Controller: Analytics operations
- Service: Performance calculations
- Validation: Metrics validation

#### Contract Management (`contracts/`)
- Contract creation and management
- Model: Contract schema
- Controller: Contract operations
- Service: Contract processing
- Validation: Contract validation rules

#### Subscriptions (`subscriptions/`)
- Subscription tier management and billing
- Model: Subscription schema
- Controller: Subscription operations
- Service: Billing and tier management
- Validation: Subscription validation

#### Analytics (`analytics/`)
- Advanced analytics and insights
- Model: Analytics data schema
- Controller: Analytics endpoints
- Service: Data processing and insights
- Validation: Analytics validation

### Shared Services (`src/shared/`)

#### Configuration (`config/`)
- **database.js** - MongoDB connection setup
- **index.js** - Central configuration exports

#### AI Services (`services/ai/`)
- **openai.js** - OpenAI API integration
- **briefAnalyzer.js** - AI-powered brief analysis
- **contractAnalyzer.js** - Contract analysis
- **performanceWriter.js** - Performance report generation
- **pitchGenerator.js** - Pitch content generation
- **priceCalculator.js** - AI-based pricing suggestions

#### Email Services (`services/email/`)
- **emailService.js** - Core email functionality
- **notifications.js** - Notification system
- **templates.js** - Email templates

#### File Services (`services/file/`)
- **s3Upload.js** - AWS S3 file upload
- **pdfGenerator.js** - PDF document generation
- **imageProcessor.js** - Image processing utilities

#### Payment Services (`services/payment/`)
- **razorpay.js** - Razorpay payment integration
- **invoiceService.js** - Invoice processing
- **paymentTracker.js** - Payment status tracking

#### Core Utilities
- **middleware.js** - Express middleware functions
- **utils.js** - General utility functions
- **errors.js** - Custom error definitions
- **responses.js** - Standardized API responses
- **rateLimiter.js** - Rate limiting configuration

### Scripts (`scripts/`)
- **install-dependencies.js** - Dependency installation script
- **validate-setup.js** - Setup validation script

### Testing (`tests/`)
- **fixtures/test.data.js** - Test data fixtures
- **integration/** - Integration test suites
- **unit/** - Unit test suites

### File Uploads (`uploads/`)
- **briefs/** - Brief document uploads
- **payments/** - Payment screenshot uploads
- **performance/** - Performance report uploads

## 🛠️ Technology Stack

### Backend Framework
- **Node.js** (v16+) - Runtime environment
- **Express.js** - Web application framework

### Database
- **MongoDB** - Primary database
- **Mongoose** - ODM for MongoDB

### Authentication & Security
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting

### AI & ML
- **OpenAI API** - AI-powered features
- **Custom AI services** - Brief analysis, pricing, content generation

### File Processing
- **AWS S3** - File storage
- **multer** - File upload handling
- **puppeteer** - PDF generation
- **pdfkit** - PDF creation
- **mammoth** - Document processing

### Payment Processing
- **Razorpay** - Payment gateway integration

### Communication
- **Nodemailer** - Email sending
- **Twilio** - SMS/WhatsApp messaging

### Development Tools
- **nodemon** - Development server
- **eslint** - Code linting
- **jest** - Testing framework
- **supertest** - API testing

## 🔧 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Check code quality
- `npm run lint:fix` - Fix linting issues

## 🚀 Key Features

1. **Deal CRM Pipeline** - Complete deal management from lead to completion
2. **AI-Powered Insights** - Automated brief analysis and pricing suggestions
3. **Invoice & Payment System** - Comprehensive billing and payment tracking
4. **Performance Analytics** - Detailed creator performance metrics
5. **Contract Management** - Automated contract generation and management
6. **Multi-tier Subscriptions** - Flexible subscription models
7. **Agency Management** - Multi-user agency features
8. **File Processing** - PDF generation, image processing, document analysis

## 📊 Subscription Tiers

- **Creator Starter**: ₹299/month
- **Creator Pro**: ₹699/month  
- **Creator Elite**: ₹1,299/month
- **Agency Starter**: ₹2,999/month
- **Agency Pro**: ₹6,999/month

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Input validation and sanitization
- Rate limiting
- CORS protection
- Secure file upload to AWS S3
- Helmet security headers

## 📝 Development Notes

- Modular architecture with clear separation of concerns
- Comprehensive validation using Joi and express-validator
- Standardized error handling and API responses
- Extensive AI integration for automation
- Scalable file storage with AWS S3
- Production-ready logging with Winston
# CreatorsMantra API - Comprehensive Test Plan

## 🎯 Test Strategy Overview

This comprehensive test plan covers all aspects of the CreatorsMantra API, from basic functionality to complex integration scenarios. The tests are organized by priority and dependencies to ensure efficient execution.

## 📋 Test Execution Order & Dependencies

### Phase 1: Foundation Tests (Critical Path)
**Duration:** 2-3 hours  
**Prerequisites:** None  
**Dependency Level:** 0

1. **Database Connection & Configuration Tests**
2. **Authentication System Tests**
3. **Core Middleware Tests**
4. **User Management Tests**

### Phase 2: Core Module Tests (High Priority)
**Duration:** 4-6 hours  
**Prerequisites:** Phase 1 completed  
**Dependency Level:** 1

1. **Deal Management Tests**
2. **Invoice System Tests**
3. **Subscription Management Tests**

### Phase 3: Advanced Feature Tests (Medium Priority)
**Duration:** 3-4 hours  
**Prerequisites:** Phase 1 & 2 completed  
**Dependency Level:** 2

1. **AI Services Integration Tests**
2. **Analytics & Performance Tests**
3. **File Processing Tests**

### Phase 4: Integration & E2E Tests (Medium Priority)
**Duration:** 4-5 hours  
**Prerequisites:** Phase 1, 2 & 3 completed  
**Dependency Level:** 3

1. **End-to-End Workflow Tests**
2. **Cross-Module Integration Tests**
3. **Third-Party Service Integration Tests**

### Phase 5: Performance & Security Tests (Low Priority)
**Duration:** 2-3 hours  
**Prerequisites:** All previous phases  
**Dependency Level:** 4

1. **Load & Performance Tests**
2. **Security & Penetration Tests**
3. **Error Handling & Edge Cases**

---

## 🧪 Detailed Test Plans by Module

# Phase 1: Foundation Tests

## 1.1 Database Connection & Configuration Tests

### Test Suite: `database.test.js`
```javascript
describe('Database Connection Tests', () => {
  test('MongoDB connection establishment')
  test('Database schema validation')
  test('Index creation verification')
  test('Connection pool configuration')
  test('Database failover handling')
})
```

**Test Cases:**
- ✅ **DB_001**: Verify MongoDB connection string is valid
- ✅ **DB_002**: Test database connection establishment
- ✅ **DB_003**: Validate all required collections exist
- ✅ **DB_004**: Verify indexes are properly created
- ✅ **DB_005**: Test connection pool limits and timeout
- ✅ **DB_006**: Test database reconnection after failure
- ✅ **DB_007**: Verify environment-specific database selection

## 1.2 Authentication System Tests

### Test Suite: `auth.test.js`
```javascript
describe('Authentication System Tests', () => {
  describe('OTP Generation and Verification', () => {
    test('Generate OTP for registration')
    test('Generate OTP for login')
    test('Verify valid OTP')
    test('Reject invalid OTP')
    test('Handle OTP expiration')
    test('Prevent OTP brute force')
  })
  
  describe('User Registration', () => {
    test('Register new creator account')
    test('Prevent duplicate phone registration')
    test('Validate required fields')
    test('Create creator profile automatically')
  })
  
  describe('User Login', () => {
    test('Login with email and password')
    test('Login with phone and password')
    test('Login with OTP')
    test('Handle incorrect credentials')
    test('Rate limiting enforcement')
  })
  
  describe('JWT Token Management', () => {
    test('Generate JWT tokens on login')
    test('Refresh JWT tokens')
    test('Invalidate tokens on logout')
    test('Handle expired tokens')
  })
})
```

**Critical Test Cases:**
- ✅ **AUTH_001**: Phone number validation (Indian format)
- ✅ **AUTH_002**: OTP generation and SMS delivery
- ✅ **AUTH_003**: OTP verification within time limit
- ✅ **AUTH_004**: OTP rate limiting (3 attempts per 15 min)
- ✅ **AUTH_005**: User registration with complete profile
- ✅ **AUTH_006**: Duplicate phone/email rejection
- ✅ **AUTH_007**: Password strength validation
- ✅ **AUTH_008**: Login rate limiting (10 attempts per 15 min)
- ✅ **AUTH_009**: JWT token generation and validation
- ✅ **AUTH_010**: Token refresh mechanism
- ✅ **AUTH_011**: Logout and token invalidation
- ✅ **AUTH_012**: Password reset workflow
- ✅ **AUTH_013**: Manager invitation system
- ✅ **AUTH_014**: Profile update with validation

## 1.3 Core Middleware Tests

### Test Suite: `middleware.test.js`
```javascript
describe('Core Middleware Tests', () => {
  describe('Authentication Middleware', () => {
    test('Authenticate valid JWT token')
    test('Reject invalid JWT token')
    test('Handle missing authorization header')
  })
  
  describe('Authorization Middleware', () => {
    test('Role-based access control')
    test('Subscription tier validation')
    test('Feature access verification')
  })
  
  describe('Validation Middleware', () => {
    test('Request body validation')
    test('Query parameter validation')
    test('Path parameter validation')
  })
  
  describe('Rate Limiting Middleware', () => {
    test('Enforce rate limits')
    test('Different limits for different endpoints')
  })
})
```

**Test Cases:**
- ✅ **MW_001**: JWT authentication middleware
- ✅ **MW_002**: Role authorization middleware
- ✅ **MW_003**: Subscription authorization middleware
- ✅ **MW_004**: Request validation middleware
- ✅ **MW_005**: Rate limiting middleware
- ✅ **MW_006**: Error handling middleware
- ✅ **MW_007**: Security headers middleware

---

# Phase 2: Core Module Tests

## 2.1 Deal Management Tests

### Test Suite: `deals.test.js`
```javascript
describe('Deal Management System Tests', () => {
  describe('Deal CRUD Operations', () => {
    test('Create new deal with validation')
    test('Retrieve deal by ID')
    test('Update deal information')
    test('Delete/archive deal')
    test('Get deals list with filters')
  })
  
  describe('Deal Pipeline Management', () => {
    test('Move deal through pipeline stages')
    test('Track stage transition history')
    test('Get deals by stage')
    test('Pipeline overview analytics')
  })
  
  describe('Communication Tracking', () => {
    test('Add communication to deal')
    test('Update communication entry')
    test('Get communication history')
    test('Communication types and validation')
  })
  
  describe('Deliverable Management', () => {
    test('Add deliverables to deal')
    test('Update deliverable status')
    test('Track deliverable completion')
    test('Deliverable validation')
  })
  
  describe('Brand Profile Management', () => {
    test('Create brand profile')
    test('Update brand information')
    test('Get brand profiles list')
    test('Link deals to brands')
  })
  
  describe('Deal Templates', () => {
    test('Create deal template')
    test('Use template for new deal')
    test('Update template')
    test('Delete template')
  })
  
  describe('Deal Analytics', () => {
    test('Revenue analytics calculation')
    test('Deal insights generation')
    test('Performance metrics')
    test('Pipeline conversion rates')
  })
})
```

**Critical Test Cases:**
- ✅ **DEAL_001**: Create deal with all required fields
- ✅ **DEAL_002**: Deal validation (brand, amount, dates)
- ✅ **DEAL_003**: Deal stage progression workflow
- ✅ **DEAL_004**: Communication logging and tracking
- ✅ **DEAL_005**: Deliverable management and status
- ✅ **DEAL_006**: Brand profile creation and linking
- ✅ **DEAL_007**: Deal template functionality
- ✅ **DEAL_008**: Deal filtering and search
- ✅ **DEAL_009**: Deal archiving and restoration
- ✅ **DEAL_010**: Revenue and analytics calculations
- ✅ **DEAL_011**: Deals requiring attention alerts
- ✅ **DEAL_012**: Bulk operations on deals
- ✅ **DEAL_013**: Quick actions (approve, reject, etc.)
- ✅ **DEAL_014**: Deal permissions and access control

## 2.2 Invoice System Tests

### Test Suite: `invoices.test.js`
```javascript
describe('Invoice Management System Tests', () => {
  describe('Individual Invoice Management', () => {
    test('Create individual invoice from deal')
    test('Update invoice details')
    test('Delete/cancel invoice')
    test('Get invoice by ID')
    test('List invoices with filters')
  })
  
  describe('Consolidated Invoice Management', () => {
    test('Create monthly consolidated invoice')
    test('Create brand-wise consolidated invoice')
    test('Create agency payout invoice')
    test('Create custom selection invoice')
    test('Date range consolidation')
  })
  
  describe('Tax Calculations', () => {
    test('GST calculation (CGST/SGST)')
    test('GST calculation (IGST)')
    test('TDS calculation and deduction')
    test('Tax exemption handling')
    test('Tax preview calculation')
  })
  
  describe('Payment Management', () => {
    test('Record payment against invoice')
    test('Partial payment handling')
    test('Multiple payment methods')
    test('Payment verification')
    test('Payment history tracking')
  })
  
  describe('PDF Generation', () => {
    test('Generate invoice PDF')
    test('Download invoice PDF')
    test('PDF format validation')
    test('Custom branding in PDF')
  })
  
  describe('Payment Reminders', () => {
    test('Schedule payment reminders')
    test('Process due reminders')
    test('Reminder frequency settings')
    test('Auto-reminder system')
  })
  
  describe('Invoice Analytics', () => {
    test('Invoice dashboard metrics')
    test('Payment analytics')
    test('Outstanding invoices report')
    test('Revenue analysis')
  })
})
```

**Critical Test Cases:**
- ✅ **INV_001**: Individual invoice creation from deal
- ✅ **INV_002**: Line item validation and calculations
- ✅ **INV_003**: Client details validation
- ✅ **INV_004**: GST calculations (18% default)
- ✅ **INV_005**: TDS calculations (10% default)
- ✅ **INV_006**: Tax exemption scenarios
- ✅ **INV_007**: Consolidated invoice - monthly
- ✅ **INV_008**: Consolidated invoice - brand-wise
- ✅ **INV_009**: Consolidated invoice - agency payout
- ✅ **INV_010**: Payment recording and tracking
- ✅ **INV_011**: Partial payment handling
- ✅ **INV_012**: Invoice PDF generation
- ✅ **INV_013**: Payment reminder scheduling
- ✅ **INV_014**: Invoice status management
- ✅ **INV_015**: Bank details integration
- ✅ **INV_016**: Invoice analytics and reporting

## 2.3 Subscription Management Tests

### Test Suite: `subscriptions.test.js`
```javascript
describe('Subscription Management Tests', () => {
  describe('Subscription Tier Management', () => {
    test('Get available subscription tiers')
    test('Check feature access by tier')
    test('Upgrade subscription tier')
    test('Downgrade subscription tier')
  })
  
  describe('Payment Processing', () => {
    test('Razorpay integration')
    test('Payment verification')
    test('Failed payment handling')
    test('Refund processing')
  })
  
  describe('Subscription Analytics', () => {
    test('Usage tracking')
    test('Feature utilization metrics')
    test('Subscription renewal notifications')
  })
})
```

**Test Cases:**
- ✅ **SUB_001**: Subscription tier validation
- ✅ **SUB_002**: Feature access control
- ✅ **SUB_003**: Payment processing workflow
- ✅ **SUB_004**: Subscription upgrade/downgrade
- ✅ **SUB_005**: Usage limit enforcement
- ✅ **SUB_006**: Trial period management
- ✅ **SUB_007**: Payment verification with screenshots
- ✅ **SUB_008**: Subscription renewal reminders

---

# Phase 3: Advanced Feature Tests

## 3.1 AI Services Integration Tests

### Test Suite: `ai-services.test.js`
```javascript
describe('AI Services Integration Tests', () => {
  describe('OpenAI Integration', () => {
    test('API connection and authentication')
    test('Request rate limiting')
    test('Error handling')
  })
  
  describe('Brief Analysis', () => {
    test('Analyze brand brief PDF')
    test('Extract key requirements')
    test('Generate recommendations')
    test('Handle unsupported formats')
  })
  
  describe('Contract Analysis', () => {
    test('Analyze contract terms')
    test('Identify key clauses')
    test('Flag potential issues')
  })
  
  describe('Price Calculation', () => {
    test('AI-powered rate suggestions')
    test('Market rate comparison')
    test('Engagement-based pricing')
  })
  
  describe('Performance Writing', () => {
    test('Generate performance reports')
    test('Create insights and summaries')
    test('Format output correctly')
  })
  
  describe('Pitch Generation', () => {
    test('Generate pitch content')
    test('Customize for brand requirements')
    test('Multiple pitch variations')
  })
})
```

**Test Cases:**
- ✅ **AI_001**: OpenAI API connection and auth
- ✅ **AI_002**: Brief analysis from PDF upload
- ✅ **AI_003**: Contract analysis and recommendations
- ✅ **AI_004**: AI-powered pricing suggestions
- ✅ **AI_005**: Performance report generation
- ✅ **AI_006**: Pitch content generation
- ✅ **AI_007**: Error handling for AI failures
- ✅ **AI_008**: Rate limiting for AI requests

## 3.2 Analytics & Performance Tests

### Test Suite: `analytics.test.js`
```javascript
describe('Analytics & Performance Tests', () => {
  describe('Performance Analytics', () => {
    test('Create performance record')
    test('Update performance metrics')
    test('Generate performance reports')
    test('Calculate engagement rates')
  })
  
  describe('Advanced Analytics', () => {
    test('Revenue analytics calculation')
    test('Deal conversion metrics')
    test('Creator performance insights')
    test('Trend analysis')
  })
  
  describe('Data Visualization', () => {
    test('Chart data preparation')
    test('Dashboard metrics compilation')
    test('Export analytics data')
  })
})
```

**Test Cases:**
- ✅ **PERF_001**: Performance record creation
- ✅ **PERF_002**: Metrics calculation and updates
- ✅ **PERF_003**: Performance report generation
- ✅ **PERF_004**: Engagement rate calculations
- ✅ **ANAL_001**: Revenue analytics dashboard
- ✅ **ANAL_002**: Deal pipeline analytics
- ✅ **ANAL_003**: Creator performance insights

## 3.3 File Processing Tests

### Test Suite: `file-processing.test.js`
```javascript
describe('File Processing Tests', () => {
  describe('AWS S3 Upload', () => {
    test('Upload file to S3 bucket')
    test('Generate presigned URLs')
    test('Handle upload failures')
    test('File type validation')
  })
  
  describe('PDF Generation', () => {
    test('Generate invoice PDFs')
    test('Generate performance reports')
    test('Custom PDF formatting')
  })
  
  describe('Image Processing', () => {
    test('Image upload and resize')
    test('Thumbnail generation')
    test('Format conversion')
  })
  
  describe('Document Processing', () => {
    test('Extract text from PDFs')
    test('Process Word documents')
    test('Handle corrupted files')
  })
})
```

**Test Cases:**
- ✅ **FILE_001**: S3 upload functionality
- ✅ **FILE_002**: File type validation and security
- ✅ **FILE_003**: PDF generation for invoices
- ✅ **FILE_004**: Image processing and optimization
- ✅ **FILE_005**: Document text extraction
- ✅ **FILE_006**: File download and access control

---

# Phase 4: Integration & E2E Tests

## 4.1 End-to-End Workflow Tests

### Test Suite: `e2e-workflows.test.js`
```javascript
describe('End-to-End Workflow Tests', () => {
  describe('Complete Creator Journey', () => {
    test('Registration to first invoice workflow')
    test('Deal creation to completion workflow')
    test('Multi-deal consolidation workflow')
  })
  
  describe('Agency Workflow', () => {
    test('Agency account setup')
    test('Multi-creator management')
    test('Agency payout generation')
  })
  
  describe('Payment Workflows', () => {
    test('Invoice to payment completion')
    test('Partial payment scenarios')
    test('Payment verification workflow')
  })
})
```

**Critical E2E Test Cases:**
- ✅ **E2E_001**: Complete user registration and onboarding
- ✅ **E2E_002**: Deal creation through invoice generation
- ✅ **E2E_003**: Payment recording and verification
- ✅ **E2E_004**: Multi-deal consolidation workflow
- ✅ **E2E_005**: Agency management workflow
- ✅ **E2E_006**: Subscription upgrade workflow
- ✅ **E2E_007**: AI-powered features integration

## 4.2 Cross-Module Integration Tests

### Test Suite: `integration.test.js`
```javascript
describe('Cross-Module Integration Tests', () => {
  describe('Deal-Invoice Integration', () => {
    test('Create invoice from deal')
    test('Update deal status on payment')
    test('Deal metrics in invoice analytics')
  })
  
  describe('Auth-Subscription Integration', () => {
    test('Feature access based on subscription')
    test('Usage limits enforcement')
    test('Upgrade notifications')
  })
  
  describe('Analytics Integration', () => {
    test('Cross-module data aggregation')
    test('Unified reporting dashboard')
    test('Performance tracking')
  })
})
```

## 4.3 Third-Party Service Integration Tests

### Test Suite: `third-party.test.js`
```javascript
describe('Third-Party Service Integration Tests', () => {
  describe('Payment Gateway Integration', () => {
    test('Razorpay payment processing')
    test('Payment webhook handling')
    test('Refund processing')
  })
  
  describe('Communication Services', () => {
    test('SMS delivery via Twilio')
    test('Email delivery via Nodemailer')
    test('WhatsApp notifications')
  })
  
  describe('Cloud Services', () => {
    test('AWS S3 file operations')
    test('OpenAI API integration')
    test('Service failover handling')
  })
})
```

---

# Phase 5: Performance & Security Tests

## 5.1 Load & Performance Tests

### Test Suite: `performance.test.js`
```javascript
describe('Performance Tests', () => {
  describe('API Response Times', () => {
    test('Authentication endpoints < 200ms')
    test('Deal CRUD operations < 500ms')
    test('Invoice generation < 2s')
    test('PDF generation < 5s')
  })
  
  describe('Concurrent User Handling', () => {
    test('Handle 100 concurrent users')
    test('Database connection pooling')
    test('Memory usage optimization')
  })
  
  describe('Large Data Processing', () => {
    test('Process 1000+ deals efficiently')
    test('Generate large consolidated invoices')
    test('Handle bulk operations')
  })
})
```

## 5.2 Security & Penetration Tests

### Test Suite: `security.test.js`
```javascript
describe('Security Tests', () => {
  describe('Authentication Security', () => {
    test('Password brute force prevention')
    test('OTP brute force prevention')
    test('Session hijacking prevention')
  })
  
  describe('Authorization Security', () => {
    test('Privilege escalation prevention')
    test('Cross-user data access prevention')
    test('API endpoint protection')
  })
  
  describe('Input Validation Security', () => {
    test('SQL injection prevention')
    test('XSS prevention')
    test('File upload security')
  })
  
  describe('Data Protection', () => {
    test('Sensitive data encryption')
    test('PII handling compliance')
    test('Data export security')
  })
})
```

## 5.3 Error Handling & Edge Cases

### Test Suite: `edge-cases.test.js`
```javascript
describe('Error Handling & Edge Cases', () => {
  describe('Database Failures', () => {
    test('Handle database connection loss')
    test('Handle corrupted data')
    test('Handle transaction failures')
  })
  
  describe('External Service Failures', () => {
    test('Handle payment gateway failures')
    test('Handle SMS service failures')
    test('Handle AI service failures')
  })
  
  describe('Edge Case Scenarios', () => {
    test('Handle invalid date ranges')
    test('Handle zero-amount invoices')
    test('Handle concurrent operations')
    test('Handle malformed requests')
  })
})
```

---

## 🛠️ Test Setup and Configuration

### Test Environment Setup

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/shared/config/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Test Database Configuration

```javascript
// tests/setup.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

### Test Data Fixtures

```javascript
// tests/fixtures/test.data.js
const testUsers = {
  creator: {
    fullName: 'Test Creator',
    email: 'creator@test.com',
    phone: '9876543210',
    password: 'Test@123',
    userType: 'creator'
  },
  manager: {
    fullName: 'Test Manager',
    email: 'manager@test.com',
    phone: '9876543211',
    password: 'Test@123',
    userType: 'manager'
  }
};

const testDeals = {
  basic: {
    brandName: 'Test Brand',
    campaignTitle: 'Test Campaign',
    dealValue: 50000,
    currency: 'INR',
    platform: 'instagram',
    deliverableType: 'reel'
  }
};

const testInvoices = {
  individual: {
    clientDetails: {
      name: 'Test Client',
      email: 'client@test.com',
      gstNumber: '29ABCDE1234F1Z5'
    },
    taxSettings: {
      gstSettings: {
        applyGST: true,
        gstRate: 18
      },
      tdsSettings: {
        applyTDS: true,
        tdsRate: 10
      }
    }
  }
};

module.exports = {
  testUsers,
  testDeals,
  testInvoices
};
```

## 📊 Test Coverage Requirements

### Minimum Coverage Targets
- **Unit Tests**: 85% code coverage
- **Integration Tests**: 70% workflow coverage
- **E2E Tests**: 90% critical path coverage

### Priority Coverage Areas
1. **Critical Business Logic**: 95% coverage
2. **Payment Processing**: 95% coverage
3. **Authentication/Authorization**: 90% coverage
4. **Data Validation**: 85% coverage
5. **API Endpoints**: 80% coverage

## 🚀 Test Execution Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test -- auth.test.js

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e

# Run performance tests
npm run test:performance

# Generate test report
npm run test:report
```

## 📈 Test Reporting and Monitoring

### Test Results Dashboard
- Test execution status
- Coverage metrics
- Performance benchmarks
- Failure analysis
- Historical trends

### Continuous Integration
- Automated test runs on PR
- Coverage regression detection
- Performance regression alerts
- Security vulnerability scanning

---

## ✅ Success Criteria

### Test Completion Criteria
- [ ] All Phase 1 tests pass (100%)
- [ ] All Phase 2 tests pass (100%)
- [ ] Phase 3 tests pass (95%)
- [ ] Phase 4 tests pass (90%)
- [ ] Phase 5 tests pass (85%)

### Quality Gates
- [ ] No critical security vulnerabilities
- [ ] API response times within SLA
- [ ] Database queries optimized
- [ ] Error handling comprehensive
- [ ] Code coverage targets met

### Documentation Requirements
- [ ] Test cases documented
- [ ] Test data maintained
- [ ] Known issues logged
- [ ] Performance benchmarks recorded
- [ ] Security assessment completed

---

**Total Estimated Testing Time: 15-21 hours**  
**Recommended Team Size: 2-3 testers**  
**Tools Required: Jest, Supertest, MongoDB Memory Server, Artillery (performance)**
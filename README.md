# 🎓 AttendPro - Professional Attendance Management System

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green.svg)](https://mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-red.svg)](SECURITY.md)

A comprehensive, production-ready attendance management system with QR code integration, built with Node.js, Express, and MongoDB. Features enterprise-level security, real-time attendance tracking, and intuitive dashboards for administrators, teachers, and students.

## 🌟 Features

### 👑 Admin Features
- **System Overview Dashboard** with real-time statistics
- **User Management** - Create, manage, and deactivate users
- **Class Oversight** - Monitor all classes across the system
- **Attendance Analytics** - System-wide attendance reports
- **Security Monitoring** - Access logs and security events
- **Database Health** - Monitor system performance

### 👨‍🏫 Teacher Features
- **Class Management** - Create and manage multiple classes
- **Student Registration** - Add students individually or in bulk
- **QR Code Generation** - Generate QR codes for easy student access
- **Attendance Marking** - Mark attendance with multiple methods
- **Attendance Reports** - Generate detailed attendance reports
- **Class Analytics** - View class performance and statistics
- **Multi-Teacher Support** - Collaborate with other teachers

### 🎓 Student Features
- **Student Portal** - Access attendance without login
- **QR Code Access** - Quick access via QR code scanning
- **Attendance History** - View personal attendance records
- **Performance Tracking** - Monitor attendance percentage
- **Multi-Class Support** - Manage attendance across multiple classes
- **Responsive Design** - Mobile-friendly interface

### 🔒 Security Features
- **Enterprise-Grade Security** with helmet.js
- **Rate Limiting** - Protect against brute force attacks
- **Input Validation** - Comprehensive data sanitization
- **Session Security** - Secure session management
- **HTTPS Enforcement** - Force secure connections
- **Security Logging** - Comprehensive audit trails
- **CSRF Protection** - Cross-site request forgery protection
- **SQL Injection Prevention** - MongoDB query sanitization

### ⚡ Performance Features
- **Database Optimization** - Optimized indexes and queries
- **Caching** - Static file caching and compression
- **Connection Pooling** - Efficient database connections
- **Graceful Shutdown** - Proper application lifecycle management
- **Health Monitoring** - Built-in health check endpoints
- **Error Handling** - Comprehensive error management

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB 5.0+
- Git

### 1. Clone Repository
```bash
git clone https://github.com/your-username/attendpro.git
cd attendpro
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Generate secure session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Edit .env file with your configuration
nano .env
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Access Application
- **Main Application**: http://localhost:3000
- **Student Portal**: http://localhost:3000/student-portal
- **Admin Panel**: http://localhost:3000/admin-panel9920867077@AdilAbullahaUroojFatir

## 📁 Project Structure

```
attendpro/
├── config/                 # Configuration files
│   ├── database.js         # Database configuration & optimization
│   ├── environment.js      # Environment validation
│   └── security.js         # Security middleware setup
├── middleware/             # Custom middleware
│   ├── auth-enhanced.js    # Enhanced authentication
│   ├── error-handler.js    # Global error handling
│   └── validation.js       # Input validation
├── models/                 # MongoDB schemas
│   ├── user.js            # User model
│   ├── class.js           # Class model
│   ├── student.js         # Student model
│   ├── attendance.js      # Attendance model
│   └── timetable.js       # Timetable model
├── utils/                  # Utility functions
│   └── logger.js          # Winston logging system
├── views/                  # EJS templates
├── public/                 # Static assets
├── logs/                   # Application logs
├── index.js               # Main application (development)
├── index-production.js    # Production-ready application
└── package.json           # Dependencies and scripts
```

## 🔧 Configuration

### Environment Variables

#### Required (Production)
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/attendpro
SESSION_SECRET=your-64-character-secure-secret
BASE_URL=https://your-domain.com
```

#### Optional Configuration
```bash
# Security
TRUST_PROXY=true
FORCE_HTTPS=true
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_REGISTRATION=false
ENABLE_QR_CODE_GENERATION=true
ENABLE_BULK_OPERATIONS=true

# Performance
ENABLE_COMPRESSION=true
CACHE_STATIC_FILES=true
DB_MAINTENANCE_ENABLED=true
```

See `.env.example` for complete configuration options.

## 🗄️ Database Schema

### Users Collection
```javascript
{
  USERNAME: String,    // Unique username
  EMAIL: String,       // Unique email
  PASSWORD: String,    // Bcrypt hashed password
  FULLNAME: String,    // Full name
  ROLE: String,        // 'admin', 'teacher', 'student'
  ISACTIVE: Boolean,   // Account status
  CREATEDAT: Date,     // Creation timestamp
  LASTLOGIN: Date      // Last login timestamp
}
```

### Classes Collection
```javascript
{
  CLASSNAME: String,   // Class name
  ROOMNO: Number,      // Room number
  SUBJECT: String,     // Subject name
  CLASSCODE: String,   // Unique class code
  CREATEDBY: ObjectId, // Creator user ID
  TEACHERS: [ObjectId], // Array of teacher IDs
  ISACTIVE: Boolean,   // Class status
  DESCRIPTION: String  // Optional description
}
```

### Students Collection
```javascript
{
  NAME: String,        // Student name
  ROLLNO: String,      // Roll number (unique per class)
  EMAIL: String,       // Optional email
  classId: ObjectId,   // Reference to class
  CLASSES: [ObjectId]  // Array of class references
}
```

### Attendance Collection
```javascript
{
  studentId: ObjectId, // Reference to student
  classId: ObjectId,   // Reference to class
  date: Date,          // Attendance date
  status: String,      // 'present' or 'absent'
  lectures: Number     // Number of lectures
}
```

## 🎯 Usage Guide

### For Administrators

1. **Initial Setup**
   - Access admin panel via obfuscated URL
   - Create teacher accounts
   - Monitor system health

2. **User Management**
   - View all system users
   - Activate/deactivate accounts
   - Monitor user activity

3. **System Monitoring**
   - Check application health
   - View security logs
   - Monitor performance metrics

### For Teachers

1. **Class Management**
   ```
   Dashboard → Create Class → Add Class Details → Save
   ```

2. **Student Management**
   ```
   Class Detail → Add Student → Enter Details → Save
   OR
   Class Detail → Bulk Add → Upload/Enter Multiple Students
   ```

3. **Attendance Marking**
   ```
   Class Detail → Mark Attendance → Select Date → Mark Students → Save
   ```

4. **Generate Reports**
   ```
   Class Detail → Attendance Report → Select Date Range → Generate
   ```

### For Students

1. **Access Portal**
   - Visit `/student-portal`
   - Enter roll number
   - View attendance history

2. **QR Code Access**
   - Scan QR code provided by teacher
   - Automatic access to personal dashboard
   - View attendance statistics

## 🔒 Security Features

### Authentication & Authorization
- **Bcrypt Password Hashing** with salt rounds
- **Session-based Authentication** with secure cookies
- **Role-based Access Control** (Admin, Teacher, Student)
- **CSRF Protection** for form submissions
- **Session Timeout** and secure session management

### Input Security
- **Input Sanitization** - Remove harmful content
- **Data Validation** - Comprehensive validation rules
- **MongoDB Injection Prevention** - Query sanitization
- **XSS Protection** - Cross-site scripting prevention
- **SQL Injection Protection** - Parameterized queries

### Network Security
- **Rate Limiting** - Prevent brute force attacks
- **HTTPS Enforcement** - Force secure connections
- **Security Headers** - Comprehensive security headers
- **CORS Protection** - Cross-origin request security
- **Proxy Trust** - Secure reverse proxy configuration

### Monitoring & Logging
- **Security Event Logging** - Comprehensive audit trail
- **Failed Authentication Logging** - Monitor attack attempts
- **Admin Action Logging** - Track administrative actions
- **Error Logging** - Comprehensive error tracking
- **Performance Monitoring** - System health tracking

## 📊 API Endpoints

### Authentication
```
POST /login           # User login
POST /register        # User registration (if enabled)
GET  /logout          # User logout
```

### Dashboard
```
GET  /dashboard       # User dashboard
GET  /health          # System health check
```

### Class Management
```
GET  /classlist       # List classes
POST /createclass     # Create new class
GET  /classdetail/:id # Class details
```

### Student Management
```
POST /classdetail/:id/addstudent        # Add student
POST /classdetail/:id/addbulkstudents   # Bulk add students
POST /classdetail/:classId/deletestudent/:studentId  # Delete student
```

### Student Portal
```
GET  /student-portal         # Student portal access
POST /student-portal         # Student portal login
GET  /student-dashboard/:id  # Individual student dashboard
```

### Admin Panel
```
GET /admin-panel9920867077@AdilAbullahaUroojFatir  # Admin panel (obfuscated)
```

## 🚀 Deployment

### Production Deployment
1. **Environment Setup** - Configure all environment variables
2. **Database Setup** - MongoDB Atlas recommended
3. **Security Configuration** - Enable HTTPS, security headers
4. **Performance Optimization** - Enable caching, compression

### Deployment Platforms
- **Railway** (Recommended)
- **Render**
- **Heroku**
- **Digital Ocean**
- **VPS/Server**

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 📈 Performance Optimization

### Database Optimization
- **Optimized Indexes** - Strategic index creation
- **Connection Pooling** - Efficient database connections
- **Query Optimization** - Optimized MongoDB queries
- **Aggregation Pipelines** - Efficient data processing

### Application Optimization
- **Gzip Compression** - Reduce response sizes
- **Static File Caching** - Browser caching headers
- **Session Optimization** - Efficient session management
- **Memory Management** - Garbage collection optimization

### Monitoring
- **Health Checks** - Built-in health monitoring
- **Performance Metrics** - Request timing and memory usage
- **Error Tracking** - Comprehensive error logging
- **Database Health** - Connection and query monitoring

## 🧪 Testing

### Run Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Security Testing
```bash
npm run security:audit    # Security audit
npm run security:check    # Security vulnerabilities
```

### Performance Testing
```bash
npm run lint             # Code linting
npm run lint:fix         # Auto-fix linting issues
```

## 📝 Logging

### Log Files
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs
- `logs/security.log` - Security events
- `logs/security-audit.log` - Security audit trail

### Log Levels
- **Error** - Application errors
- **Warn** - Warnings and security events
- **Info** - General information
- **Debug** - Detailed debugging (development only)

## 🔄 Updates & Maintenance

### Updating Dependencies
```bash
npm update              # Update packages
npm audit               # Security audit
npm audit fix           # Fix vulnerabilities
```

### Database Maintenance
- **Automatic Cleanup** - Expired sessions removal
- **Index Optimization** - Automatic index creation
- **Performance Monitoring** - Health checks

### Security Updates
- **Regular Updates** - Keep dependencies current
- **Security Patches** - Apply security updates promptly
- **Monitoring** - Continuous security monitoring

## 🤝 Contributing

### Development Setup
```bash
git clone https://github.com/your-username/attendpro.git
cd attendpro
npm install
cp .env.example .env
npm run dev
```

### Code Standards
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting
- **Security Guidelines** - Follow security best practices
- **Documentation** - Comprehensive code documentation

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Deployment Guide](DEPLOYMENT.md)
- [Security Guide](SECURITY.md)
- [API Documentation](API.md)

### Common Issues
- **Database Connection** - Check MongoDB URI and credentials
- **Session Issues** - Verify session secret configuration
- **Admin Access** - Use obfuscated admin URL
- **Performance** - Check logs and health endpoints

### Getting Help
1. Check the documentation
2. Review error logs
3. Check GitHub issues
4. Create new issue if needed

## 🙏 Acknowledgments

- **Express.js** - Web framework
- **MongoDB** - Database
- **EJS** - Template engine
- **Helmet.js** - Security middleware
- **Winston** - Logging library
- **QRCode** - QR code generation

---

**Built with ❤️ for educational institutions worldwide**

*AttendPro - Making attendance management simple, secure, and efficient.*

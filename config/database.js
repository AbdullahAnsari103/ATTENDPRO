const mongoose = require('mongoose');
const { logger, logDatabaseOperation, logError } = require('../utils/logger');

// Database configuration based on environment
const getDatabaseConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    
    return {
        // Connection URL
        uri: process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/attendpro',
        
        // Connection options
        options: {
            // Connection pool settings
            maxPoolSize: isProduction ? 10 : 5, // Maximum number of connections
            minPoolSize: isProduction ? 2 : 1,  // Minimum number of connections
            maxIdleTimeMS: 30000,               // Close connections after 30 seconds of inactivity
            
            // Timeout settings
            serverSelectionTimeoutMS: 5000,     // How long to try selecting a server
            socketTimeoutMS: 45000,             // How long to wait for a response
            connectTimeoutMS: 10000,            // How long to wait for initial connection
            
            // Heartbeat settings
            heartbeatFrequencyMS: 10000,        // Frequency of heartbeat checks
            
            // Buffer settings
            bufferMaxEntries: 0,                // Disable mongoose buffering
            bufferCommands: false,              // Disable mongoose buffering commands
            
            // Other options
            autoIndex: !isProduction,          // Don't auto-build indexes in production
            autoCreate: !isProduction,         // Don't auto-create collections in production
            
            // Compression (if MongoDB supports it)
            compressors: ['snappy', 'zlib'],
            
            // Read/Write concerns
            readPreference: 'primary',
            writeConcern: {
                w: 'majority',
                j: true, // Journal acknowledgment
                wtimeout: 10000
            },
            
            // SSL in production
            ssl: isProduction,
            sslValidate: isProduction,
            
            // Retry writes
            retryWrites: true,
            retryReads: true
        }
    };
};

// Connection state management
let isConnecting = false;
let isConnected = false;

// Connection event handlers
const setupConnectionHandlers = () => {
    mongoose.connection.on('connected', () => {
        isConnected = true;
        isConnecting = false;
        logger.info('✅ Database connected successfully', {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        });
    });

    mongoose.connection.on('error', (error) => {
        isConnected = false;
        isConnecting = false;
        logError(error, null, { context: 'database_connection' });
        logger.error('❌ Database connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
        isConnected = false;
        logger.warn('⚠️  Database disconnected');
    });

    mongoose.connection.on('reconnected', () => {
        isConnected = true;
        logger.info('🔄 Database reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('🔄 Graceful shutdown initiated...');
        try {
            await mongoose.connection.close();
            logger.info('✅ Database connection closed');
            process.exit(0);
        } catch (error) {
            logError(error, null, { context: 'graceful_shutdown' });
            process.exit(1);
        }
    });
};

// Connect to database with retry logic
const connectDatabase = async (retries = 5) => {
    if (isConnecting || isConnected) {
        return mongoose.connection;
    }

    isConnecting = true;
    const config = getDatabaseConfig();
    
    logger.info('🔄 Attempting database connection...', {
        uri: config.uri.replace(/:([^:@]{8})[^:@]*@/, ':****@'), // Hide password
        attempt: 6 - retries
    });

    try {
        await mongoose.connect(config.uri, config.options);
        
        // Setup connection event handlers
        setupConnectionHandlers();
        
        // Log successful connection
        logDatabaseOperation('CONNECT', 'mongodb', {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port
        });

        return mongoose.connection;

    } catch (error) {
        isConnecting = false;
        logError(error, null, { 
            context: 'database_connection_attempt',
            retries_remaining: retries - 1 
        });
        
        if (retries > 1) {
            const delay = (6 - retries) * 2000; // Exponential backoff
            logger.warn(`🔄 Retrying database connection in ${delay}ms... (${retries - 1} attempts remaining)`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return connectDatabase(retries - 1);
        } else {
            logger.error('❌ Failed to connect to database after all attempts');
            throw error;
        }
    }
};

// Database health check
const checkDatabaseHealth = async () => {
    try {
        if (!isConnected) {
            throw new Error('Database not connected');
        }

        // Simple ping to check connection
        await mongoose.connection.db.admin().ping();
        
        // Check connection state
        const state = mongoose.connection.readyState;
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        
        return {
            status: 'healthy',
            state: states[state],
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            database: mongoose.connection.name,
            uptime: process.uptime()
        };
        
    } catch (error) {
        logError(error, null, { context: 'database_health_check' });
        return {
            status: 'unhealthy',
            error: error.message,
            state: 'error'
        };
    }
};

// Optimize collection indexes
const createOptimizedIndexes = async () => {
    try {
        logger.info('🔄 Creating optimized database indexes...');

        // User indexes
        const userCollection = mongoose.connection.collection('users');
        await Promise.all([
            userCollection.createIndex({ USERNAME: 1 }, { unique: true, background: true }),
            userCollection.createIndex({ EMAIL: 1 }, { unique: true, background: true }),
            userCollection.createIndex({ ROLE: 1 }, { background: true }),
            userCollection.createIndex({ ISACTIVE: 1 }, { background: true }),
            userCollection.createIndex({ CREATEDAT: -1 }, { background: true }),
            userCollection.createIndex({ LASTLOGIN: -1 }, { background: true })
        ]);

        // Class indexes
        const classCollection = mongoose.connection.collection('classes');
        await Promise.all([
            classCollection.createIndex({ CLASSCODE: 1 }, { unique: true, background: true }),
            classCollection.createIndex({ CREATEDBY: 1 }, { background: true }),
            classCollection.createIndex({ TEACHERS: 1 }, { background: true }),
            classCollection.createIndex({ ISACTIVE: 1 }, { background: true }),
            classCollection.createIndex({ createdAt: -1 }, { background: true }),
            classCollection.createIndex({ CLASSNAME: 1, SUBJECT: 1 }, { background: true })
        ]);

        // Student indexes
        const studentCollection = mongoose.connection.collection('students');
        await Promise.all([
            studentCollection.createIndex({ ROLLNO: 1, classId: 1 }, { unique: true, background: true }),
            studentCollection.createIndex({ classId: 1 }, { background: true }),
            studentCollection.createIndex({ ROLLNO: 1 }, { background: true }),
            studentCollection.createIndex({ NAME: 1 }, { background: true }),
            studentCollection.createIndex({ createdAt: -1 }, { background: true })
        ]);

        // Attendance indexes
        const attendanceCollection = mongoose.connection.collection('attendances');
        await Promise.all([
            attendanceCollection.createIndex({ studentId: 1, date: -1 }, { background: true }),
            attendanceCollection.createIndex({ classId: 1, date: -1 }, { background: true }),
            attendanceCollection.createIndex({ date: -1 }, { background: true }),
            attendanceCollection.createIndex({ studentId: 1, classId: 1, date: -1 }, { background: true }),
            attendanceCollection.createIndex({ status: 1 }, { background: true })
        ]);

        // Timetable indexes (if collection exists)
        const timetableCollection = mongoose.connection.collection('timetables');
        await Promise.all([
            timetableCollection.createIndex({ classId: 1 }, { background: true }),
            timetableCollection.createIndex({ day: 1, startTime: 1 }, { background: true }),
            timetableCollection.createIndex({ classId: 1, day: 1 }, { background: true })
        ]).catch(() => {
            // Timetable collection might not exist yet
            logger.info('⚠️  Timetable collection not found, skipping timetable indexes');
        });

        logger.info('✅ Database indexes created successfully');
        logDatabaseOperation('CREATE_INDEXES', 'all_collections', { success: true });

    } catch (error) {
        logError(error, null, { context: 'create_indexes' });
        logger.warn('⚠️  Some indexes may not have been created:', error.message);
    }
};

// Database cleanup and maintenance
const performMaintenance = async () => {
    try {
        logger.info('🔄 Performing database maintenance...');
        
        // Remove old inactive sessions (if using connect-mongo)
        const sessionCollection = mongoose.connection.collection('sessions');
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const result = await sessionCollection.deleteMany({
            expires: { $lt: oneWeekAgo }
        }).catch(() => {
            // Sessions collection might not exist
            return { deletedCount: 0 };
        });
        
        logger.info(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
        
        // Log maintenance completion
        logDatabaseOperation('MAINTENANCE', 'sessions', {
            expired_sessions_removed: result.deletedCount,
            timestamp: new Date()
        });
        
    } catch (error) {
        logError(error, null, { context: 'database_maintenance' });
        logger.warn('⚠️  Database maintenance completed with warnings:', error.message);
    }
};

// Connection status getter
const getConnectionStatus = () => ({
    isConnected,
    isConnecting,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
});

// Export database utilities
module.exports = {
    connectDatabase,
    checkDatabaseHealth,
    createOptimizedIndexes,
    performMaintenance,
    getConnectionStatus,
    mongoose
};
